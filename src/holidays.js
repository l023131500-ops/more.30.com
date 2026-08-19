/**
 * holidays.js — חגים ומועדי ישראל לפי הלוח העברי.
 * מחזיר לכל תאריך לועזי (ISO) את רשימת המועדים שחלים בו + סיווג לחסימת מכירות.
 */
import {
  absToHeb, hebToAbs, absToIso, isoToAbs, isHebLeapYear, daysInHebMonth,
  lastMonthOfHebYear, weekdayOfAbs,
} from './hebcal.js';

/** סוגי מועדים — משמשים לכללי חסימה בהגדרות */
export const HOLIDAY_KINDS = {
  yomtov:      { label: 'יום טוב', color: '#6b7280', defaultBlock: true },
  cholhamoed:  { label: 'חול המועד', color: '#9ca3af', defaultBlock: true },
  erev:        { label: 'ערב חג', color: '#d97706', defaultBlock: false },
  fastMajor:   { label: 'צום מרכזי', color: '#6b7280', defaultBlock: true },
  fastMinor:   { label: 'תענית', color: '#a16207', defaultBlock: false },
  purim:       { label: 'פורים', color: '#7c3aed', defaultBlock: true },
  memorial:    { label: 'יום זיכרון', color: '#475569', defaultBlock: false },
  national:    { label: 'יום לאומי', color: '#2563eb', defaultBlock: false },
  minor:       { label: 'מועד', color: '#0891b2', defaultBlock: false },
  roshchodesh: { label: 'ראש חודש', color: '#0891b2', defaultBlock: false },
};

export const DEFAULT_HOLIDAY_RULES = Object.fromEntries(
  Object.entries(HOLIDAY_KINDS).map(([k, v]) => [k, v.defaultBlock])
);

const cache = new Map();

function push(map, abs, name, kind) {
  const iso = absToIso(abs);
  if (!map[iso]) map[iso] = [];
  map[iso].push({ name, kind });
}

/** אם צום חל בשבת — נדחה ליום ראשון */
function deferIfShabbat(abs) {
  return weekdayOfAbs(abs) === 6 ? abs + 1 : abs;
}

/** בונה את כל מועדי השנה העברית הנתונה. מחזיר מפה iso -> [{name,kind}] */
export function holidaysForHebYear(year) {
  if (cache.has(year)) return cache.get(year);
  const map = {};
  const A = (m, d) => hebToAbs(year, m, d);

  /* --- תשרי --- */
  push(map, A(7, 1), 'ראש השנה א׳', 'yomtov');
  push(map, A(7, 2), 'ראש השנה ב׳', 'yomtov');
  push(map, deferIfShabbat(A(7, 3)), 'צום גדליה', 'fastMinor');
  push(map, A(7, 9), 'ערב יום כיפור', 'erev');
  push(map, A(7, 10), 'יום הכיפורים', 'fastMajor');
  push(map, A(7, 14), 'ערב סוכות', 'erev');
  push(map, A(7, 15), 'סוכות א׳', 'yomtov');
  for (let d = 16; d <= 20; d++) push(map, A(7, d), `חול המועד סוכות`, 'cholhamoed');
  push(map, A(7, 21), 'הושענא רבה', 'cholhamoed');
  push(map, A(7, 22), 'שמיני עצרת / שמחת תורה', 'yomtov');

  /* --- חנוכה (8 ימים מכ״ה בכסלו) --- */
  const chanStart = A(9, 25);
  for (let i = 0; i < 8; i++) push(map, chanStart + i, `חנוכה — נר ${i + 1}`, 'minor');

  /* --- טבת / שבט --- */
  push(map, deferIfShabbat(A(10, 10)), 'עשרה בטבת', 'fastMinor');
  push(map, A(11, 15), 'ט״ו בשבט', 'minor');

  /* --- אדר / אדר ב׳ --- */
  const adar = isHebLeapYear(year) ? 13 : 12;
  if (isHebLeapYear(year)) {
    push(map, A(12, 14), 'פורים קטן', 'minor');
  }
  let taanitEsther = A(adar, 13);
  if (weekdayOfAbs(taanitEsther) === 6) taanitEsther -= 2; // חל בשבת -> יום חמישי
  push(map, taanitEsther, 'תענית אסתר', 'fastMinor');
  push(map, A(adar, 14), 'פורים', 'purim');
  push(map, A(adar, 15), 'שושן פורים', 'purim');

  /* --- ניסן --- */
  push(map, A(1, 14), 'ערב פסח', 'erev');
  push(map, A(1, 15), 'פסח א׳', 'yomtov');
  for (let d = 16; d <= 20; d++) push(map, A(1, d), 'חול המועד פסח', 'cholhamoed');
  push(map, A(1, 21), 'שביעי של פסח', 'yomtov');

  // יום השואה — כ״ז בניסן, נדחה: חל בשישי -> כ״ו, חל בראשון -> כ״ח
  let shoah = A(1, 27);
  if (weekdayOfAbs(shoah) === 5) shoah -= 1;
  else if (weekdayOfAbs(shoah) === 0) shoah += 1;
  push(map, shoah, 'יום הזיכרון לשואה ולגבורה', 'memorial');

  /* --- אייר --- */
  // יום הזיכרון ד׳ באייר / העצמאות ה׳ באייר, עם כללי הדחייה
  let atzmaut = A(2, 5);
  const wd = weekdayOfAbs(atzmaut);
  if (wd === 6) atzmaut -= 2;        // חל בשבת -> חמישי
  else if (wd === 5) atzmaut -= 1;   // חל בשישי -> חמישי
  else if (wd === 1) atzmaut += 1;   // חל בשני -> שלישי
  push(map, atzmaut - 1, 'יום הזיכרון לחללי מערכות ישראל', 'memorial');
  push(map, atzmaut, 'יום העצמאות', 'national');
  push(map, A(2, 18), 'ל״ג בעומר', 'minor');
  push(map, A(2, 28), 'יום ירושלים', 'minor');

  /* --- סיון --- */
  push(map, A(3, 5), 'ערב שבועות', 'erev');
  push(map, A(3, 6), 'שבועות', 'yomtov');

  /* --- תמוז / אב --- */
  push(map, deferIfShabbat(A(4, 17)), 'צום י״ז בתמוז', 'fastMinor');
  push(map, deferIfShabbat(A(5, 9)), 'תשעה באב', 'fastMajor');

  /* --- אלול --- */
  push(map, A(6, 29), 'ערב ראש השנה', 'erev');

  /* --- ראשי חודשים --- */
  const last = lastMonthOfHebYear(year);
  const order = [7, 8, 9, 10, 11, 12, ...(last === 13 ? [13] : []), 1, 2, 3, 4, 5, 6];
  for (const m of order) {
    if (m === 7) continue; // א׳ תשרי = ראש השנה
    const prev = order[order.indexOf(m) - 1];
    if (prev !== undefined && daysInHebMonth(year, prev) === 30) {
      push(map, hebToAbs(year, prev, 30), 'ראש חודש', 'roshchodesh');
    }
    push(map, hebToAbs(year, m, 1), 'ראש חודש', 'roshchodesh');
  }

  cache.set(year, map);
  return map;
}

/** כל המועדים החלים בתאריך לועזי נתון */
export function holidaysForIso(iso) {
  const abs = isoToAbs(iso);
  const h = absToHeb(abs);
  // מועד יכול להשתייך לשנה העברית הנוכחית או לזו שאחריה (סוף אלול)
  const years = new Set([h.y, h.y + 1, h.y - 1]);
  const out = [];
  for (const y of years) {
    const m = holidaysForHebYear(y);
    if (m[iso]) out.push(...m[iso]);
  }
  // הסרת כפילויות
  const seen = new Set();
  return out.filter((x) => {
    const k = x.name + '|' + x.kind;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * מחשב את מצב היום לפי כללי החסימה.
 * מחזיר {blocked:boolean, reason:string, holidays:[], weekendBlocked:boolean}
 */
export function evaluateDay(iso, rules = DEFAULT_HOLIDAY_RULES, weekend = { friday: true, saturday: true }) {
  const abs = isoToAbs(iso);
  const wd = weekdayOfAbs(abs);
  const hol = holidaysForIso(iso);
  const reasons = [];
  let blocked = false;

  if (wd === 5 && weekend.friday !== false) { blocked = true; reasons.push('יום שישי'); }
  if (wd === 6 && weekend.saturday !== false) { blocked = true; reasons.push('שבת'); }

  for (const h of hol) {
    if (rules[h.kind]) { blocked = true; reasons.push(h.name); }
  }
  return {
    blocked,
    reason: reasons.join(' · '),
    holidays: hol,
    weekend: wd === 5 || wd === 6,
  };
}
