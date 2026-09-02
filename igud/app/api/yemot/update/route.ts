import { publicClient } from '@/lib/supabase';
import { goHome, hangup, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import { describeLesson, numberedMenu } from '@/lib/ivr';
import { freeMessage } from '@/lib/ivr-flows';
import { DAY_SLOTS } from '@/lib/nedarim.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 2 — עדכון שיעור קיים.
 *
 * הזיהוי לפי מספר הטלפון של המתקשר, כפי שנשמר בפרטי הקשר של השיעור.
 * מהלך: בחירת שיעור -> בחירת יום -> שעה חדשה בארבע ספרות -> שמירה.
 *
 * הבדיקה עצמה יושבת במסד, בפונקציות igud_ivr_lessons ו-igud_ivr_set_time:
 * הן מחזירות ומעדכנות אך ורק שיעורים מפורסמים שמספר הקשר שלהם הוא מספר
 * המתקשר. כך אין צורך בחשבון בעל הרשאות מלאות בנתיב טלפוני שאינו מאומת.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  // הבחירה שאחרי עדכון מוצלח. היא נבדקת כאן ולא בסוף, כי אחרי בקשת קלט
  // המערכת מפסיקה לקרוא את התשובה וממתינה לפנייה הבאה
  if (params.again === '1') {
    return respond(say('מחזירים אתכם לתפריט', 'הקישו 2 לעדכון נוסף'), goHome());
  }
  if (params.again === '2') {
    return respond(say('תודה שהתקשרתם', 'שיהיה לימוד פורה'), hangup());
  }

  if (phone.length < 9) {
    return respond(
      say(
        'לא הצלחנו לזהות את המספר שלכם',
        'עדכון שיעור נעשה מהמספר שרשום אצלנו בפרטי הקשר',
        'אפשר לפנות למשרדי האיגוד ונשמח לעזור',
      ),
      hangup(),
    );
  }

  const client = publicClient();

  const { data: rows } = await client.rpc('igud_ivr_lessons', { p_phone: phone });
  const mine = (rows || []) as { id: string; title: string | null; topic: string | null }[];

  if (!mine.length) {
    return respond(
      say(
        'לא נמצאו שיעורים הרשומים על המספר הזה',
        'אם השיעור שלכם רשום על מספר אחר, התקשרו ממנו',
        'ולפתיחת שיעור חדש הקישו 4 בתפריט הראשי',
      ),
      goHome(),
    );
  }

  /* ---------- שני מסלולי העדכון ---------- */
  if (!params.mode) {
    return respond(
      say(mine.length === 1
        ? 'מצאנו שיעור אחד הרשום עליכם'
        : `מצאנו ${mine.length} שיעורים הרשומים עליכם`),
      read(
        'לעדכון פרטי השיעור שאלה אחר שאלה הקישו 1. לומר לנו במילים שלכם מה השתנה הקישו 2',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  const free = await freeMessage(client, params, {
    kind: 'update',
    requestKind: 'open_lesson',
    phone,
    invite: 'אמרו איזה שיעור לעדכן ומה השתנה בו, ואנחנו נעדכן עבורכם',
  });
  if (free) return free;

  /* ---------- בחירת השיעור ---------- */
  if (!params.pick) {
    // המספר כבר נאמר בשלב בחירת המסלול, ואין טעם לחזור עליו
    const menu = numberedMenu(mine.map((row) => describeLesson(row)));
    return respond(
      say('איזה שיעור לעדכן'),
      read(menu.text, 'pick', { min: 1, max: 1 }),
    );
  }

  const lesson = mine[Number(params.pick) - 1];
  if (!lesson) return respond(say('לא זיהינו את הבחירה', 'נחזור לתפריט'), goHome());

  /* ---------- בחירת היום ---------- */
  if (!params.day) {
    const menu = numberedMenu(DAY_SLOTS.map((d: { label: string }) => d.label));
    return respond(
      say('באיזה יום לעדכן את השעה'),
      read(menu.text, 'day', { min: 1, max: 1 }),
    );
  }

  const slot = DAY_SLOTS[Number(params.day) - 1] as { label: string; weekday: number } | undefined;
  if (!slot) return respond(say('לא זיהינו את הבחירה', 'נחזור לתפריט'), goHome());

  /* ---------- שעה חדשה ---------- */
  if (!params.time) {
    return respond(
      read(
        `הקישו את השעה החדשה ל${slot.label}, בארבע ספרות. `
        + 'לדוגמה, לשעה שמונה ורבע בערב הקישו 2015',
        'time',
        { min: 4, max: 4, echo: 'Time', confirm: true },
      ),
    );
  }

  const raw = digits(params.time);
  const hours = Number(raw.slice(0, 2));
  const minutes = Number(raw.slice(2, 4));
  if (raw.length !== 4 || hours > 23 || minutes > 59) {
    return respond(say('השעה שהוקשה אינה תקינה', 'נחזור לתפריט ואפשר לנסות שוב'), goHome());
  }
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  /* ---------- שמירה ---------- */
  const { error } = await client.rpc('igud_ivr_set_time', {
    p_phone: phone,
    p_lesson: lesson.id,
    p_day_label: slot.label,
    p_weekday: slot.weekday,
    p_time: time,
    p_sort: DAY_SLOTS.findIndex((d: { label: string }) => d.label === slot.label),
  });

  if (error) {
    return respond(
      say('העדכון לא נשמר', 'אפשר לנסות שוב, או לפנות למשרדי האיגוד ונטפל בזה'),
      goHome(),
    );
  }

  return respond(
    say('השעה עודכנה', `${slot.label} בשעה ${time}`),
    say('העדכון יופיע באתר בתוך דקות ספורות'),
    read('לעדכון נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
  );
}

export const GET = handle;
export const POST = handle;
