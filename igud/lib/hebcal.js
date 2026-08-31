/**
 * hebcal.js — המרת תאריכים עברי/לועזי + חגי ישראל
 * מימוש עצמאי ללא ספריות חיצוניות (אלגוריתם הלל הזקן / Calendrical Calculations).
 * כל התאריכים הלועזיים הם פרולפטיים-גרגוריאניים. "absolute" = מספר ימים מ־1.1.0001.
 */

/* ============================ לועזי <-> absolute ============================ */

const GREG_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isGregLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInGregMonth(y, m) {
  if (m === 2 && isGregLeap(y)) return 29;
  return GREG_MONTH_DAYS[m - 1];
}

/** תאריך לועזי (y,m,d) -> מספר יום אבסולוטי */
export function gregToAbs(y, m, d) {
  let days = d;
  for (let i = 1; i < m; i++) days += daysInGregMonth(y, i);
  const py = y - 1;
  days += 365 * py + Math.floor(py / 4) - Math.floor(py / 100) + Math.floor(py / 400);
  return days;
}

/** מספר יום אבסולוטי -> {y,m,d} לועזי */
export function absToGreg(abs) {
  let y = Math.floor(abs / 366) || 1;
  while (gregToAbs(y + 1, 1, 1) <= abs) y++;
  let m = 1;
  while (m < 12 && gregToAbs(y, m + 1, 1) <= abs) m++;
  const d = abs - gregToAbs(y, m, 1) + 1;
  return { y, m, d };
}

/* ============================== לוח עברי ============================== */

/** האם שנה עברית מעוברת */
export function isHebLeapYear(year) {
  return ((7 * year + 1) % 19) < 7;
}

/** מספר החודש האחרון בשנה עברית (12 רגילה / 13 מעוברת) */
export function lastMonthOfHebYear(year) {
  return isHebLeapYear(year) ? 13 : 12;
}

/** ימים שחלפו מבריאת העולם עד א' תשרי של השנה (חשבון המולד + דחיות) */
export function hebElapsedDays(year) {
  const monthsElapsed =
    235 * Math.floor((year - 1) / 19) +
    12 * ((year - 1) % 19) +
    Math.floor((((year - 1) % 19) * 7 + 1) / 19);
  const partsElapsed = 204 + 793 * (monthsElapsed % 1080);
  const hoursElapsed =
    5 + 12 * monthsElapsed + 793 * Math.floor(monthsElapsed / 1080) + Math.floor(partsElapsed / 1080);
  const conjunctionDay = 1 + 29 * monthsElapsed + Math.floor(hoursElapsed / 24);
  const conjunctionParts = 1080 * (hoursElapsed % 24) + (partsElapsed % 1080);

  let altDay;
  if (
    conjunctionParts >= 19440 ||
    (conjunctionDay % 7 === 2 && conjunctionParts >= 9924 && !isHebLeapYear(year)) ||
    (conjunctionDay % 7 === 1 && conjunctionParts >= 16789 && isHebLeapYear(year - 1))
  ) {
    altDay = conjunctionDay + 1; // דחיית מולד זקן / ג"ט ר"ד / בט"ו תקפ"ט
  } else {
    altDay = conjunctionDay;
  }
  // דחיית לא אד"ו ראש
  if (altDay % 7 === 0 || altDay % 7 === 3 || altDay % 7 === 5) altDay++;
  return altDay;
}

/** מספר הימים בשנה עברית (353/354/355/383/384/385) */
export function daysInHebYear(year) {
  return hebElapsedDays(year + 1) - hebElapsedDays(year);
}

export function isLongCheshvan(year) {
  return daysInHebYear(year) % 10 === 5;
}
export function isShortKislev(year) {
  return daysInHebYear(year) % 10 === 3;
}

/** מספר ימים בחודש עברי. חודשים: ניסן=1 ... אדר=12, אדר ב'=13, תשרי=7 */
export function daysInHebMonth(year, month) {
  if (
    month === 2 || month === 4 || month === 6 || month === 10 || month === 13 ||
    (month === 12 && !isHebLeapYear(year)) ||
    (month === 8 && !isLongCheshvan(year)) ||
    (month === 9 && isShortKislev(year))
  ) {
    return 29;
  }
  return 30;
}

/** תאריך עברי -> absolute */
export function hebToAbs(year, month, day) {
  let abs = day;
  if (month < 7) {
    const last = lastMonthOfHebYear(year);
    for (let m = 7; m <= last; m++) abs += daysInHebMonth(year, m);
    for (let m = 1; m < month; m++) abs += daysInHebMonth(year, m);
  } else {
    for (let m = 7; m < month; m++) abs += daysInHebMonth(year, m);
  }
  return abs + hebElapsedDays(year) - 1373429;
}

/** absolute -> תאריך עברי {y,m,d} */
export function absToHeb(abs) {
  let year = Math.floor((abs + 1373429) / 366);
  while (hebToAbs(year + 1, 7, 1) <= abs) year++;
  let month = abs < hebToAbs(year, 1, 1) ? 7 : 1;
  while (abs > hebToAbs(year, month, daysInHebMonth(year, month))) month++;
  const day = abs - hebToAbs(year, month, 1) + 1;
  return { y: year, m: month, d: day };
}

/* ============================== שמות ותצוגה ============================== */

export const HEB_MONTH_NAMES = {
  1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'אב', 6: 'אלול',
  7: 'תשרי', 8: 'חשון', 9: 'כסלו', 10: 'טבת', 11: 'שבט',
  12: 'אדר', 13: 'אדר ב׳',
};

export function hebMonthName(year, month) {
  if (month === 12 && isHebLeapYear(year)) return 'אדר א׳';
  return HEB_MONTH_NAMES[month];
}

export const GREG_MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const GEMATRIA_HUNDREDS = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק']];
const GEMATRIA_TENS = [[90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י']];
const GEMATRIA_ONES = [[9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];

/** מספר -> אותיות (גימטריה), עם גרש/גרשיים */
export function toGematria(num, withPunct = true) {
  let n = num;
  let out = '';
  while (n >= 100) {
    let matched = false;
    for (const [v, l] of GEMATRIA_HUNDREDS) {
      if (n >= v) { out += l; n -= v; matched = true; break; }
    }
    if (!matched) break;
  }
  if (n === 15) { out += 'טו'; n = 0; }
  else if (n === 16) { out += 'טז'; n = 0; }
  for (const [v, l] of GEMATRIA_TENS) { if (n >= v) { out += l; n -= v; break; } }
  for (const [v, l] of GEMATRIA_ONES) { if (n >= v) { out += l; n -= v; break; } }
  if (!withPunct) return out;
  if (out.length === 1) return out + '׳';
  if (out.length > 1) return out.slice(0, -1) + '״' + out.slice(-1);
  return out;
}

/** שנה עברית באותיות, ללא האלפים (תשפ״ו) */
export function hebYearToGematria(year) {
  return toGematria(year % 1000);
}

/* ============================== עזרי תאריך ============================== */

/** 'YYYY-MM-DD' -> absolute */
export function isoToAbs(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return gregToAbs(y, m, d);
}

/** absolute -> 'YYYY-MM-DD' */
export function absToIso(abs) {
  const { y, m, d } = absToGreg(abs);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** יום בשבוע 0=ראשון */
export function weekdayOfAbs(abs) {
  return abs % 7;
}

/** מידע מלא על יום לפי ISO */
export function dayInfo(iso) {
  const abs = isoToAbs(iso);
  const g = absToGreg(abs);
  const h = absToHeb(abs);
  return {
    iso,
    abs,
    greg: g,
    heb: h,
    weekday: weekdayOfAbs(abs),
    hebLabel: `${toGematria(h.d)} ${hebMonthName(h.y, h.m)}`,
    hebLabelFull: `${toGematria(h.d)} ${hebMonthName(h.y, h.m)} ${hebYearToGematria(h.y)}`,
    gregLabel: `${g.d} ${GREG_MONTH_NAMES[g.m - 1]} ${g.y}`,
    weekdayLabel: WEEKDAY_NAMES[weekdayOfAbs(abs)],
  };
}

export function addDaysIso(iso, n) {
  return absToIso(isoToAbs(iso) + n);
}
