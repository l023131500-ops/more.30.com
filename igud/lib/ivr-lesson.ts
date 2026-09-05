import type { SupabaseClient } from '@supabase/supabase-js';
import { dayLabel, normalizeTime, rabbiName, relativeWhen, timeLabel } from './format';
import { say, sayDigits } from './yemot';
import type { Occurrence } from './types';

/**
 * שיעור באוזן, ולא על המסך.
 *
 * מודול זה עונה על שתי שאלות שאין להן תשובה משותפת עם האתר. הראשונה,
 * מה נאמר ברשימה: שלושה פרטים בלבד, כי מתקשר ששומע תשע אפשרויות
 * מלאות שוכח את הראשונה עד שהגיע לאחרונה. השנייה, מה נאמר אחרי
 * הבחירה: הכול, בסדר שמתאים לאוזן — מי מלמד, מה, מתי, איפה, ולמי —
 * ורק אחר כך הפרטים המשניים.
 *
 * שני כללים חוצים את הקובץ: שדה ריק אינו נאמר, ובוודאי שלא נאמר
 * עליו "לא צוין"; ומספר טלפון נמסר להקראה ספרה אחר ספרה, כי מספר
 * שנקרא כמספר נשמע כמו מיליונים ואי אפשר לרשום אותו.
 */

/** העמודות הדרושות להקראה. נבחרות במפורש, כי select כוכבית מביא גם גיאוגרפיה ותמונות */
export const LESSON_FIELDS = [
  'id', 'public_no', 'title', 'topic', 'topic_other', 'topics',
  'teacher_name', 'teacher_honorific', 'teacher_suffix', 'teacher_occupation',
  'organization', 'venue_name', 'venue_type', 'city', 'neighborhood',
  'street', 'house_no', 'location_exact',
  'audience_gender', 'audience_styles', 'language', 'language_other',
  'lesson_style', 'lesson_style_other', 'lesson_character',
  'broadcast', 'contact_name', 'contact_phone', 'description',
  'schedule_kind', 'frequency', 'season_note', 'next_at', 'schedule',
].join(', ');

export interface LessonRow {
  id: string;
  public_no?: number | null;
  title?: string | null;
  topic?: string | null;
  topic_other?: string | null;
  topics?: string[] | null;
  teacher_name?: string | null;
  teacher_honorific?: string | null;
  teacher_suffix?: string | null;
  teacher_occupation?: string | null;
  organization?: string | null;
  venue_name?: string | null;
  venue_type?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  house_no?: string | null;
  location_exact?: string | null;
  audience_gender?: string | null;
  audience_styles?: string[] | null;
  language?: string | null;
  language_other?: string | null;
  lesson_style?: string | null;
  lesson_style_other?: string | null;
  lesson_character?: string[] | null;
  broadcast?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  description?: string | null;
  schedule_kind?: string | null;
  frequency?: string | null;
  season_note?: string | null;
  next_at?: string | null;
  schedule?: Occurrence[] | null;
}

/* ============================================================
   שעה במילים
   ============================================================ */

const HOUR_WORDS = [
  'שתים עשרה', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש',
  'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה',
];

const MINUTE_WORDS: Record<number, string> = {
  5: 'וחמישה', 10: 'ועשרה', 20: 'ועשרים', 25: 'ועשרים וחמישה',
  35: 'ושלושים וחמישה', 40: 'וארבעים', 50: 'וחמישים', 55: 'וחמישים וחמישה',
};

function partOfDay(hour: number): string {
  if (hour < 5) return 'בלילה';
  if (hour < 12) return 'בבוקר';
  if (hour < 16) return 'בצהריים';
  if (hour < 18) return 'אחר הצהריים';
  if (hour < 22) return 'בערב';
  return 'בלילה';
}

/**
 * שעה במילים, כפי שאדם אומר אותה.
 *
 * מנוע ההקראה יודע לקרוא 20:15, אבל הוא קורא את זה כמו מכונה. אדם
 * אומר "שמונה ורבע בערב", ומי שמאזין למערכת קולית צריך לשמוע אדם.
 * ארבעים וחמש דקות נאמרות "רבע ל", כי כך אומרים.
 */
export function timeInWords(raw: string | null | undefined): string {
  const clean = normalizeTime(raw || '');
  if (!clean) return '';
  const [h, m] = clean.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';

  const suffix = partOfDay(h);

  if (m === 45) {
    const next = (h + 1) % 24;
    return `רבע ל${HOUR_WORDS[next % 12]} ${partOfDay(next)}`;
  }

  const hour = HOUR_WORDS[h % 12];
  if (m === 0) return `${hour} ${suffix}`;
  if (m === 15) return `${hour} ורבע ${suffix}`;
  if (m === 30) return `${hour} וחצי ${suffix}`;

  const minutes = MINUTE_WORDS[m] || `ו${m}`;
  return `${hour} ${minutes} ${suffix}`;
}

/**
 * החלפת כל שעה בתוך טקסט חופשי בשעה במילים.
 *
 * חלק מהתיאורים מגיעים מוכנים מהמסד — "יום שלישי בשעה 20:15" — ונאמרו
 * עד כה כמספר. אותו שיעור נשמע מילולית בשלוחה אחת וכמכונה באחרת, וזה
 * בדיוק סוג חוסר העקביות שהמאזין שם לב אליו גם כשאינו יודע להסביר.
 */
export function spokenTimes(text: string): string {
  return String(text || '').replace(/\b(\d{1,2}):(\d{2})\b/g, (all, h, m) => (
    timeInWords(`${h}:${m}`) || all
  ));
}

/** מתי מתקיים השיעור, במשפט אחד. עד שלושה מועדים, ואחריהם "ועוד מועדים" */
export function whenInWords(row: LessonRow): string {
  const list = (row.schedule || []).filter(Boolean);

  if (list.length) {
    const parts = list.slice(0, 3).map((occ) => {
      const day = dayLabel(occ);
      const time = timeInWords(occ.time) || timeLabel(occ);
      if (day && time) return `ב${day.replace(/^ב/, '')} בשעה ${time}`;
      if (day) return `ב${day.replace(/^ב/, '')}`;
      return time ? `בשעה ${time}` : '';
    }).filter(Boolean);

    if (parts.length) {
      const more = list.length > 3 ? ', ועוד מועדים' : '';
      return `${parts.join(', ')}${more}`;
    }
  }

  if (row.next_at) {
    const when = relativeWhen(row.next_at);
    const time = timeInWords(when.time);
    return time ? `${when.day} בשעה ${time}` : when.day;
  }

  return '';
}

/* ============================================================
   הרשימה: שלושה פרטים בלבד
   ============================================================ */

/** נושא השיעור, מתוך הכותרת או הנושא או הנושא החופשי */
export function subjectOf(row: LessonRow): string {
  return (row.title || row.topic || row.topic_other || row.topics?.[0] || '').trim();
}

/** שם הרב עם תוארו */
export function teacherOf(row: LessonRow): string {
  return rabbiName(row.teacher_name, row.teacher_honorific || 'הרב');
}

/**
 * שורה ברשימת התוצאות: שם הרב, תפקידו, ונושא השיעור. לא יותר.
 *
 * זו החלטה שנשמעת קטנה ואינה כזו. רשימה שבה כל פריט הוא ארבע שורות
 * היא רשימה שאיש אינו מגיע לסופה. הפרטים המלאים ממתינים אחרי הבחירה,
 * ומי שרוצה אותם מקיש מספר.
 */
export function listLine(row: LessonRow): string {
  const parts = [teacherOf(row) || 'שיעור תורה'];
  if (row.teacher_occupation?.trim()) parts.push(row.teacher_occupation.trim());
  const subject = subjectOf(row);
  if (subject) parts.push(`בנושא ${subject}`);
  return parts.join(', ');
}

/* ============================================================
   הפרטים המלאים, בסדר שמתאים לאוזן
   ============================================================ */

function audienceLine(row: LessonRow): string {
  const bits: string[] = [];
  if (row.audience_gender?.trim()) bits.push(`מיועד ל${row.audience_gender.trim()}`);

  const language = (row.language === 'אחר' ? row.language_other : row.language)?.trim();
  if (language) bits.push(`ב${language}`);

  const style = (row.lesson_style === 'אחר' ? row.lesson_style_other : row.lesson_style)?.trim();
  if (style && style !== 'מתאים לכולם') bits.push(`בסגנון ${style}`);
  else if (style === 'מתאים לכולם') bits.push('ומתאים לכולם');

  return bits.length ? `השיעור ${bits.join(', ')}` : '';
}

/**
 * הכתובת כפי שאומרים אותה, ולא כפי שכותבים אותה.
 *
 * "הרב קוק 12" נכון על מסך ובלתי מובן באוזן. באוזן זה "רחוב הרב קוק
 * שתים עשרה", ומנוע ההקראה יודע להפוך את המספר למילים בעצמו — הוא
 * צריך רק שנאמר לו שמדובר ברחוב. אותו דבר בשכונה.
 *
 * הבדיקות של addressLine נשמרות: בטפסים ישנים הוזן לעיתים מספר טלפון
 * בשדה הרחוב, ואין סיבה להקריא אותו כאילו הוא כתובת.
 */
function spokenAddress(row: LessonRow): string {
  const parts: string[] = [];
  const street = (row.street || '').trim();
  const houseNo = (row.house_no || '').trim();

  const streetValid = street && !/^\d{7,}$/.test(street);
  const houseValid = houseNo && /^\d{1,4}[\u05D0-\u05EA]?$/.test(houseNo) && houseNo !== '0';

  if (streetValid) parts.push(`רחוב ${street}${houseValid ? ` ${houseNo}` : ''}`);
  if (row.neighborhood?.trim()) parts.push(`שכונת ${row.neighborhood.trim()}`);
  if (row.city?.trim()) parts.push(row.city.trim());
  return parts.join(', ');
}

function placeLine(row: LessonRow): string {
  const place = (row.venue_name || row.location_exact || '').trim();
  const address = spokenAddress(row);
  if (place && address) return `ב${place}, ${address}`;
  if (place) return `ב${place}`;
  if (address) return `ב${address}`;
  return '';
}

const BROADCAST_SPOKEN: Record<string, string> = {
  live: 'השיעור מועבר גם בשידור חי',
  recorded: 'השיעור מוקלט וניתן לשמוע אותו גם אחר כך',
  both: 'השיעור מועבר בשידור חי וגם מוקלט',
};

/**
 * הפרטים המלאים של שיעור, כרצף פקודות השמעה.
 *
 * מוחזר מערך של פקודות ולא מחרוזת אחת, כי מספר הטלפון חייב פקודת
 * השמעה משלו — ספרה אחר ספרה. respond מאחד ממילא פקודות השמעה
 * סמוכות, ולכן המתקשר שומע רצף אחד רציף.
 */
export function detailSpeech(row: LessonRow): string[] {
  const out: string[] = [];

  /* ---------- העיקר ---------- */
  const head = [teacherOf(row), row.teacher_occupation?.trim()].filter(Boolean).join(', ');
  if (head) out.push(say(head));

  const subject = subjectOf(row);
  if (subject) out.push(say(`בנושא ${subject}`));

  const when = whenInWords(row);
  if (when) out.push(say(when));

  const where = placeLine(row);
  if (where) out.push(say(where));

  const audience = audienceLine(row);
  if (audience) out.push(say(audience));

  /* ---------- המשני ---------- */
  const broadcast = BROADCAST_SPOKEN[row.broadcast || ''];
  if (broadcast) out.push(say(broadcast));

  if (row.frequency?.trim() && row.frequency.trim() !== 'שבועי') {
    out.push(say(`השיעור מתקיים ${row.frequency.trim()}`));
  }
  if (row.season_note?.trim()) out.push(say(row.season_note.trim()));
  if (row.organization?.trim()) out.push(say(`מאורגן על ידי ${row.organization.trim()}`));

  const phone = String(row.contact_phone || '').replace(/\D/g, '');
  if (phone.length >= 7) {
    const who = row.contact_name?.trim();
    out.push(say(who ? `לפרטים נוספים אפשר להתקשר ל${who}, במספר` : 'לפרטים נוספים אפשר להתקשר למספר'));
    out.push(sayDigits(phone));
  }

  return out.filter(Boolean);
}

/* ============================================================
   החיפוש עצמו
   ============================================================ */

export interface SearchFilter {
  city?: string;
  topic?: string;
  teacher?: string;
  /**
   * מילות מפתח, כשאף שדה מובנה לא זוהה.
   *
   * כל מילה היא תנאי בפני עצמו, וכולן נדרשות יחד. זה נשמע מחמיר וזה
   * מה שנכון כאן: "דף יומי בני ברק" שמחזיר כל שיעור שיש בו המילה
   * "יומי" אינו תשובה, הוא רעש.
   */
  words?: string[];
}

/** האם יש כאן בכלל לפי מה לסנן. מסנן ריק אינו "הכול" אלא "לא הבנתי" */
export function hasAny(filter: SearchFilter): boolean {
  return Boolean(filter.city || filter.topic || filter.teacher || filter.words?.length);
}

/**
 * פירוק משפט למילות חיפוש.
 *
 * מילות קישור נזרקות, כי הן מופיעות כמעט בכל שיעור ואינן מצמצמות
 * דבר. נשמרות שלוש מילים לכל היותר: מעבר לזה החיפוש מפסיק למצוא.
 */
const STOP_WORDS = new Set([
  'של', 'עם', 'על', 'את', 'אני', 'מחפש', 'מחפשת', 'רוצה', 'שיעור', 'שיעורים',
  'בבקשה', 'תודה', 'לי', 'יש', 'איזה', 'איזו', 'הרב', 'רב', 'בנושא', 'נושא',
  'בעיר', 'עיר', 'ליד', 'אזור', 'תורה',
]);

export function keywordsOf(text: string): string[] {
  return String(text || '')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stripPrefix)
    .filter((w) => w.length > 1)
    .slice(0, 3);
}

/**
 * הסרת אות שימוש מתחילת מילה.
 *
 * "בבני ברק" מגיע מהתמלול כשתי מילים, והראשונה שבהן היא "בבני" —
 * שאינה מופיעה בשום שיעור. בלי ההסרה הזו כל חיפוש שמתחיל ב"ב" נכשל,
 * וזה כמעט כל חיפוש לפי עיר. מילים קצרות אינן נוגעות, כי שם ההסרה
 * עלולה למחוק את המילה עצמה.
 */
function stripPrefix(word: string): string {
  if (word.length <= 3) return word;
  return /^[בלמהוכש]/.test(word) ? word.slice(1) : word;
}

function applyFilter<T>(query: T, filter: SearchFilter): T {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let q = query as any;
  if (filter.city) q = q.eq('city', filter.city);
  if (filter.topic) q = q.contains('topics', [filter.topic]);
  if (filter.teacher) q = q.ilike('teacher_name', `%${filter.teacher}%`);
  for (const word of filter.words || []) q = q.ilike('search_text', `%${word.toLowerCase()}%`);
  return q as T;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * כמה שיעורים עונים לחיפוש. ספירה בלבד, בלי להביא אותם.
 *
 * המערכת אומרת "נמצאו ארבעה עשר שיעורים" לפני שהיא מקריאה משהו,
 * והמספר הזה חייב להיות המספר האמיתי ולא אורך העמוד הראשון.
 */
export async function countLessons(
  client: SupabaseClient, filter: SearchFilter,
): Promise<number> {
  if (!hasAny(filter)) return 0;
  const base = client.from('igud_lesson_cards').select('id', { count: 'exact', head: true });
  const { count } = await applyFilter(base, filter);
  return count || 0;
}

/** עמוד אחד מתוך תוצאות החיפוש, לפי סדר הקרוב ביותר */
export async function pageOfLessons(
  client: SupabaseClient, filter: SearchFilter, page = 0, size = 9,
): Promise<LessonRow[]> {
  if (!hasAny(filter)) return [];
  const base = client
    .from('igud_lesson_cards')
    .select(LESSON_FIELDS)
    .order('next_at', { ascending: true, nullsFirst: false })
    .order('public_no', { ascending: true })
    .range(page * size, page * size + size - 1);

  const { data } = await applyFilter(base, filter);
  return (data as unknown as LessonRow[]) || [];
}

/** שיעור בודד לפי מזהה, לצורך הקראת הפרטים המלאים */
export async function lessonById(
  client: SupabaseClient, id: string,
): Promise<LessonRow | null> {
  const { data } = await client
    .from('igud_lesson_cards')
    .select(LESSON_FIELDS)
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as LessonRow) || null;
}

/**
 * לפי מה אפשר לצמצם רשימה ארוכה.
 *
 * מי שחיפש לפי עיר יצמצם לפי נושא, ומי שחיפש לפי נושא יצמצם לפי עיר.
 * מוצעים רק ערכים שבאמת מופיעים בתוצאות, כדי שבחירה לעולם לא תוביל
 * לרשימה ריקה — וזה ההבדל בין צמצום שעוזר לצמצום שמעצבן.
 */
export async function narrowOptions(
  client: SupabaseClient, filter: SearchFilter, by: 'city' | 'topic' | 'teacher',
): Promise<string[]> {
  if (!hasAny(filter)) return [];
  const column = by === 'topic' ? 'topics' : by === 'teacher' ? 'teacher_name' : 'city';
  const base = client.from('igud_lesson_cards').select(column).limit(800);
  const { data } = await applyFilter(base, filter);

  const tally = new Map<string, number>();
  for (const row of (data as Record<string, unknown>[]) || []) {
    const value = row[column];
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) {
      const clean = String(item || '').trim();
      if (clean) tally.set(clean, (tally.get(clean) || 0) + 1);
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'))
    .slice(0, 36)
    .map(([value]) => value);
}

/**
 * התאמת מה שנאמר לערך שקיים במאגר.
 *
 * "בני ברק" שנאמר בטלפון עשוי לחזור מהתמלול כ"בני-ברק" או "בניברק",
 * ושדה עיר מסונן בשוויון מדויק. לכן מה שנאמר מותאם קודם לרשימת
 * הערכים הקיימים, ורק אם אין התאמה נופלים לחיפוש חופשי — שם אי־דיוק
 * עולה פחות.
 */
export function matchOne(options: string[], spoken: string): string | null {
  const norm = (v: string) => String(v || '').replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '');
  const target = norm(spoken);
  if (!target) return null;

  const exact = options.find((o) => norm(o) === target);
  if (exact) return exact;

  const inside = options.find((o) => norm(o).length > 2 && target.includes(norm(o)));
  if (inside) return inside;

  const wider = options.find((o) => target.length > 2 && norm(o).includes(target));
  return wider || null;
}
