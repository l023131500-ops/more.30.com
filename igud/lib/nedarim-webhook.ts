import { parseDate, parseTime, multi, DAY_SLOTS } from './nedarim.js';
import { layoutOf, type FormKind } from './nedarim-forms';

/**
 * נקודת הקצה מול נדרים פלוס.
 *
 * העיקרון: הזיהוי נעשה לפי התווית בעברית ולא לפי מספר העמודה.
 * נדרים פלוס שולחים לכל שדה גם ערך וגם שם — Field7 לצד Field7_Name —
 * ומכאן נבנית מפה של תווית אל ערך. אם סדר השדות בטופס משתנה אצלם,
 * הקליטה אינה נשברת, וזה ההבדל המהותי מקריאה לפי מיקום.
 *
 * לכל שדה יש כמה תוויות אפשריות, כי אותו שדה מופיע בטפסים השונים
 * בניסוחים שונים. הראשונה שנמצאת מנצחת.
 */

export type FieldMap = Map<string, string>;

/** תוויות מגיעות בכתיבים שונים: רווחים כפולים, נקודתיים, גרשיים. */
function normalizeLabel(label: string): string {
  return String(label || '')
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[:：]\s*$/, '')
    .trim();
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * בניית מפת תווית -> ערך מתוך גוף הפנייה.
 * נתמכים שני מבנים: זוגות FieldN / FieldN_Name, וגם אובייקט שמפתחותיו
 * הם התוויות עצמן — כך שגם שליחה ידנית לבדיקה עובדת.
 */
export function buildFieldMap(body: Record<string, unknown>): FieldMap {
  const map: FieldMap = new Map();

  const put = (label: string, value: unknown) => {
    const key = normalizeLabel(label);
    const val = str(value);
    if (!key || !val) return;
    if (!map.has(key)) map.set(key, val);
  };

  for (const [key, value] of Object.entries(body)) {
    const named = /^Field(\d+)_Name$/.exec(key);
    if (named) {
      put(str(value), body[`Field${named[1]}`]);
      continue;
    }
    if (/^Field\d+$/.test(key) || key === 'type') continue;
    // מפתח שאינו FieldN נחשב תווית בפני עצמה
    put(key, value);
  }

  return map;
}

/** הערך הראשון שנמצא מבין התוויות שנמסרו. */
export function pick(map: FieldMap, ...labels: string[]): string {
  for (const label of labels) {
    const value = map.get(normalizeLabel(label));
    if (value) return value;
  }
  // התאמה חלקית, למקרה שהתווית הורחבה אצלם בסוגריים או בתוספת
  for (const label of labels) {
    const needle = normalizeLabel(label);
    for (const [key, value] of map) {
      if (value && (key.startsWith(needle) || key.includes(needle))) return value;
    }
  }
  return '';
}

/* ============================================================
   פירוק שדות מורכבים
   ============================================================ */

/**
 * "כתובת - מיקום" מגיע לעיתים בשתי שורות: רחוב ומספר בשורה אחת,
 * שכונה בשנייה. מפרקים לשלושה שדות נפרדים במאגר.
 */
export function splitAddress(raw: string): {
  street: string; house_no: string; neighborhood: string;
} {
  const lines = String(raw || '')
    .split(/[\n\r]+|\s\/\s/)
    .map((l) => l.trim())
    .filter(Boolean);

  const first = lines[0] || '';
  const neighborhood = lines.slice(1).join(' ').trim();

  const m = /^(.*?)[\s,]+(\d+[א-ת]?)$/.exec(first);
  if (m) return { street: m[1].trim(), house_no: m[2], neighborhood };
  return { street: first, house_no: '', neighborhood };
}

/** קוד השידור לפי הניסוח בטופס. */
export function broadcastCode(raw: string): 'both' | 'live' | 'recorded' | 'none' {
  const v = String(raw || '');
  const recorded = v.includes('מוקלט');
  const live = v.includes('חי') || v.includes('שידור');
  if (recorded && live) return 'both';
  if (live) return 'live';
  if (recorded) return 'recorded';
  return 'none';
}

/**
 * בניית מועדי השיעור.
 *
 * שלושה מקורות, לפי סדר עדיפות:
 *   1. שעה נפרדת לכל יום, כפי שמופיע בטופס 4320 המלא.
 *   2. רשימת ימים ושעה אחת משותפת — המבנה הנפוץ בפניות מהעמדות.
 *   3. תאריך ושעה, לשיעור חד פעמי.
 */
export function buildOccurrences(map: FieldMap): {
  occurrences: Record<string, unknown>[]; schedule_kind: 'recurring' | 'onetime';
} {
  const occurrences: Record<string, unknown>[] = [];

  // 1. שעה לכל יום
  DAY_SLOTS.forEach((slot: { label: string; weekday: number }, index: number) => {
    const raw = pick(map, `שעה — ${slot.label}`, `שעה - ${slot.label}`, `${slot.label} שעה`);
    if (!raw) return;
    occurrences.push({
      weekday: slot.weekday,
      day_label: slot.label,
      time_of_day: parseTime(raw),
      note: parseTime(raw) ? null : raw,
      sort: index,
    });
  });
  if (occurrences.length) return { occurrences, schedule_kind: 'recurring' };

  // 2. ימים מסומנים ושעה משותפת
  const dayList = multi(pick(
    map,
    'זמנים לשינוי', 'זמנים לשינוי (ניתן לסמן כמה)', 'ימים', 'יום', 'ימים מועדפים', 'תאריך / יום',
  ));
  const sharedRaw = pick(map, 'שעה');
  const sharedTime = parseTime(sharedRaw);

  if (dayList.length) {
    for (const label of dayList) {
      const slot = DAY_SLOTS.find(
        (d: { label: string }) => d.label === label || label.includes(d.label.replace('יום ', '')),
      ) as { label: string; weekday: number } | undefined;
      if (!slot) continue;
      occurrences.push({
        weekday: slot.weekday,
        day_label: slot.label,
        time_of_day: sharedTime,
        note: sharedTime ? null : sharedRaw || null,
        sort: DAY_SLOTS.findIndex((d: { label: string }) => d.label === slot.label),
      });
    }
    if (occurrences.length) return { occurrences, schedule_kind: 'recurring' };
  }

  // 3. שיעור בתאריך מסוים
  const date = parseDate(pick(map, 'תאריך', 'תאריך השיעור'));
  if (date) {
    occurrences.push({
      weekday: null, day_label: null, specific_date: date,
      time_of_day: sharedTime, note: sharedTime ? null : sharedRaw || null, sort: 0,
    });
    return { occurrences, schedule_kind: 'onetime' };
  }

  return { occurrences, schedule_kind: 'recurring' };
}

/* ============================================================
   המרה לרשומות המאגר
   ============================================================ */

export function lessonFromFields(map: FieldMap, externalId: string | null) {
  const address = splitAddress(pick(map, 'כתובת - מיקום', 'כתובת', 'כתובת מיקום'));
  const topics = multi(pick(map, 'נושא השיעור', 'נושאים ללימוד / נושא', 'נושאים', 'נושא'));
  const { occurrences, schedule_kind } = buildOccurrences(map);

  const teacher = pick(map, 'שם הרב', 'שם הרב / איש קשר', 'שם מלא', 'איש קשר');
  const role = pick(map, 'תפקיד הרב', 'תפקיד');

  return {
    external_id: externalId,
    source: 'nedarim',
    teacher_name: teacher || null,
    teacher_suffix: role || null,
    venue_name: pick(map, 'שם בית הכנסת', 'מיקום מדויק', 'שם המקום') || null,
    city: pick(map, 'עיר') || null,
    neighborhood: pick(map, 'שכונה') || address.neighborhood || null,
    street: pick(map, 'רחוב') || address.street || null,
    house_no: pick(map, 'מספר', 'מספר בית') || address.house_no || null,
    topic: topics.find((t: string) => t !== 'אחר') || null,
    topics: topics.filter((t: string) => t !== 'אחר'),
    topic_other: topics.includes('אחר') ? pick(map, 'פרט') || null : null,
    audience_gender: pick(map, 'למי מיועד השיעור', 'מגדר', 'קהל') || null,
    audience_styles: multi(pick(map, 'קהל יעד של השיעור', 'קהל יעד', 'סגנון קהל יעד')),
    language: pick(map, 'באיזה שפה אתם מעוניינים / שפה', 'שפה') || null,
    lesson_style: pick(map, 'אופי השיעורים', 'סגנון השיעור', 'סגנון') || null,
    broadcast: broadcastCode(pick(map, 'באיזה צורה השיעור מועבר', 'אופן העברת השיעור')),
    schedule_kind,
    frequency: pick(map, 'מה תרצו לעדכן', 'קביעות השיעור') || null,
    description: pick(map, 'פרט', 'תיאור') || null,
    season_note: pick(map, 'פרטים לעדכון על שינוי שיעור לפרסום', 'הערות') || null,
    contact_name: pick(map, 'שם הרב / איש קשר', 'איש קשר', 'שם מלא') || teacher || null,
    contact_phone: pick(map, 'טלפון / נייד', 'טלפון', 'נייד') || null,
    contact_email: pick(map, 'מייל / אימייל', 'מייל', 'אימייל') || null,
    organization: pick(map, 'שם הארגון שהקים את השיעור', 'שם הארגון', 'ארגון') || null,
    occurrences,
  };
}

export function requestFromFields(map: FieldMap, externalId: string | null, raw: Record<string, unknown>) {
  return {
    external_id: externalId,
    source: 'nedarim',
    contact_name: pick(map, 'שם הרב', 'איש קשר', 'שם מלא', 'שם פרטי', 'שם') || 'פנייה מנדרים פלוס',
    phone: pick(map, 'טלפון / נייד', 'טלפון', 'נייד', 'טלפון נייד') || null,
    email: pick(map, 'מייל / אימייל', 'מייל', 'אימייל') || null,
    city: pick(map, 'עיר') || null,
    payload: { labels: Object.fromEntries(map), raw },
  };
}

export function subscriberFromFields(map: FieldMap, externalId: string | null) {
  return {
    external_id: externalId,
    full_name: pick(map, 'שם פרטי', 'שם מלא', 'שם') || null,
    phone: pick(map, 'טלפון נייד', 'טלפון / נייד', 'טלפון', 'נייד') || null,
    email: pick(map, 'מייל', 'מייל / אימייל', 'אימייל') || null,
    wants: pick(map, 'מעוניינים לקבל את פרטי השיעור למייל / טלפון')
      ? ['פרטי שיעור למייל או לטלפון'] : [],
    partner: Boolean(pick(map, 'מעוניינים להיות שותפים להפצת התורה')),
    filters: { query: pick(map, 'חיפוש שיעור מתוך המאגר') },
  };
}

/* ============================================================
   התשובה החוזרת לנדרים פלוס: שלוש עשרה עמודות, בסדר קבוע
   ============================================================ */

/** סדר העמודות הוא חלק מהחוזה. אין לשנות אותו בלי תיאום. */
export const SHARE_COLUMNS = [
  'שם הרב', 'נושא השיעור', 'קהל יעד', 'עיר', 'תאריך / יום', 'שעה',
  'כתובת - מיקום', 'שם בית הכנסת', 'שפה', 'סגנון', 'מגדר', 'הערות', 'שם הארגון',
] as const;

export interface ShareLesson {
  teacher_name?: string | null;
  teacher_suffix?: string | null;
  topic?: string | null;
  topics?: string[] | null;
  audience_styles?: string[] | null;
  audience_gender?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  house_no?: string | null;
  venue_name?: string | null;
  language?: string | null;
  lesson_style?: string | null;
  season_note?: string | null;
  description?: string | null;
  organization?: string | null;
  schedule?: { day?: string | null; date?: string | null; time?: string | null; note?: string | null }[] | null;
}

const HEB_DAY_SHORT: Record<string, string> = {
  'יום ראשון': 'ראשון', 'יום שני': 'שני', 'יום שלישי': 'שלישי',
  'יום רביעי': 'רביעי', 'יום חמישי': 'חמישי', 'יום שישי': 'שישי',
  'ליל שבת': 'ליל שבת', 'שבת': 'שבת', 'מוצאי שבת': 'מוצאי שבת',
};

/** "בכל יום שני, רביעי" או תאריך מפורש לשיעור חד פעמי. */
function scheduleLabel(rows: ShareLesson['schedule']): string {
  const list = rows || [];
  const dates = list.map((o) => o.date).filter(Boolean) as string[];
  if (dates.length) {
    return dates.map((d) => d.split('-').reverse().join('/')).join(', ');
  }
  const days = list.map((o) => HEB_DAY_SHORT[o.day || ''] || o.day).filter(Boolean);
  if (!days.length) return '';
  return days.length === 1 ? `בכל יום ${days[0]}` : `בכל יום ${days.join(', ')}`;
}

/** השעות המופיעות בשיעור. אם אין שעה מדויקת, מוחזרת ההערה. */
function timeLabel(rows: ShareLesson['schedule']): string {
  const list = rows || [];
  const times = [...new Set(list.map((o) => (o.time || '').slice(0, 5)).filter(Boolean))];
  if (times.length) return times.join(', ');
  const notes = [...new Set(list.map((o) => o.note).filter(Boolean))];
  return notes.join(', ');
}

/**
 * שורה אחת בתשובה. "שם הרב" חוזר כשם ותפקיד, והכתובת כרחוב ומספר
 * לצד השכונה, כדי שאצלם התא יישב על שתי שורות.
 */
export function toShareRow(lesson: ShareLesson): Record<string, string> {
  const name = [lesson.teacher_name, lesson.teacher_suffix].filter(Boolean).join(' - ');
  const streetLine = [lesson.street, lesson.house_no].filter(Boolean).join(' ');
  const address = [streetLine, lesson.neighborhood].filter(Boolean).join(' / ');
  const topics = (lesson.topics || []).filter(Boolean);

  const row: Record<string, string> = {
    'שם הרב': name,
    'נושא השיעור': lesson.topic || topics[0] || '',
    'קהל יעד': (lesson.audience_styles || []).filter(Boolean).join(', '),
    'עיר': lesson.city || '',
    'תאריך / יום': scheduleLabel(lesson.schedule),
    'שעה': timeLabel(lesson.schedule),
    'כתובת - מיקום': address,
    'שם בית הכנסת': lesson.venue_name || '',
    'שפה': lesson.language || '',
    'סגנון': lesson.lesson_style || '',
    'מגדר': lesson.audience_gender || '',
    'הערות': lesson.season_note || lesson.description || '',
    'שם הארגון': lesson.organization || '',
  };

  // בנייה מחדש לפי הסדר המוסכם, כדי שסדר המפתחות ב-JSON יהיה יציב
  const ordered: Record<string, string> = {};
  for (const col of SHARE_COLUMNS) ordered[col] = row[col] ?? '';
  return ordered;
}

/* ============================================================
   סוגי הפניות
   ============================================================ */

export const INBOUND_TYPES = ['lesson_update', 'lesson', 'seeker_request', 'teacher_request', 'subscriber'] as const;
export const SHARE_TYPES = ['lesson_share', 'synagogue_share', 'event_share', 'portal_share'] as const;

export type InboundType = (typeof INBOUND_TYPES)[number];
export type ShareType = (typeof SHARE_TYPES)[number];

export function isInbound(type: string): type is InboundType {
  return (INBOUND_TYPES as readonly string[]).includes(type);
}
export function isShare(type: string): type is ShareType {
  return (SHARE_TYPES as readonly string[]).includes(type);
}

/* ============================================================
   זיהוי סוג הפנייה
   ============================================================ */

/** סוג הפנייה לפי אופי הטופס אצל נדרים פלוס. */
const KIND_TO_TYPE: Record<FormKind, InboundType> = {
  lesson: 'lesson_update',
  host: 'seeker_request',
  maggid: 'teacher_request',
  subscriber: 'subscriber',
};

/** התוויות שמאחוריהן מסתתר סוג הפנייה בטופס עצמו. */
const TYPE_LABELS = ['type', 'סוג', 'סוג הפנייה', 'סוג פנייה'];

/**
 * זיהוי סוג הפנייה.
 *
 * בטפסים של נדרים פלוס השדה הראשון הוא שדה מוסתר ששמו type, ולכן הוא
 * אינו מגיע כמפתח type בגוף הפנייה אלא כזוג: Field1_Name=type לצד
 * Field1=lesson_update. הקריאה למפתח type בלבד החמיצה אותו, וכל טופס
 * אמיתי נדחה לפני שנבדק. כאן נבדקים ארבעה מקורות, לפי סדר יורד של
 * ודאות, והראשון שנותן סוג מוכר מנצח:
 *
 *   1. type מפורש בגוף הפנייה או בכתובת.
 *   2. תווית type בתוך שדות הטופס.
 *   3. מספר הטופס, כשנדרים פלוס מצרפים אותו.
 *   4. השדות עצמם, לפי צירופים שאין להם משמעות אחרת.
 *
 * מוחזרת גם דרך הזיהוי, כדי שאפשר יהיה לראות ביומן על מה הסתמכנו.
 */
export function resolveType(
  body: Record<string, unknown>, explicit: string,
): { type: string; from: string } {
  if (explicit && (isInbound(explicit) || isShare(explicit))) {
    return { type: explicit, from: 'מפורש' };
  }

  const map = buildFieldMap(body);

  const labelled = pick(map, ...TYPE_LABELS);
  if (labelled && (isInbound(labelled) || isShare(labelled))) {
    return { type: labelled, from: 'שדה מוסתר בטופס' };
  }

  // מספר הטופס. נדרים פלוס אינם עקביים בשם המפתח, ולכן נסרקים כל
  // המפתחות שיש בהם רמז לטופס, והערך נבדק מול הטפסים המוכרים.
  for (const [key, value] of Object.entries(body)) {
    if (!/tofes|form|טופס/i.test(key)) continue;
    const layout = layoutOf(str(value));
    if (layout) return { type: KIND_TO_TYPE[layout.kind], from: `טופס ${layout.form}` };
  }

  // אין סימן מפורש. נותרו השדות עצמם: כל צירוף כאן ייחודי לטופס אחד.
  if (pick(map, 'מעוניינים לקבל את פרטי השיעור למייל / טלפון', 'חיפוש שיעור מתוך המאגר')) {
    return { type: 'subscriber', from: 'שדות הטופס' };
  }
  if (pick(map, 'היכן אתה מעוניין למסור את השיעורים?', 'רקע מגיד שיעור', 'מה התגמול שהיית מצפה לקבל?')) {
    return { type: 'teacher_request', from: 'שדות הטופס' };
  }
  if (pick(map, 'עבור מי אתם מעוניינים לקבוע שיעור?', 'כמה אתם מעוניינים לשלם לרב מגיד השיעור?')) {
    return { type: 'seeker_request', from: 'שדות הטופס' };
  }
  if (pick(map, 'מה תרצו לעדכן', 'נושא השיעור', 'כתובת - מיקום')) {
    return { type: 'lesson_update', from: 'שדות הטופס' };
  }

  return { type: '', from: '' };
}
