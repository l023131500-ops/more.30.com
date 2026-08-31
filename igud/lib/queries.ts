import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonCard, LessonFilters, Taxonomy, Teacher, Venue } from './types';
import { DAY_TO_WEEKDAY } from './format';

export const PAGE_SIZE = 12;

/**
 * לקורא אנונימי יש הרשאת קריאה על עמודות נבחרות בלבד, ולכן אסור לבקש
 * ממנו `select('*')`. אלה העמודות שנועדו לפרסום.
 */
export const TEACHER_PUBLIC_COLUMNS = 'id, slug, full_name, honorific, suffix, city, neighborhood, photo_url, logo_url, bio, background, occupation, organization, languages, topics, extra_skills, speech_style, status';

/**
 * העמודות של תצוגת כרטיסי השיעור. מרוכזות כאן כדי שכל צרכן — הדשבורד,
 * הממשק הציבורי וה-webhook של נדרים פלוס — יבקש בדיוק את אותו סט.
 */
export const LESSON_CARD_COLUMNS = 'id, public_no, title, topic, topic_other, topics, lesson_character, speech_style, description, audience_gender, audience_styles, language, language_other, lesson_style, lesson_style_other, teacher_id, teacher_name, teacher_honorific, teacher_suffix, teacher_occupation, organization, venue_id, venue_name, venue_type, city, neighborhood, street, house_no, location_exact, geo_lat, geo_lng, schedule_kind, frequency, season_note, broadcast, broadcast_url, recording_url, logo_url, image_url, contact_name, featured, views, published_at, status, weekdays, next_at, schedule';

export const VENUE_PUBLIC_COLUMNS = 'id, slug, name, kind, nusach, city, neighborhood, street, house_no, location_exact, gabbai_name, phone, logo_url, photo_url, about, geo_lat, geo_lng, status';

/** בונה שאילתת שיעורים מסוננת על תצוגת הכרטיסים. */
export function lessonQuery(client: SupabaseClient, filters: LessonFilters = {}) {
  let q = client.from('igud_lesson_cards').select('*', { count: 'exact' });

  const term = filters.q?.trim();
  if (term) {
    const safe = term.replace(/[%,()]/g, ' ').trim();
    if (safe) q = q.ilike('search_text', `%${safe.toLowerCase()}%`);
  }
  if (filters.city) q = q.eq('city', filters.city);
  if (filters.topic) q = q.contains('topics', [filters.topic]);
  if (filters.gender) q = q.eq('audience_gender', filters.gender);
  if (filters.language) q = q.eq('language', filters.language);
  if (filters.style) q = q.eq('lesson_style', filters.style);
  if (filters.audience) q = q.contains('audience_styles', [filters.audience]);
  if (filters.venue) q = q.eq('venue_id', filters.venue);
  if (filters.teacher) q = q.eq('teacher_id', filters.teacher);

  if (filters.day) {
    const weekday = DAY_TO_WEEKDAY[filters.day];
    if (weekday !== undefined) q = q.contains('weekdays', [weekday]);
  }

  if (filters.broadcast === 'live') q = q.in('broadcast', ['live', 'both']);
  else if (filters.broadcast === 'recorded') q = q.in('broadcast', ['recorded', 'both']);
  else if (filters.broadcast === 'any') q = q.in('broadcast', ['recorded', 'live', 'both']);

  return q;
}

/** עמוד שיעורים ממוין לפי המועד הקרוב. */
export async function fetchLessons(
  client: SupabaseClient,
  filters: LessonFilters = {},
  page = 0,
  pageSize = PAGE_SIZE,
): Promise<{ rows: LessonCard[]; total: number }> {
  const from = page * pageSize;
  const { data, error, count } = await lessonQuery(client, filters)
    .order('next_at', { ascending: true, nullsFirst: false })
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);
  return { rows: (data || []) as LessonCard[], total: count ?? 0 };
}

/** המופעים הקרובים ביותר, שורה לכל מועד ולא לכל שיעור. */
export async function fetchUpcoming(client: SupabaseClient, limit = 18) {
  const { data, error } = await client
    .from('igud_upcoming')
    .select(
      'lesson_id, title, topic, topic_other, topics, teacher_name, venue_name, ' +
      'location_exact, city, neighborhood, broadcast, logo_url, next_at, ' +
      'day_label, time_of_day, weekday, specific_date, audience_gender',
    )
    .not('next_at', 'is', null)
    .gte('next_at', new Date(Date.now() - 30 * 60_000).toISOString())
    .order('next_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchVenues(client: SupabaseClient, limit = 24): Promise<Venue[]> {
  const { data, error } = await client
    .from('igud_venues')
    .select(VENUE_PUBLIC_COLUMNS)
    .eq('status', 'published')
    .order('name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Venue[];
}

export async function fetchTeachers(client: SupabaseClient, limit = 60): Promise<Teacher[]> {
  const { data, error } = await client
    .from('igud_teachers')
    .select(TEACHER_PUBLIC_COLUMNS)
    .eq('status', 'published')
    .order('full_name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Teacher[];
}

export async function fetchLesson(client: SupabaseClient, id: string): Promise<LessonCard | null> {
  const { data, error } = await client
    .from('igud_lesson_cards')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as LessonCard) || null;
}

/** רשימות הבחירה של הטפסים, מקובצות לפי סוג. */
export async function fetchTaxonomy(client: SupabaseClient): Promise<Taxonomy> {
  const { data, error } = await client
    .from('igud_taxonomy')
    .select('kind, value, sort')
    .eq('active', true)
    .order('kind')
    .order('sort');
  if (error) throw new Error(error.message);

  const out: Taxonomy = {};
  for (const row of data || []) {
    (out[row.kind as string] ||= []).push(row.value as string);
  }
  return out;
}

/** ערים שיש בהן שיעורים בפועל, לפי שכיחות. */
export async function fetchActiveCities(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from('igud_lesson_cards')
    .select('city')
    .not('city', 'is', null)
    .limit(2000);
  if (error) return [];

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const city = (row.city as string)?.trim();
    if (city) counts.set(city, (counts.get(city) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'))
    .map(([city]) => city);
}
