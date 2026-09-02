import { publicClient } from '@/lib/supabase';
import { hangup, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import {
  citiesWithin, countFor, describeLesson, keywordSearch, pagedChoice, upcomingFor,
} from '@/lib/ivr';
import { describeIntent, logRequest, readIntent, type Intent } from '@/lib/ivr-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * שלוחה 1 — חיפוש שיעורים.
 *
 * המתקשר מדבר חופשי, ולא בוחר מתפריט. זו ההחלטה המרכזית כאן: אדם שמחפש
 * שיעור יודע לומר "דף יומי בבני ברק" הרבה לפני שהוא יודע באיזה ענף של
 * תפריט זה יושב. המשפט מפורק לשם רב, עיר ונושא, ומשם החיפוש.
 *
 * שלושה מצבים אפשריים אחרי החיפוש:
 *
 *   אין תוצאות  — נאמר במפורש שלא נמצא, ומוצע לנסות שוב או להשאיר הודעה.
 *   מעט תוצאות  — מוקראות מיד.
 *   הרבה תוצאות — נאמר כמה נמצאו, ומוצע לשמוע את הראשונות או לצמצם לפי עיר.
 *
 * כל פנייה נרשמת, גם כשלא נמצא דבר. דווקא אז היא שווה יותר: זו רשימת
 * מה שחסר במאגר, ומה שנוסח אחרת מכפי שהחיפוש יודע לקרוא. גם ניתוק
 * באמצע נרשם, כי גם הוא אומר משהו.
 *
 * על שמות המשתנים: ימות המשיח מחזירה בכל פנייה את כל המשתנים שכבר
 * נקראו בשלוחה, ולכן הם זיכרון השיחה — אבל גם אי אפשר למחוק אותם.
 * לכן לכל סבב חיפוש יש מספר משלו, וכל המשתנים שלו נושאים אותו. בלי זה
 * "חיפוש נוסף" היה מוצא את המשפט הקודם ומחזיר את אותן תוצאות.
 */

const FEW = 5;
const ORDINAL = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי'];

/** מספר הסבב הפעיל, לפי כמה משפטי חיפוש כבר נאמרו בשיחה. */
function roundOf(params: Record<string, string>): number {
  let n = 0;
  while (params[`q${n}`] !== undefined) n += 1;
  return n;
}

/** הקראת רשימת שיעורים. כל שיעור הוא הודעה בפני עצמה, עם נשימה לפניו. */
function readOut(rows: Awaited<ReturnType<typeof upcomingFor>>) {
  return say(...rows.map((row, i) => {
    const label = ORDINAL[i] ? `שיעור ${ORDINAL[i]}` : 'ועוד שיעור';
    return `${label} | ${describeLesson(row)}`;
  }));
}

async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();

  const rounds = roundOf(params);
  const r = Math.max(0, rounds - 1);
  const spoken = (params[`q${r}`] || '').trim();

  const meta = {
    callId: params.ApiCallId, phone: params.ApiPhone, extension: params.ApiExtension,
    kind: 'search' as const,
  };

  /* ---------- ניתוק באמצע ---------- */
  if (isHangup(params)) {
    if (spoken) {
      await logRequest(client, { ...meta, spoken, count: null, resolved: false });
    }
    return respond(noop('המתקשר ניתק'));
  }

  /* ---------- פתיחה, וגם כל סבב חדש ---------- */
  if (!rounds || params[`again${r}`] === '1') {
    const next = params[`again${r}`] === '1' ? rounds : 0;
    return respond(
      next === 0
        ? say('כאן תמצאו כל שיעור תורה ברחבי הארץ', 'פשוט אמרו לי מה אתם מחפשים')
        : say('בבקשה'),
      read(
        'אפשר לומר את שם הרב, את שם העיר, או את נושא השיעור',
        `q${next}`,
        { mode: 'voice', silence: 3, seconds: 20 },
      ),
    );
  }

  if (params[`again${r}`] === '2') {
    return respond(say('תודה שהתקשרתם לאיגוד השיעורים', 'שיהיה לימוד פורה'), hangup());
  }

  /* ---------- מה ביקשו ---------- */
  const intent: Intent = await readIntent(spoken);

  const cityPrefix = `c${r}_`;
  const narrowed = { ...intent };
  const cities = await citiesWithin(client, { topic: intent.topic, teacher: intent.teacher });
  if (params[`${cityPrefix}0`]) {
    const choice = pagedChoice(params, cityPrefix, cities);
    if ('value' in choice) narrowed.city = choice.value;
  }

  const filter = { city: narrowed.city, topic: narrowed.topic, teacher: narrowed.teacher };
  const total = await countFor(client, filter);
  const closing = 'לחיפוש נוסף הקישו 1. לסיום הקישו 2';

  /* ---------- לא נמצא דבר ---------- */
  if (!total) {
    // ניסיון אחרון לפי מילות מפתח, לפני שמוותרים
    const fallback = await keywordSearch(client, intent.keywords || spoken, FEW);
    if (fallback.length) {
      await logRequest(client, { ...meta, spoken, intent, count: fallback.length, resolved: true });
      return respond(
        say('לא מצאנו התאמה מדויקת', 'אבל אלה שיעורים שאולי יתאימו לכם'),
        say(...fallback.map((row, i) => {
          const label = ORDINAL[i] ? `שיעור ${ORDINAL[i]}` : 'ועוד שיעור';
          return `${label} | ${describeLesson(row as never)}`;
        })),
        read(closing, `again${r}`, { min: 1, max: 1 }),
      );
    }

    await logRequest(client, { ...meta, spoken, intent, count: 0, resolved: false });

    if (params[`retry${r}`] === '2') {
      return respond(
        say(
          'רשמנו את הבקשה שלכם',
          'אם השיעור הזה ייפתח או ייכנס למאגר, נדאג לעדכן אתכם',
          'תודה שעזרתם לנו להשלים את התמונה',
        ),
        hangup(),
      );
    }
    return respond(
      say(
        'חיפשנו, ולא מצאנו שיעור שמתאים למה שביקשתם',
        'יכול להיות שהוא עדיין לא במאגר',
      ),
      read(
        'לנסות חיפוש אחר הקישו 1. להשאיר לנו הודעה ונחזור אליכם הקישו 2',
        `retry${r}`,
        { min: 1, max: 1 },
      ),
    );
  }

  const heading = describeIntent(narrowed);
  const found = total === 1 ? 'נמצא שיעור אחד' : `נמצאו ${total} שיעורים`;

  /* ---------- מעט תוצאות: מקריאים מיד ---------- */
  if (total <= FEW) {
    const rows = await upcomingFor(client, filter, FEW);
    await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: true });
    return respond(
      say(`${found} ${heading}`.trim()),
      readOut(rows),
      read(closing, `again${r}`, { min: 1, max: 1 }),
    );
  }

  /* ---------- הרבה תוצאות ---------- */

  // בחר לשמוע את הראשונים
  if (params[`pick${r}`] === '1') {
    const rows = await upcomingFor(client, filter, FEW);
    await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: true });
    return respond(
      say('אלה הקרובים ביותר'),
      readOut(rows),
      read(closing, `again${r}`, { min: 1, max: 1 }),
    );
  }

  // בחר לצמצם לפי עיר
  if (params[`pick${r}`] === '2') {
    if (!cities.length) {
      const rows = await upcomingFor(client, filter, FEW);
      return respond(
        say('כל השיעורים האלה באותו אזור', 'אז הנה הם'),
        readOut(rows),
        read(closing, `again${r}`, { min: 1, max: 1 }),
      );
    }
    const choice = pagedChoice(params, cityPrefix, cities);
    if ('askText' in choice) {
      return respond(
        say('באיזו עיר תרצו לשמוע'),
        read(choice.askText, choice.varName, { min: 1, max: 1 }),
      );
    }
  }

  await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: false });

  return respond(
    say(`${found} ${heading}`.trim()),
    read(
      'לשמיעת השיעורים הקרובים הקישו 1. לצמצום לפי עיר הקישו 2',
      `pick${r}`,
      { min: 1, max: 1 },
    ),
  );
}

export const GET = handle;
export const POST = handle;
