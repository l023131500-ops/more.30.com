import { publicClient } from '@/lib/supabase';
import { goHome, hangup, read, respond, say, yemotParams } from '@/lib/yemot';
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
 * כל פנייה נרשמת, גם כשלא נמצא דבר. דווקא אז היא שווה יותר.
 *
 * על שמות המשתנים: ימות המשיח מחזירה בכל פנייה את המשתנים שכבר נקראו,
 * ולכן הם משמשים כזיכרון השיחה. q הוא מה שנאמר, pick הבחירה בתפריט
 * התוצאות, city העיר שנבחרה לצמצום, ו-again הבחירה בסוף.
 */

const FEW = 5;

/** הקראת רשימת שיעורים, ממוספרת. */
function readOut(rows: Awaited<ReturnType<typeof upcomingFor>>) {
  return say(...rows.map((row, i) => `${i + 1}. ${describeLesson(row)}`));
}

async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();

  const spoken = (params.q || params.text || params.speech || '').trim();
  const meta = {
    callId: params.ApiCallId, phone: params.ApiPhone, extension: params.ApiExtension,
    kind: 'search' as const,
  };

  /* ---------- פתיחה ---------- */
  if (!spoken) {
    return respond(
      say('כאן תוכלו לחפש כל שיעור ברחבי הארץ, בדרך שתבחרו'),
      read(
        'אמרו את שם הרב, את מיקום השיעור או את נושא השיעור, ותקבלו את המידע',
        'q',
        { mode: 'voice', max: 60, wait: 10 },
      ),
    );
  }

  /* ---------- מה ביקשו ---------- */
  const intent: Intent = await readIntent(spoken);

  // עיר שנבחרה בצמצום גוברת על מה שזוהה מהדיבור
  const narrowed = { ...intent };
  const cities = await citiesWithin(client, { topic: intent.topic, teacher: intent.teacher });
  if (params.city0 || params.city1 || params.city2) {
    const choice = pagedChoice(params, 'city', cities);
    if ('value' in choice) narrowed.city = choice.value;
  }

  const filter = { city: narrowed.city, topic: narrowed.topic, teacher: narrowed.teacher };
  const total = await countFor(client, filter);

  /* ---------- לא נמצא דבר ---------- */
  if (!total) {
    // ניסיון אחרון לפי מילות מפתח, לפני שמוותרים
    const fallback = await keywordSearch(client, intent.keywords || spoken, FEW);
    if (fallback.length) {
      await logRequest(client, { ...meta, spoken, intent, count: fallback.length, resolved: true });
      return respond(
        say(`נמצאו ${fallback.length} שיעורים שאולי מתאימים`),
        say(...fallback.map((row, i) => `${i + 1}. ${describeLesson(row as never)}`)),
        read('לחיפוש נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
        params.again === '2' ? hangup() : goHome(),
      );
    }

    await logRequest(client, { ...meta, spoken, intent, count: 0, resolved: false });

    if (params.retry === '2') {
      return respond(
        say('ההודעה שלכם נרשמה, ונחזור אליכם'),
        goHome(),
      );
    }
    return respond(
      say('המערכת לא הצליחה למצוא את השיעור שביקשתם'),
      read(
        'לחיפוש חדש הקישו 1. להשארת הודעה למערכת הקישו 2',
        'retry',
        { min: 1, max: 1 },
      ),
      params.retry === '1' ? goHome() : '',
    );
  }

  const heading = describeIntent(narrowed);

  /* ---------- מעט תוצאות: מקריאים מיד ---------- */
  if (total <= FEW) {
    const rows = await upcomingFor(client, filter, FEW);
    await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: true });
    return respond(
      say(`נמצאו ${total} שיעורים ${heading}`.trim()),
      readOut(rows),
      read('לחיפוש נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
      params.again === '2' ? hangup() : goHome(),
    );
  }

  /* ---------- הרבה תוצאות ---------- */

  // בחר לשמוע את הראשונים
  if (params.pick === '1') {
    const rows = await upcomingFor(client, filter, FEW);
    await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: true });
    return respond(
      say(`${FEW} השיעורים הקרובים ביותר`),
      readOut(rows),
      read('לחיפוש נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
      params.again === '2' ? hangup() : goHome(),
    );
  }

  // בחר לצמצם
  if (params.pick === '2') {
    if (!cities.length) {
      const rows = await upcomingFor(client, filter, FEW);
      return respond(
        say('אין חיתוך נוסף להציע'),
        readOut(rows),
        goHome(),
      );
    }
    const choice = pagedChoice(params, 'city', cities);
    if ('askText' in choice) {
      return respond(
        say('באיזו עיר'),
        read(choice.askText, choice.varName, { min: 1, max: 1 }),
      );
    }
  }

  await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: false });

  return respond(
    say(`נמצאו ${total} שיעורים ${heading}`.trim()),
    read(
      'לשמיעת השיעורים שנמצאו הקישו 1. לצמצום החיפוש הקישו 2',
      'pick',
      { min: 1, max: 1 },
    ),
  );
}

export const GET = handle;
export const POST = handle;
