import { publicClient } from '@/lib/supabase';
import { goHome, hangup, read, respond, say, yemotParams } from '@/lib/yemot';
import { describeLesson, numberedMenu, topCities, topTopics, upcomingFor } from '@/lib/ivr';

export const dynamic = 'force-dynamic';

/**
 * שלוחה 1 — חיפוש שיעור.
 *
 * מהלך השיחה:
 *   תפריט ראשי -> בחירה לפי עיר, לפי נושא, או השיעורים הקרובים בכל הארץ
 *   -> רשימה ממוספרת -> הקראת עד חמישה שיעורים -> חזרה לתפריט.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();

  const mode = params.mode || '';
  const page = Number(params.page || '0');

  if (!mode) {
    return respond(
      say('חיפוש שיעור תורה'),
      read(
        'לחיפוש לפי עיר הקישו 1. לחיפוש לפי נושא הקישו 2. לשמיעת השיעורים הקרובים בכל הארץ הקישו 3',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  /* ---------- השיעורים הקרובים בכל הארץ ---------- */
  if (mode === '3') {
    const rows = await upcomingFor(client, {}, 5);
    if (!rows.length) return respond(say('לא נמצאו שיעורים קרובים במאגר'), goHome());
    return respond(
      say('חמשת השיעורים הקרובים ביותר'),
      say(...rows.map((row, i) => `${i + 1}. ${describeLesson(row)}`)),
      read('לחיפוש נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
      params.again === '2' ? hangup() : goHome(),
    );
  }

  /* ---------- לפי עיר ---------- */
  if (mode === '1') {
    const cities = await topCities(client);
    if (!cities.length) return respond(say('אין כרגע שיעורים במאגר'), goHome());

    if (!params.pick) {
      const menu = numberedMenu(cities, page);
      return respond(
        say('בחירת עיר'),
        read(menu.text, 'pick', { min: 1, max: 1 }),
      );
    }

    if (params.pick === '0') {
      const next = new URL(request.url);
      next.searchParams.set('page', String(page + 1));
      next.searchParams.delete('pick');
      const menu = numberedMenu(cities, page + 1);
      return respond(read(menu.text, 'pick', { min: 1, max: 1 }));
    }

    const city = numberedMenu(cities, page).slice[Number(params.pick) - 1];
    if (!city) return respond(say('בחירה לא תקינה'), goHome());

    const rows = await upcomingFor(client, { city }, 5);
    if (!rows.length) {
      return respond(say(`לא נמצאו שיעורים קרובים ב${city}`), goHome());
    }
    return respond(
      say(`שיעורים קרובים ב${city}`),
      say(...rows.map((row, i) => `${i + 1}. ${describeLesson(row)}`)),
      goHome(),
    );
  }

  /* ---------- לפי נושא ---------- */
  if (mode === '2') {
    const topics = await topTopics(client);
    if (!topics.length) return respond(say('אין כרגע שיעורים במאגר'), goHome());

    if (!params.pick) {
      const menu = numberedMenu(topics, page);
      return respond(
        say('בחירת נושא'),
        read(menu.text, 'pick', { min: 1, max: 1 }),
      );
    }

    if (params.pick === '0') {
      const menu = numberedMenu(topics, page + 1);
      return respond(read(menu.text, 'pick', { min: 1, max: 1 }));
    }

    const topic = numberedMenu(topics, page).slice[Number(params.pick) - 1];
    if (!topic) return respond(say('בחירה לא תקינה'), goHome());

    const rows = await upcomingFor(client, { topic }, 5);
    if (!rows.length) {
      return respond(say(`לא נמצאו שיעורים קרובים בנושא ${topic}`), goHome());
    }
    return respond(
      say(`שיעורים קרובים בנושא ${topic}`),
      say(...rows.map((row, i) => `${i + 1}. ${describeLesson(row)}`)),
      goHome(),
    );
  }

  return respond(say('בחירה לא תקינה'), goHome());
}

export const GET = handle;
export const POST = handle;
