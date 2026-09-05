import { publicClient } from '@/lib/supabase';
import {
  creditCard, goHome, isHangup, noop, read, respond, say, sayDigits, yemotParams,
} from '@/lib/yemot';
import { farewell, freeMessage, isBack, isHome } from '@/lib/ivr-flows';
import { logRequest } from '@/lib/ivr-ai';
import { loadCopy } from '@/lib/ivr-copy';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

interface PayConfig {
  enabled?: boolean;
  currency?: string;
  minAmount?: string;
  maxPayments?: string;
}

/**
 * שלוחה 5 — שותפות בפעילות.
 *
 * ארבע דרכים לקחת חלק, לפי סדר הנוחות: הוראת קבע, כרטיס אשראי בשיחה
 * עצמה, השארת פרטים לחזרה, ומספר טלפון למי שמעדיף אדם.
 *
 * הוראת קבע אינה נסלקת כאן. היא דורשת הסכמה מתועדת, ומי שהקיש ארבע
 * ספרות בטלפון לא נתן אותה — ולכן המסלול מסביר ומעביר לשתי הדרכים
 * שבהן זה באמת נעשה.
 *
 * הסליקה עוברת דרך מודול הסליקה של ימות המשיח, שמדבר עם הסולק ישירות
 * ומחזיר לנו קוד תשובה. פרטי הסולק אינם כתובים בקוד אלא נקראים ממסך
 * ההגדרות, ומכאן שתי תוצאות שחשובות שתיהן: אפשר להחליף סולק או טרמינל
 * בלי פריסה, ואם לא הוגדר דבר — השלוחה אומרת שהתרומה בטלפון אינה
 * זמינה ומציעה את שתי הדרכים האחרות.
 *
 * ההתנהגות הזו מכוונת. ניחוש של פרמטר בסליקה אינו טעות שמתגלה בבדיקה
 * אלא תרומה שנכשלת, או גרוע מזה, כזו שנגבית ואינה מגיעה ליעדה. עדיף
 * מסלול שעובד מאשר טופס שאינו.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  /*
   * הגדרות הסליקה, דרך פונקציה במסד ולא בקריאה ישירה.
   *
   * השורה מסומנת כסודית, וה-RLS חוסם אותה בהרשאת אנונימי — כך שקריאה
   * ישירה מכאן החזירה תמיד ריק, והמתקשר שמע "התרומה בטלפון אינה
   * זמינה" גם כשהסליקה הופעלה. הפונקציה מחזירה רק את מה שדרוש כאן:
   * האם מופעל, מטבע, סכום מזערי ומספר תשלומים.
   *
   * הסולק, הטרמינל והסיסמה אינם מגיעים לכאן כלל, ואינם צריכים: הם
   * יושבים בקובץ ההגדרות של שלוחה 5 בימות, וערך ריק בתשובה פירושו
   * "קח מהשלוחה". מקור אחד לאמת, ובלי סוד שעובר דרך השרת.
   */
  const { data: payRow } = await client.rpc('igud_ivr_pay_config');
  const pay = (payRow || {}) as PayConfig;
  const payReady = pay.enabled === true;

  /* ---------- תשובת הסליקה, כשחוזרים ממנה ---------- */
  const code = String(params.CreditCard_CODE || '').trim();
  if (code) {
    if (code === 'GoBack') {
      return respond(say(c('nav.back')), goHome());
    }

    // כל קוד תשובה נרשם ביומן, מוצלח ככושל.
    //
    // זו אינה סטטיסטיקה אלא הכרח. "000" הוא האישור המקובל אצל רוב
    // הסולקים, ואיננו יודעים בוודאות מה נדרים פלוס מחזירה — ואם היא
    // מחזירה ערך אחר, תורם ישמע "העסקה לא הושלמה" בזמן שהכסף נגבה,
    // ויתרום שוב. הרישום הופך את השאלה הזו לתשובה שמגיעה מהעסקה
    // הראשונה במקום מניחוש, ואפשר לתקן לפני שנכנסים תורמים אמיתיים.
    await logRequest(client, {
      callId: params.ApiCallId,
      phone,
      extension: params.ApiExtension,
      kind: 'donation',
      spoken: `CreditCard_CODE=${code}`,
      count: Number(digits(params.amount || '')) || null,
      resolved: /^0+$/.test(code),
    });

    const approved = /^0+$/.test(code);
    if (approved) return farewell(c, c('partner.paid.1'), c('partner.paid.2'));
    return respond(
      say(c('partner.failed.1'), c('partner.failed.2')),
      goHome(),
    );
  }

  /* ---------- התפריט ---------- */
  if (!params.mode) {
    return respond(
      say(c('partner.intro.1'), c('partner.intro.2')),
      read(c('partner.menu'), 'mode', { min: 1, max: 1 }),
    );
  }
  if (isBack(params.mode) || isHome(params.mode)) {
    return respond(say(c('nav.back')), goHome());
  }

  /* ---------- 1: הוראת קבע ---------- */
  //
  // הוראת קבע אינה נפתחת בהקשות, וזו אינה מגבלה טכנית שאפשר לעקוף:
  // היא דורשת הסכמה מתועדת, ומי שהקיש ארבע ספרות בטלפון לא נתן אותה.
  // לכן כאן מסבירים, ומציעים את שתי הדרכים שבהן זה באמת נעשה.
  if (params.mode === '1') {
    if (!params.st) {
      return respond(
        say(c('partner.standing.1'), c('partner.standing.2')),
        read(c('partner.standing.menu'), 'st', { min: 1, max: 1 }),
      );
    }
    if (isBack(params.st) || isHome(params.st)) {
      return respond(say(c('nav.back')), goHome());
    }
    if (params.st === '2') {
      return respond(
        say(c('partner.phone')),
        sayDigits(SITE.voiceLine),
        say(c('partner.thanks'), c('nav.bye')),
        goHome(),
      );
    }
    const standing = await freeMessage(client, { ...params, mode: '2' }, {
      kind: 'donation',
      requestKind: 'open_lesson',
      phone,
      invite: c('partner.freeInvite'),
      copy: c,
    });
    if (standing) return standing;
  }

  /* ---------- 2: תרומה חד פעמית בכרטיס אשראי ---------- */
  if (params.mode === '2') {
    if (!payReady) {
      return respond(
        say(c('partner.unavailable'), c('partner.online')),
        say(c('partner.phone')),
        sayDigits(SITE.voiceLine),
        say(c('partner.thanks'), c('nav.bye')),
        goHome(),
      );
    }

    if (!params.amount) {
      return respond(
        read(c('partner.amountAsk'), 'amount', {
          min: 1, max: 6, wait: 12, echo: 'Number', confirm: true,
        }),
      );
    }

    const amount = Number(digits(params.amount));
    const minAmount = Number(pay.minAmount) || 1;
    if (!amount || amount < minAmount) {
      return respond(say(c('nav.notFound')), goHome());
    }

    return respond(
      say(c('partner.beforePay')),
      // הסכום בלבד. כל השאר ריק, וימות משלימה מקובץ ההגדרות של השלוחה
      creditCard({ amount, currency: pay.currency ?? 1, payments: pay.maxPayments || undefined }),
    );
  }

  /* ---------- 4: מספר הטלפון ---------- */
  if (params.mode === '4') {
    return respond(
      say(c('partner.phone')),
      sayDigits(SITE.voiceLine),
      say(c('partner.thanks'), c('nav.bye')),
      goHome(),
    );
  }

  /* ---------- 3: השארת פרטים ---------- */
  const free = await freeMessage(client, { ...params, mode: '2' }, {
    kind: 'donation',
    requestKind: 'open_lesson',
    phone,
    invite: c('partner.freeInvite'),
    copy: c,
  });
  if (free) return free;

  return respond(say(c('nav.notFound'), c('nav.back')), goHome());
}

export const GET = handle;
export const POST = handle;
