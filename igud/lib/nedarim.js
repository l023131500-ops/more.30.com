/**
 * מיפוי ייצוא הטפסים של נדרים פלוס אל מבנה הנתונים של איגוד השיעורים.
 *
 * הטפסים:
 *   4320 — עדכון שיעור קיים לפרסום
 *   4063 — בקשה למגיד שיעור (בית כנסת / יחיד / מרכז תורני)
 *   4018 — רישום כמגיד שיעור
 *   4357 — חיפוש שיעור והרשמה לעדכונים
 *
 * המודול מקבל גיליון כמערך שורות (מערכי מחרוזות) ולכן משמש גם את הייבוא
 * בדפדפן (מסך הניהול) וגם את סקריפט הייבוא ב-Node.
 */

/** אינדקס עמודה לפי אות: 'A' -> 0, 'AB' -> 27 */
export function col(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const at = (row, letters) => String(row[col(letters)] ?? '').trim();

/** '*א, *ב' -> ['א', 'ב'] */
export function multi(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((p) => p.trim().replace(/^\*/, '').trim())
    .filter(Boolean);
}

/**
 * סדר תיבות הימים בטופס 4320, ומולן עמודות השעה AC..AK.
 * הסדר קבוע: כל יום תופס משבצת משלו גם אם לא סומן.
 */
export const DAY_SLOTS = [
  { label: 'יום ראשון', weekday: 0, timeCol: 'AC' },
  { label: 'יום שני', weekday: 1, timeCol: 'AD' },
  { label: 'יום שלישי', weekday: 2, timeCol: 'AE' },
  { label: 'יום רביעי', weekday: 3, timeCol: 'AF' },
  { label: 'יום חמישי', weekday: 4, timeCol: 'AG' },
  { label: 'יום שישי', weekday: 5, timeCol: 'AH' },
  { label: 'ליל שבת', weekday: 5, timeCol: 'AI' },
  { label: 'שבת', weekday: 6, timeCol: 'AJ' },
  { label: 'מוצאי שבת', weekday: 6, timeCol: 'AK' },
];

/** ערכי בדיקה וקלט חסר משמעות שאין להעלות לאתר. */
const NOISE = /^(בדיקה\d*|test|אין|לא ידוע|לא רלוונטי|[-.\u05f3\u05f4]+)$/i;

/** אותיות סופיות והצורה הרגילה שלהן. */
const NON_FINAL_AT_END = /[כמנפצ]$/;
const FINAL_IN_MIDDLE = /[ךםןףץ](?!$)/;
const TRIPLE = /(.)\1\1/;

/**
 * בודק אם מילה בודדת נראית כהקשה אקראית ולא כמילה עברית.
 * הסימנים: אורך קצר מדי, אות שחוזרת שלוש פעמים, אות סופית באמצע,
 * אות רגילה במקום סופית בסוף, או מגוון אותיות נמוך.
 */
function wordLooksRandom(word) {
  if (word.length <= 2) return true;
  if (TRIPLE.test(word)) return true;
  if (FINAL_IN_MIDDLE.test(word)) return true;
  if (word.length >= 4 && NON_FINAL_AT_END.test(word)) return true;

  const distinct = new Set(word).size;
  if (word.length >= 3 && distinct / word.length < 0.7) return true;

  // מילה עברית כמעט תמיד מכילה לפחות אחת מאותיות אהו"י
  if (word.length >= 4 && !/[אהוי]/.test(word)) return true;

  return false;
}

/** מזהה טקסט שאינו שם אמיתי: ערך בדיקה, מספר בלבד או הקשה אקראית. */
export function looksLikeNoise(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (NOISE.test(v)) return true;
  if (/^\d+$/.test(v)) return true;
  if (!/[א-ת]/.test(v)) return false; // שם לועזי, לא נשפוט אותו

  const words = v.split(/[\s'"״׳()\-]+/).filter((w) => /^[א-ת]+$/.test(w) && w.length > 1);
  if (!words.length) return true;

  // צירוף של כמה מילים סבירות הוא שם תקין גם אם אחת מהן קצרה
  const random = words.filter(wordLooksRandom).length;
  return random === words.length;
}

/** 'DD/MM/YYYY' או 'DD/MM/YY' -> 'YYYY-MM-DD', או null אם אינו תקין. */
export function parseDate(value) {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(String(value || '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** שעה חופשית -> 'HH:MM' או null. */
export function parseTime(value) {
  const v = String(value || '').trim();
  const hm = /^(\d{1,2})[:.](\d{1,2})/.exec(v);
  if (hm) {
    const h = Number(hm[1]);
    const min = Number(hm[2]);
    if (h <= 23 && min <= 59) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const hourOnly = /^(\d{1,2})$/.exec(v);
  if (hourOnly && Number(hourOnly[1]) <= 23) return `${hourOnly[1].padStart(2, '0')}:00`;
  return null;
}

function broadcastCode(raw) {
  const v = String(raw || '');
  const recorded = v.includes('מוקלט');
  const live = v.includes('חי');
  if (recorded && live) return 'both';
  if (live) return 'live';
  if (recorded) return 'recorded';
  return 'none';
}

const CITY_FIX = {
  'Petah Tikva': 'פתח תקווה',
  'petah tikva': 'פתח תקווה',
  'ירושליים': 'ירושלים',
  'מודיען עילית': 'מודיעין עילית',
  'בב': 'בני ברק',
};

function cleanCity(value) {
  const v = String(value || '').trim();
  return CITY_FIX[v] || v;
}

/**
 * טופס 4320 — שיעור לפרסום.
 * מקבל את שורות הגיליון (כולל 3 שורות הכותרת) ומחזיר רשומות מנורמלות.
 */
export function parse4320(rows) {
  const out = [];

  for (const row of rows.slice(3)) {
    if (!row || !row.length) continue;

    const kind = at(row, 'Z');
    const isOneTime = kind === 'שיעור בתאריך מסוים';
    const dayLabels = multi(at(row, 'AL'));
    const occurrences = [];

    if (isOneTime) {
      const date = parseDate(at(row, 'AA'));
      const rawTime = at(row, 'AB');
      occurrences.push({
        weekday: null,
        day_label: null,
        specific_date: date,
        time_of_day: parseTime(rawTime),
        note: parseTime(rawTime) ? null : rawTime || null,
        sort: 0,
      });
    } else {
      DAY_SLOTS.forEach((slot, index) => {
        const rawTime = at(row, slot.timeCol);
        const marked = dayLabels.includes(slot.label);
        if (!marked && !rawTime) return;
        occurrences.push({
          weekday: slot.weekday,
          day_label: slot.label,
          specific_date: null,
          time_of_day: parseTime(rawTime),
          note: parseTime(rawTime) ? null : rawTime || null,
          sort: index,
        });
      });
    }

    const topics = multi(at(row, 'I'));
    const teacherName = at(row, 'U');
    const venueName = at(row, 'T');

    out.push({
      external_id: at(row, 'A') || null,
      topics: topics.filter((t) => t !== 'אחר'),
      topic: topics.find((t) => t !== 'אחר') || null,
      topic_other: topics.includes('אחר') ? at(row, 'H') || null : null,
      audience_gender: at(row, 'O') || null,
      audience_styles: multi(at(row, 'Q')),
      language: at(row, 'R') || null,
      lesson_style: at(row, 'S') || null,
      venue_name: venueName || null,
      teacher_name: teacherName || null,
      city: cleanCity(at(row, 'V')) || null,
      neighborhood: at(row, 'W') || null,
      street: at(row, 'X') || null,
      house_no: at(row, 'Y') || null,
      schedule_kind: isOneTime ? 'onetime' : 'recurring',
      frequency: kind || null,
      occurrences,
      broadcast: broadcastCode(at(row, 'AM')),
      description: at(row, 'AN') || null,
      season_note: at(row, 'AO') || null,
      contact_name: at(row, 'AP') || null,
      contact_phone: at(row, 'AQ') || null,
      contact_email: at(row, 'AR') || null,
      organization: at(row, 'AS') || null,
      /** רשומה נחשבת ראויה לפרסום רק אם יש שם רב ומקום אמיתיים ומועד אחד לפחות */
      publishable:
        !looksLikeNoise(teacherName) &&
        !looksLikeNoise(venueName) &&
        occurrences.some((o) => o.time_of_day || o.note),
    });
  }

  return out;
}

/** טופס 4063 — בקשה למגיד שיעור. */
export function parse4063(rows) {
  return rows.slice(3).filter((r) => r && r.length).map((row) => ({
    external_id: at(row, 'A') || null,
    kind: 'open_lesson',
    contact_name: at(row, 'G') || null,
    phone: at(row, 'H') || null,
    email: at(row, 'I') || null,
    city: cleanCity(at(row, 'N')) || null,
    payload: {
      requesterType: at(row, 'F'),
      locationExact: at(row, 'J'),
      date: at(row, 'K'),
      time: at(row, 'L'),
      lessonStyle: at(row, 'M'),
      neighborhood: at(row, 'O'),
      street: at(row, 'P'),
      familyServices: at(row, 'Q'),
      synagogueName: at(row, 'R'),
      gabbaiName: at(row, 'S'),
      nusach: at(row, 'T'),
      congregants: at(row, 'U'),
      activityLevel: at(row, 'V'),
      activityDetail: at(row, 'W'),
      existingLessons: at(row, 'X'),
      needsMoreServices: at(row, 'Y'),
      servicesDetail: at(row, 'Z'),
      familyStyle: at(row, 'AB'),
      audienceGender: at(row, 'AC'),
      language: at(row, 'AD'),
      audienceStyles: multi(at(row, 'AF')),
      topics: multi(at(row, 'AH')),
      rabbiBackground: at(row, 'AJ'),
      lessonCharacter: multi(at(row, 'AL')),
      speechStyle: multi(at(row, 'AN')),
      venueTypes: multi(at(row, 'AP')),
      frequency: at(row, 'AQ'),
      preferredDays: multi(at(row, 'AR')),
      preferredSlots: multi(at(row, 'AT')),
      payerOffer: at(row, 'AU'),
    },
  }));
}

/** טופס 4018 — רישום כמגיד שיעור. */
export function parse4018(rows) {
  return rows.slice(3).filter((r) => r && r.length).map((row) => ({
    external_id: at(row, 'A') || null,
    kind: 'maggid',
    contact_name: at(row, 'G') || null,
    phone: at(row, 'H') || null,
    email: at(row, 'J') || null,
    city: cleanCity(at(row, 'I')) || null,
    payload: {
      birthDate: at(row, 'K'),
      maritalStatus: at(row, 'L'),
      questionnaire: at(row, 'M'),
      pastYeshiva: at(row, 'N'),
      background: at(row, 'O'),
      occupation: at(row, 'P'),
      topics: multi(at(row, 'S')),
      hasTraining: at(row, 'T'),
      hasPublicSpeaking: at(row, 'U'),
      audienceGender: at(row, 'V'),
      languages: multi(at(row, 'W')),
      audienceStyles: multi(at(row, 'Y')),
      lessonCharacter: multi(at(row, 'AA')),
      speechStyle: multi(at(row, 'AC')),
      venueTypes: multi(at(row, 'AE')),
      extraSkills: multi(at(row, 'AH')),
      preferredDays: multi(at(row, 'AI')),
      preferredSlots: multi(at(row, 'AJ')),
      availabilityNote: at(row, 'AK'),
      travelRange: at(row, 'AL'),
      travel: at(row, 'AM'),
      payExpectation: at(row, 'AN'),
      references: [
        { name: at(row, 'AO'), role: at(row, 'AP'), phone: at(row, 'AQ') },
        { name: at(row, 'AR'), role: at(row, 'AS'), phone: at(row, 'AT') },
      ].filter((r) => r.name),
    },
  }));
}

/** טופס 4357 — הרשמה לקבלת פרטי שיעורים. */
export function parse4357(rows) {
  return rows.slice(3).filter((r) => r && r.length).map((row) => ({
    external_id: at(row, 'A') || null,
    full_name: at(row, 'I') || null,
    phone: at(row, 'K') || null,
    email: at(row, 'L') || null,
    wants: at(row, 'H') ? ['פרטי שיעור למייל או לטלפון'] : [],
    partner: Boolean(at(row, 'M')),
    filters: { query: at(row, 'G') },
  }));
}

export const FORM_PARSERS = {
  4320: parse4320,
  4063: parse4063,
  4018: parse4018,
  4357: parse4357,
};

/** מזהה את מספר הטופס מתוך שורת הכותרת הראשונה. */
export function detectForm(rows) {
  const header = String(rows?.[0]?.[0] || '');
  const m = /(\d{4})/.exec(header);
  return m ? m[1] : null;
}
