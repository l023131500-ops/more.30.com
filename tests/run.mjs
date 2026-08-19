/**
 * tests/run.mjs — בדיקות ליבה: לוח עברי, מועדים, סיכומים כספיים, ו-xlsx.
 * הרצה:  node tests/run.mjs
 */
import * as H from '../src/hebcal.js';
import * as HOL from '../src/holidays.js';
import { buildXlsx } from '../src/xlsx.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};
const section = (t) => console.log('\n' + t);

/* ------------------------- 1. לוח עברי ------------------------- */
section('לוח עברי — עוגני תאריכים ידועים');
const anchors = {
  '1999-09-11': [5760, 7, 1],   // ראש השנה תש״ס
  '2023-09-16': [5784, 7, 1],   // ראש השנה תשפ״ד
  '2024-10-03': [5785, 7, 1],
  '2025-09-23': [5786, 7, 1],
  '2026-09-12': [5787, 7, 1],
  '2024-04-23': [5784, 1, 15],  // פסח תשפ״ד
  '2025-10-02': [5786, 7, 10],  // יום כיפור תשפ״ו
};
for (const [iso, [y, m, d]] of Object.entries(anchors)) {
  const h = H.dayInfo(iso).heb;
  ok(`${iso} = ${d}/${m}/${y}`, h.y === y && h.m === m && h.d === d,
     `התקבל ${h.d}/${h.m}/${h.y}`);
}

section('לוח עברי — השוואה מול מנוע ICU של הדפדפן/Node (1990–2060)');
{
  const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const map = { Tishri: 7, Heshvan: 8, Marheshvan: 8, Kislev: 9, Tevet: 10, Shevat: 11,
    Adar: 12, 'Adar I': 12, 'Adar II': 13, Nisan: 1, Iyar: 2, Sivan: 3, Tamuz: 4, Tammuz: 4, Av: 5, Elul: 6 };
  let n = 0, bad = 0, firstBad = '';
  for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(2060, 0, 1); t += 86400000) {
    const dt = new Date(t);
    const iso = dt.toISOString().slice(0, 10);
    const parts = fmt.formatToParts(dt);
    const gd = +parts.find((p) => p.type === 'day').value;
    const gm = map[parts.find((p) => p.type === 'month').value];
    const gy = +parts.find((p) => p.type === 'year').value;
    const mine = H.dayInfo(iso).heb;
    if (mine.d !== gd || mine.m !== gm || mine.y !== gy) { bad++; if (!firstBad) firstBad = iso; }
    n++;
  }
  ok(`${n.toLocaleString()} ימים תואמים ל-ICU`, bad === 0, `${bad} אי-התאמות, ראשונה ב-${firstBad}`);
}

section('לוח עברי — חוקיות מבנית (שנים 5000–8000)');
{
  const lens = new Set([353, 354, 355, 383, 384, 385]);
  let badLen = 0, badAdu = 0;
  for (let y = 5000; y < 8000; y++) {
    if (!lens.has(H.daysInHebYear(y))) badLen++;
    const w = H.hebToAbs(y, 7, 1) % 7;
    if (w === 0 || w === 3 || w === 5) badAdu++;  // לא אד״ו ראש
  }
  ok('אורך כל שנה חוקי (353/354/355/383/384/385)', badLen === 0, badLen + ' חריגות');
  ok('ראש השנה לעולם לא חל באד״ו', badAdu === 0, badAdu + ' חריגות');
}

section('גימטריה');
ok('15 = ט״ו', H.toGematria(15) === 'ט״ו', H.toGematria(15));
ok('16 = ט״ז', H.toGematria(16) === 'ט״ז', H.toGematria(16));
ok('1 = א׳', H.toGematria(1) === 'א׳', H.toGematria(1));
ok('30 = ל׳', H.toGematria(30) === 'ל׳', H.toGematria(30));
ok('5786 -> תשפ״ו', H.hebYearToGematria(5786) === 'תשפ״ו', H.hebYearToGematria(5786));

/* ------------------------- 2. מועדים ------------------------- */
section('מועדי ישראל');
const holOn = (iso) => HOL.holidaysForIso(iso).map((h) => h.name);
ok('12.9.2026 = ראש השנה', holOn('2026-09-12').some((n) => n.includes('ראש השנה')));
ok('2.4.2026 = פסח א׳', holOn('2026-04-02').some((n) => n.includes('פסח')));
ok('3.3.2026 = פורים', holOn('2026-03-03').includes('פורים'));
ok('22.5.2026 = שבועות', holOn('2026-05-22').includes('שבועות'));
ok('יום כיפור חוסם מכירה', HOL.evaluateDay('2026-09-21').blocked);
ok('יום שישי חוסם מכירה', HOL.evaluateDay('2026-08-21').blocked);
ok('שבת חוסמת מכירה', HOL.evaluateDay('2026-08-22').blocked);
ok('יום חול רגיל פנוי', !HOL.evaluateDay('2026-08-19').blocked);
{
  // צום שחל בשבת נדחה ליום ראשון
  let deferredFound = false;
  for (let y = 5780; y < 5800; y++) {
    const natural = H.absToIso(H.hebToAbs(y, 5, 9));
    if (H.isoToAbs(natural) % 7 === 6) {
      const next = H.addDaysIso(natural, 1);
      if (holOn(next).includes('תשעה באב') && !holOn(natural).includes('תשעה באב')) deferredFound = true;
    }
  }
  ok('תשעה באב שחל בשבת נדחה ליום ראשון', deferredFound);
}

/* ------------------------- 3. סיכומים כספיים ------------------------- */
section('סיכומים כספיים');
{
  const { saleTotals } = await import('../src/store.js');
  const sale = {
    customers: [
      { price: 500, paid: true, paymentMethod: 'מזומן', delivered: true },
      { price: 1000, paid: false, paidAmount: 300, paymentMethod: 'אשראי', delivered: false },
      { price: 250, paid: false, paidAmount: '', delivered: false },
    ],
    costs: [
      { amount: 800, status: 'שולם' },
      { amount: 200, status: 'טרם שולם' },
    ],
  };
  const t = saleTotals(sale);
  ok('הכנסות = 1750', t.revenue === 1750, String(t.revenue));
  ok('נגבה = 800', t.collected === 800, String(t.collected));
  ok('יתרה = 950', t.outstanding === 950, String(t.outstanding));
  ok('הוצאות = 1000', t.expenses === 1000, String(t.expenses));
  ok('הוצאות ששולמו = 800', t.expensesPaid === 800, String(t.expensesPaid));
  ok('רווח = 750', t.profit === 750, String(t.profit));
  ok('רווחיות ≈ 42.9%', Math.abs(t.margin - 42.857) < 0.01, t.margin.toFixed(2));
  ok('נמסרו = 1', t.delivered === 1);
  ok('פילוח: מזומן 500, אשראי 300', t.byMethod['מזומן'] === 500 && t.byMethod['אשראי'] === 300,
     JSON.stringify(t.byMethod));
}

/* ------------------------- 4. נרמול טלפונים ------------------------- */
section('נרמול מספרי טלפון');
{
  const { normalizePhone, uniquePhones } = await import('../src/yemot.js');
  ok('+972501234567 -> 0501234567', normalizePhone('+972-50-123-4567') === '0501234567', normalizePhone('+972-50-123-4567'));
  ok('00972527654321 -> 0527654321', normalizePhone('00972527654321') === '0527654321', normalizePhone('00972527654321'));
  ok('501234567 -> 0501234567', normalizePhone('501234567') === '0501234567');
  ok('רווחים ומקפים מנוקים', normalizePhone('050 123 45 67') === '0501234567');
  ok('מספר לא תקין נפסל', normalizePhone('12') === null);
  ok('ריק נפסל', normalizePhone('') === null);
  ok('כפילויות מוסרות', uniquePhones(['0501234567', '+972501234567', '050-123-4567']).length === 1);
}

/* ------------------------- 5. XLSX ------------------------- */
section('יצירת קובץ xlsx');
{
  const blob = buildXlsx([
    { name: 'לקוחות', rows: [['שם', 'טלפון', 'מחיר'], ['ישראל', '0501234567', 450]] },
    { name: 'סיכום', rows: [['סה״כ', 450]] },
  ]);
  const buf = new Uint8Array(await blob.arrayBuffer());
  ok('נוצר קובץ', buf.length > 1000, buf.length + ' bytes');
  ok('חתימת ZIP תקינה (PK)', buf[0] === 0x50 && buf[1] === 0x4b);
  const text = new TextDecoder().decode(buf);
  ok('מכיל שני גיליונות', text.includes('sheet1.xml') && text.includes('sheet2.xml'));
  ok('RTL מופעל', text.includes('rightToLeft="1"'));
  ok('טלפון נשמר כטקסט (אפס מוביל)', text.includes('0501234567'));
}

/* ------------------------- סיכום ------------------------- */
console.log(`\n${'='.repeat(46)}`);
console.log(`עברו: ${pass}   נכשלו: ${fail}`);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
