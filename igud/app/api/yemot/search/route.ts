import { publicClient } from '@/lib/supabase';
import { goHome, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import {
  citiesWithin, countFor, describeLesson, keywordSearch, pagedChoice, upcomingFor,
} from '@/lib/ivr';
import { describeIntent, logRequest, readIntent, type Intent } from '@/lib/ivr-ai';
import { farewell, isBack, isHome, roundOf } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

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

async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);

  /** הקראת רשימה. כל שיעור הוא הודעה בפני עצמה, עם נשימה לפניו. */
  const readOut = (rows: Awaited<ReturnType<typeof upcomingFor>>) => say(
    ...rows.map((row, i) => {
      const label = ORDINAL[i]
        ? c('search.lesson', { ordinal: ORDINAL[i] })
        : c('search.lessonMore');
      return `${label} | ${describeLesson(row)}`;
    }),
  );

  const rounds = roundOf(params, 'q');
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
      next === 0 ? say(c('search.intro.1'), c('search.intro.2')) : say(c('search.again.ask')),
      read(c('search.ask'), `q${next}`, { mode: 'voice', silence: 3, seconds: 20 }),
    );
  }

  if (params[`again${r}`] === '2' || isHome(params[`again${r}`])) {
    if (isHome(params[`again${r}`])) return respond(say(c('nav.back')), goHome());
    return farewell(c);
  }

  /* ---------- שמירת שיעור לאזור האישי ---------- */
  if (params[`save${r}`]) {
    const saveId = String(params[`save${r}`]);
    const { data: res } = await client.rpc('igud_ivr_save_lesson', {
      p_phone: params.ApiPhone || '', p_lesson: saveId,
    });
    const ok = (res as { success?: boolean } | null)?.success !== false;
    return respond(
      say(ok ? c('personal.saved') : c('nav.error')),
      read(c('search.closing'), `again${r}`, { min: 1, max: 1 }),
    );
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
  const closing = c('search.closing');

  /* ---------- לא נמצא דבר ---------- */
  if (!total) {
    // ניסיון אחרון לפי מילות מפתח, לפני שמוותרים
    const fallback = await keywordSearch(client, intent.keywords || spoken, FEW);
    if (fallback.length) {
      await logRequest(client, { ...meta, spoken, intent, count: fallback.length, resolved: true });
      return respond(
        say(c('search.partial.1'), c('search.partial.2')),
        readOut(fallback as never),
        read(closing, `again${r}`, { min: 1, max: 1 }),
      );
    }

    await logRequest(client, { ...meta, spoken, intent, count: 0, resolved: false });

    if (params[`retry${r}`] === '2') {
      return farewell(c, c('search.noted.1'), c('search.noted.2'), c('search.noted.3'));
    }
    return respond(
      say(c('search.none.1'), c('search.none.2')),
      read(c('search.none.menu'), `retry${r}`, { min: 1, max: 1 }),
    );
  }

  const heading = describeIntent(narrowed);
  const found = total === 1
    ? c('search.foundOne', { heading })
    : c('search.found', { count: total, heading });

  /* ---------- מעט תוצאות: מקריאים מיד ---------- */
  if (total <= FEW) {
    const rows = await upcomingFor(client, filter, FEW);
    await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: true });
    return respond(
      say(found),
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
      say(c('search.nearest')),
      readOut(rows),
      read(closing, `again${r}`, { min: 1, max: 1 }),
    );
  }

  // בחר לצמצם לפי עיר
  if (params[`pick${r}`] === '2') {
    if (!cities.length) {
      const rows = await upcomingFor(client, filter, FEW);
      return respond(
        say(c('search.oneArea.1'), c('search.oneArea.2')),
        readOut(rows),
        read(closing, `again${r}`, { min: 1, max: 1 }),
      );
    }
    const choice = pagedChoice(params, cityPrefix, cities);
    if ('askText' in choice) {
      return respond(
        say(c('search.cityAsk')),
        read(choice.askText, choice.varName, { min: 1, max: 1 }),
      );
    }
  }

  await logRequest(client, { ...meta, spoken, intent: narrowed, count: total, resolved: false });

  return respond(
    say(found),
    read(c('search.manyMenu'), `pick${r}`, { min: 1, max: 1 }),
  );
}

export const GET = handle;
export const POST = handle;
