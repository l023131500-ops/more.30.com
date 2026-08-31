import type { LessonCard, Occurrence } from './types';
// מודול לוח עברי במימוש עצמאי (הועתק מ-src/hebcal.js), נטען כ-JavaScript
import { dayInfo, absToIso, isoToAbs } from './hebcal.js';

export const DAY_NAMES = [
  'יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי',
  'יום חמישי', 'יום שישי', 'שבת',
] as const;

export const DAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

/** שם יום בטופס נדרים פלוס אל מספר יום בשבוע. */
export const DAY_TO_WEEKDAY: Record<string, number> = {
  'יום ראשון': 0, 'יום שני': 1, 'יום שלישי': 2, 'יום רביעי': 3,
  'יום חמישי': 4, 'יום שישי': 5, 'ליל שבת': 5, 'שבת': 6, 'מוצאי שבת': 6,
};

const TZ = 'Asia/Jerusalem';

/** מנרמל מחרוזת שעה שהוקלדה בטופס חופשי לתבנית HH:MM. */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim();

  const hm = value.match(/^(\d{1,2})[:.](\d{1,2})/);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h <= 23 && m <= 59) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const hourOnly = value.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const h = Number(hourOnly[1]);
    if (h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }

  return null;
}

/** תיאור השעה כפי שיוצג. שעה שאינה מספרית מוצגת כלשונה. */
export function timeLabel(occ: Occurrence): string {
  const t = occ.time ? normalizeTime(occ.time) : null;
  if (t) return t;
  if (occ.time) return String(occ.time);
  if (occ.slot) return occ.slot;
  return 'בתיאום';
}

export function dayLabel(occ: Occurrence): string {
  if (occ.day) return occ.day;
  if (occ.date) return gregLabel(occ.date);
  if (occ.weekday !== null && occ.weekday !== undefined) return DAY_NAMES[occ.weekday];
  return '';
}

/** 'YYYY-MM-DD' אל '27 באפריל 2026'. */
export function gregLabel(iso: string): string {
  try {
    return dayInfo(iso.slice(0, 10)).gregLabel.replace(/^(\d+) /, '$1 ב');
  } catch {
    return iso;
  }
}

/** התאריך העברי של יום לועזי. */
export function hebrewLabel(iso: string): string {
  try {
    return dayInfo(iso.slice(0, 10)).hebLabelFull;
  } catch {
    return '';
  }
}

/** תאריך עברי של היום. */
export function todayHebrew(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return hebrewLabel(parts);
}

function jerusalemParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== 'literal') map[p.type] = p.value;
  return {
    iso: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === '24' ? '00' : map.hour}:${map.minute}`,
  };
}

/**
 * תיאור אנושי של מועד קרוב: "היום 20:30", "מחר 07:45",
 * "יום שלישי 19:00" או תאריך מלא לשיעור רחוק.
 */
export function relativeWhen(nextAt: string | null): { day: string; time: string; soon: boolean } {
  if (!nextAt) return { day: 'בתיאום', time: '', soon: false };

  const target = new Date(nextAt);
  if (Number.isNaN(target.getTime())) return { day: 'בתיאום', time: '', soon: false };

  const now = jerusalemParts(new Date());
  const then = jerusalemParts(target);
  const diffDays = isoToAbs(then.iso) - isoToAbs(now.iso);

  if (diffDays === 0) return { day: 'היום', time: then.time, soon: true };
  if (diffDays === 1) return { day: 'מחר', time: then.time, soon: true };
  if (diffDays > 1 && diffDays < 7) {
    const info = dayInfo(then.iso);
    return { day: DAY_NAMES[info.weekday], time: then.time, soon: diffDays <= 2 };
  }
  return { day: gregLabel(then.iso), time: then.time, soon: false };
}

/** כמה זמן נותר עד המועד, בניסוח קצר. */
export function countdown(nextAt: string | null): string {
  if (!nextAt) return '';
  const ms = new Date(nextAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms < 0) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `בעוד ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `בעוד ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'מחר';
  if (days < 7) return `בעוד ${days} ימים`;
  return '';
}

/** כותרת השיעור: הכותרת שהוזנה, ואם אין, הנושא. */
export function lessonTitle(lesson: Pick<LessonCard, 'title' | 'topic' | 'topic_other' | 'topics'>): string {
  if (lesson.title?.trim()) return lesson.title.trim();
  if (lesson.topic_other?.trim()) return lesson.topic_other.trim();
  if (lesson.topic?.trim()) return lesson.topic.trim();
  if (lesson.topics?.length) return lesson.topics.slice(0, 2).join(' · ');
  return 'שיעור תורה';
}

/** שם הרב עם תואר, בלי לכפול תואר שכבר נכתב. */
export function rabbiName(name: string | null | undefined, honorific = 'הרב'): string {
  const value = (name || '').trim();
  if (!value) return '';
  if (/^(הרב|הגאון|הרה|הרבנית|רבי|הר"ר|מרן)/.test(value)) return value;
  return `${honorific} ${value}`;
}

/** כתובת מלאה מהשדות שהוזנו, ללא רכיבים ריקים או שגויים. */
export function addressLine(lesson: Partial<LessonCard>): string {
  const parts: string[] = [];
  const street = (lesson.street || '').trim();
  const houseNo = (lesson.house_no || '').trim();

  // בטפסים ישנים לעיתים הוזן מספר טלפון בשדה הרחוב או המספר
  const streetValid = street && !/^\d{7,}$/.test(street);
  const houseValid = houseNo && /^\d{1,4}[א-ת]?$/.test(houseNo) && houseNo !== '0';

  if (streetValid) parts.push(houseValid ? `${street} ${houseNo}` : street);
  if (lesson.neighborhood?.trim()) parts.push(lesson.neighborhood.trim());
  if (lesson.city?.trim()) parts.push(lesson.city.trim());
  return parts.join(', ');
}

/** שם המקום להצגה. */
export function placeName(lesson: Partial<LessonCard>): string {
  return (lesson.venue_name || lesson.location_exact || '').trim();
}

export const BROADCAST_LABEL: Record<string, string> = {
  none: 'ללא הקלטה',
  recorded: 'שיעור מוקלט',
  live: 'שידור חי',
  both: 'מוקלט ומשודר בשידור חי',
};

/** ערך הטופס של נדרים פלוס אל הערך הפנימי. */
export function broadcastFromHebrew(raw: string | null | undefined): 'none' | 'recorded' | 'live' | 'both' {
  const v = (raw || '').trim();
  if (!v) return 'none';
  if (v.includes('מוקלט') && v.includes('חי')) return 'both';
  if (v.includes('חי')) return 'live';
  if (v.includes('מוקלט')) return 'recorded';
  return 'none';
}

/** סיכום לוח הזמנים בשורה אחת. */
export function scheduleSummary(lesson: Pick<LessonCard, 'schedule' | 'schedule_kind'>): string {
  const list = lesson.schedule || [];
  if (!list.length) return 'המועד יעודכן';

  if (lesson.schedule_kind === 'onetime') {
    const o = list[0];
    return [o.date ? gregLabel(o.date) : '', timeLabel(o)].filter(Boolean).join(' · ');
  }

  // ימים רצופים באותה שעה מקוצרים לטווח
  const times = new Set(list.map((o) => timeLabel(o)));
  const days = list.map((o) => (o.day || (o.weekday !== null ? DAY_NAMES[o.weekday!] : ''))).filter(Boolean);
  if (times.size === 1 && days.length > 2) {
    return `${days[0]} עד ${days[days.length - 1]} · ${[...times][0]}`;
  }
  return list
    .map((o) => `${(o.day || '').replace('יום ', '')} ${timeLabel(o)}`.trim())
    .join(' · ');
}

/** רשימת ISO של המופעים הקרובים, לצורך יצוא ליומן. */
export function upcomingDates(occ: Occurrence, count = 8): string[] {
  const out: string[] = [];
  if (occ.date) return [occ.date];
  if (occ.weekday === null || occ.weekday === undefined) return out;

  const now = jerusalemParts(new Date());
  let abs = isoToAbs(now.iso);
  while (abs % 7 !== occ.weekday) abs += 1;
  for (let i = 0; i < count; i += 1) out.push(absToIso(abs + i * 7));
  return out;
}

export function digitsOnly(value: string | null | undefined): string {
  return (value || '').replace(/\D+/g, '');
}

/** קישור חיוג נקי. */
export function telHref(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  if (d.length < 7) return null;
  return `tel:${d}`;
}
