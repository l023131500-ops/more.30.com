import { publicClient } from '@/lib/supabase';
import {
  creditCard, goHome, isHangup, noop, read, respond, say, sayDigits, yemotParams,
} from '@/lib/yemot';
import { farewell, freeMessage, isBack, isHome } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

interface PaySettings {
  enabled?: boolean | string;
  provider?: string;
  shop?: string;
  terminal?: string;
  userName?: string;
  password?: string;
  currency?: string | number;
  maxPayments?: string | number;
  minAmount?: string | number;
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

  // פרטי הסולק, ומספר המוסד של האיגוד. שני מקורות ובכוונה: הגדרות
  // הסליקה מחזיקות את מה שנוגע לימות, ואילו מספר המוסד והסיסמה כבר
  // יושבים בהגדרות נדרים פלוס ומשרתים גם את הקאלבק ואת דף התרומות.
  // שכפול שלהם היה מבטיח ששני העותקים יתפצלו ביום שבו אחד יוחלף.
  const { data: rows } = await client
    .from('igud_settings').select('key, value').in('key', ['yemotPay', 'nedarim']);
  const groups = Object.fromEntries(
    ((rows || []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value || {}]),
  ) as Record<string, Record<string, unknown>>;

  const pay = (groups.yemotPay || {}) as PaySettings;
  const mosad = (groups.nedarim || {}) as { mosadId?: string; apiPassword?: string };

  const shop = String(pay.shop || mosad.mosadId || '');
  const password = String(pay.password || mosad.apiPassword || '');
  // די בהפעלה. שם הסולק אינו חובה כאן, כי הוא יכול לשבת בקובץ ההגדרות
  // של השלוחה בימות — וזה המקום הנכון לו: שם יושבים גם הטרמינל והסיסמה,
  // ומי שמחזיק את הגישה לימות רואה את הערכים המדויקים. השרת אומר כמה
  // לגבות, ולא עם מי לדבר.
  const payReady = pay.enabled === true || pay.enabled === 'true' || pay.enabled === 'yes';

  /* ---------- תשובת הסליקה, כשחוזרים ממנה ---------- */
  const code = String(params.CreditCard_CODE || '').trim();
  if (code) {
    if (code === 'GoBack') {
      return respond(say(c('nav.back')), goHome());
    }
    // 000 הוא האישור המקובל אצל רוב הסולקים, וכל ערך אחר הוא סירוב
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
      creditCard({
        provider: pay.provider ? String(pay.provider) : '',
        amount,
        shop: pay.shop ? shop : '',
        payments: pay.maxPayments ? String(pay.maxPayments) : undefined,
        currency: pay.currency ?? 1,
        userName: pay.userName ? String(pay.userName) : undefined,
        terminal: pay.terminal ? String(pay.terminal) : undefined,
        password: password || undefined,
      }),
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
