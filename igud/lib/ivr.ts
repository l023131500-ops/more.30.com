import type { SupabaseClient } from '@supabase/supabase-js';
import { relativeWhen, timeLabel } from './format';
import { speakable } from './yemot';

/** תיאור שיעור להקראה במערכת הקולית. */
export function describeLesson(row: {
  title?: string | null;
  topic?: string | null;
  topics?: string[] | null;
  teacher_name?: string | null;
  venue_name?: string | null;
  city?: string | null;
  next_at?: string | null;
  day_label?: string | null;
  time_of_day?: string | null;
}): string {
  const subject = row.title || row.topic || row.topics?.[0] || 'שיעור תורה';
  const parts = [subject];

  if (row.teacher_name) parts.push(`מפי ${row.teacher_name}`);
  if (row.venue_name) parts.push(`ב${row.venue_name}`);
  if (row.city) parts.push(`ב${row.city}`);

  if (row.next_at) {
    const when = relativeWhen(row.next_at);
    parts.push(`${when.day} בשעה ${when.time}`);
  } else if (row.day_label) {
    const time = timeLabel({
      weekday: null, day: row.day_label, time: row.time_of_day || null,
      date: null, slot: null, note: null, next_at: null,
    });
    parts.push(`${row.day_label} בשעה ${time}`);
  }

  return speakable(parts.join(', '));
}

/** תפריט ממוספר להקראה, עד תשע אפשרויות בעמוד. */
export function numberedMenu(items: string[], page = 0, pageSize = 9) {
  const start = page * pageSize;
  const slice = items.slice(start, start + pageSize);
  // מה האפשרות ואז המספר, ולא הפוך. מי שמקשיב צריך לדעת קודם על מה
  // מדובר, ורק אז מה להקיש — אחרת הוא שומע מספר ומחכה לגלות למה
  const text = slice.map((item, i) => `${item} הקישו ${i + 1}`).join('. ');
  const hasMore = items.length > start + pageSize;
  return {
    slice,
    text: hasMore ? `${text}. לשמיעת המשך הרשימה הקישו אפס` : text,
    hasMore,
  };
}

/** הערים שיש בהן הכי הרבה שיעורים. */
export async function topCities(client: SupabaseClient, limit = 40): Promise<string[]> {
  const { data } = await client
    .from('igud_lesson_cards')
    .select('city')
    .not('city', 'is', null)
    .limit(3000);

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const city = (row.city as string)?.trim();
    if (city) counts.set(city, (counts.get(city) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'))
    .slice(0, limit)
    .map(([city]) => city);
}

/** הנושאים שיש בהם הכי הרבה שיעורים. */
export async function topTopics(client: SupabaseClient, limit = 30): Promise<string[]> {
  const { data } = await client.from('igud_lesson_cards').select('topics').limit(3000);
  const counts = new Map<string, number>();
  for (const row of data || []) {
    for (const topic of (row.topics as string[] | null) || []) {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'))
    .slice(0, limit)
    .map(([topic]) => topic);
}

/** השיעורים הקרובים, עם אפשרות לסינון לפי עיר או נושא. */
export async function upcomingFor(
  client: SupabaseClient,
  filter: { city?: string; topic?: string; teacher?: string } = {},
  limit = 5,
) {
  // כמו ב-countFor: בלי מסנן אין תוצאות, לא הכול
  if (!hasFilter(filter)) return [];

  let query = client
    .from('igud_upcoming')
    .select('lesson_id, title, topic, topics, teacher_name, venue_name, city, next_at, day_label, time_of_day')
    .not('next_at', 'is', null)
    .order('next_at', { ascending: true })
    .limit(limit);

  if (filter.city) query = query.eq('city', filter.city);
  if (filter.topic) query = query.contains('topics', [filter.topic]);
  if (filter.teacher) query = query.ilike('teacher_name', `%${filter.teacher}%`);

  const { data } = await query;
  return data || [];
}

/**
 * האם יש כאן בכלל מה לסנן לפיו.
 *
 * שאלה קטנה עם משמעות גדולה: מסנן ריק אינו "הכול" אלא "לא הבנתי".
 * בלי ההבחנה הזו, מתקשר שאמר משפט שהחיפוש לא הצליח לפרק היה שומע
 * את מספר כל השיעורים במאגר ואת חמשת הקרובים בארץ — תשובה שנשמעת
 * כמו הצלחה ואין לה שום קשר למה שהוא ביקש.
 */
export function hasFilter(
  filter: { city?: string; topic?: string; teacher?: string } = {},
): boolean {
  return Boolean(filter.city || filter.topic || filter.teacher);
}

/**
 * כמה שיעורים עונים לסינון, בלי להביא אותם.
 *
 * המערכת אומרת "נמצאו ארבעים ושניים שיעורים" לפני שהיא מקריאה משהו,
 * ולכן דרושה ספירה נפרדת מהשליפה.
 */
export async function countFor(
  client: SupabaseClient,
  filter: { city?: string; topic?: string; teacher?: string } = {},
): Promise<number> {
  // מסנן ריק אינו מחזיר את כל המאגר. ראה hasFilter למעלה
  if (!hasFilter(filter)) return 0;

  let query = client
    .from('igud_upcoming')
    .select('lesson_id', { count: 'exact', head: true })
    .not('next_at', 'is', null);

  if (filter.city) query = query.eq('city', filter.city);
  if (filter.topic) query = query.contains('topics', [filter.topic]);
  if (filter.teacher) query = query.ilike('teacher_name', `%${filter.teacher}%`);

  const { count } = await query;
  return count || 0;
}

/**
 * הערים שבהן יש שיעורים מתוך תוצאות החיפוש הנוכחיות.
 *
 * זה החיתוך שמוצע למתקשר כשהרשימה ארוכה מדי. מוצעות רק ערים שבאמת
 * מופיעות בתוצאות, כדי שבחירה לעולם לא תוביל לרשימה ריקה.
 */
export async function citiesWithin(
  client: SupabaseClient,
  filter: { topic?: string; teacher?: string } = {},
  limit = 40,
): Promise<string[]> {
  let query = client
    .from('igud_upcoming')
    .select('city')
    .not('next_at', 'is', null)
    .not('city', 'is', null)
    .limit(600);

  if (filter.topic) query = query.contains('topics', [filter.topic]);
  if (filter.teacher) query = query.ilike('teacher_name', `%${filter.teacher}%`);

  const { data } = await query;
  const tally = new Map<string, number>();
  for (const row of data || []) {
    const city = (row as { city: string | null }).city;
    if (city) tally.set(city, (tally.get(city) || 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city]) => city);
}

/** חיפוש חופשי לפי מילות מפתח, לשימוש הסוכן הקולי. */
export async function keywordSearch(client: SupabaseClient, text: string, limit = 5) {
  const words = String(text || '')
    .replace(/[^֐-׿a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 6);

  if (!words.length) return [];

  const { data } = await client
    .from('igud_lesson_cards')
    .select('id, title, topic, topics, teacher_name, venue_name, city, next_at, search_text')
    .or(words.map((w) => `search_text.ilike.%${w.toLowerCase()}%`).join(','))
    .order('next_at', { ascending: true, nullsFirst: false })
    .limit(limit * 4);

  // דירוג לפי מספר המילים שהופיעו
  return (data || [])
    .map((row) => ({
      row,
      score: words.filter((w) => (row.search_text as string || '').includes(w.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.row);
}

/**
 * בחירה מרשימה ארוכה בשיחה טלפונית.
 *
 * ימות המשיח מחזירה בכל פנייה את כל המשתנים שכבר נקראו, אבל לא פרמטרים
 * שהמצאנו בעצמנו. לכן מספר העמוד מקודד בתוך שם המשתנה: pick0, pick1 וכן
 * הלאה. הקשה על אפס פותחת את העמוד הבא ונקראת למשתנה הבא בתור.
 */
export function pagedChoice(
  params: Record<string, string>,
  prefix: string,
  items: string[],
  pageSize = 9,
): { value: string } | { askText: string; varName: string } {
  let page = 0;
  while (params[`${prefix}${page}`]) page += 1;

  // אין עדיין בחירה בעמוד הזה: מציגים אותו
  const current = page > 0 ? params[`${prefix}${page - 1}`] : null;

  if (current && current !== '0') {
    const chosen = items.slice((page - 1) * pageSize, page * pageSize)[Number(current) - 1];
    if (chosen) return { value: chosen };
  }

  const menu = numberedMenu(items, page, pageSize);
  if (!menu.slice.length) {
    // חזרה לתחילת הרשימה כשהגענו לסופה
    const first = numberedMenu(items, 0, pageSize);
    return { askText: first.text, varName: `${prefix}${page}` };
  }
  return { askText: menu.text, varName: `${prefix}${page}` };
}
