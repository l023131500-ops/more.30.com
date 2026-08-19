/**
 * views/reports.js — דוחות לכל הפרמטרים, עם סינון תקופה וייצוא לאקסל.
 */
import { store, num, saleTotals } from '../store.js';
import { dayInfo, todayIso, GREG_MONTH_NAMES } from '../hebcal.js';
import {
  el, clear, money, numFmt, pct, shortDate, toastOk,
  selectInput, field, emptyState, kpi, barChart,
} from '../ui.js';
import { downloadXlsx } from '../xlsx.js';
import { allCustomers } from './past.js';

let tab = 'summary';
const range = { from: '', to: '' };

const TABS = [
  ['summary', 'סיכום כללי'],
  ['sales', 'מכירות'],
  ['profit', 'רווחיות'],
  ['geo', 'ערים ושכונות'],
  ['payments', 'תשלומים וגבייה'],
  ['delivery', 'מסירות'],
  ['products', 'סוגי משקפיים'],
  ['expenses', 'הוצאות'],
  ['monthly', 'לפי חודשים'],
  ['campaigns', 'צינתוקים'],
];

function inRange(iso) {
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

function scopedSales() {
  return store.state.sales.filter((s) => inRange(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function render(root, nav) {
  clear(root);

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['תקופת הדוח',
      el('div.spacer'),
      el('button.btn.sm', { text: 'החודש', onclick: () => setPreset('month') }),
      el('button.btn.sm', { text: 'השנה', onclick: () => setPreset('year') }),
      el('button.btn.sm', { text: 'הכל', onclick: () => { range.from = ''; range.to = ''; render(root, nav); } }),
    ]),
    el('div.card-body', {}, [
      el('div.filters', {}, [
        field('מתאריך', el('input.input', { type: 'date', value: range.from, onchange: (e) => { range.from = e.target.value; render(root, nav); } })),
        field('עד תאריך', el('input.input', { type: 'date', value: range.to, onchange: (e) => { range.to = e.target.value; render(root, nav); } })),
      ]),
    ]),
  ]));

  function setPreset(kind) {
    const t = dayInfo(todayIso()).greg;
    if (kind === 'month') {
      range.from = `${t.y}-${String(t.m).padStart(2, '0')}-01`;
      range.to = `${t.y}-${String(t.m).padStart(2, '0')}-31`;
    } else {
      range.from = `${t.y}-01-01`; range.to = `${t.y}-12-31`;
    }
    render(root, nav);
  }

  const tabsEl = el('div.tabs', {}, TABS.map(([k, label]) =>
    el('button', { class: tab === k ? 'active' : '', text: label, onclick: () => { tab = k; render(root, nav); } })));
  root.appendChild(tabsEl);

  const body = el('div');
  root.appendChild(body);
  const sales = scopedSales();

  const renderers = {
    summary: repSummary, sales: repSales, profit: repProfit, geo: repGeo,
    payments: repPayments, delivery: repDelivery, products: repProducts,
    expenses: repExpenses, monthly: repMonthly, campaigns: repCampaigns,
  };
  (renderers[tab] || repSummary)(body, sales);
}

/* --------------------------- כלי עזר לדוח --------------------------- */

function reportCard(title, rows, headers, opts = {}) {
  const card = el('div.card', {}, [
    el('h3', {}, [title,
      el('div.spacer'),
      el('button.btn.sm', {
        text: '📊 הורדת אקסל',
        onclick: () => {
          downloadXlsx([{ name: title.slice(0, 28), rows: [headers, ...rows] }], title + '.xlsx');
          toastOk('הדוח הורד');
        },
      }),
      el('button.btn.sm', { text: '🖨', title: 'הדפסה', onclick: () => window.print() }),
    ]),
    el('div.card-body.tight', {}, [
      rows.length ? el('div.table-wrap', {}, [el('table.tbl', {}, [
        el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]),
        el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c, i) =>
          el('td', { text: String(c), class: typeof c === 'number' ? '' : '' }))))),
        opts.totals ? el('tfoot', {}, [el('tr', {}, opts.totals.map((c) => el('td', { text: String(c) })))]) : null,
      ])]) : emptyState('אין נתונים לתקופה שנבחרה', '📊'),
    ]),
  ]);
  return card;
}

function agg(sales) {
  let revenue = 0, expenses = 0, collected = 0, count = 0, delivered = 0;
  for (const s of sales) {
    const t = saleTotals(s);
    revenue += t.revenue; expenses += t.expenses; collected += t.collected;
    count += t.count; delivered += t.delivered;
  }
  return { revenue, expenses, collected, count, delivered, profit: revenue - expenses, outstanding: revenue - collected };
}

/* ------------------------------ הדוחות ------------------------------ */

function repSummary(body, sales) {
  const a = agg(sales);
  body.appendChild(el('div.kpis', {}, [
    kpi('מכירות', String(sales.length), '', 'blue'),
    kpi('לקוחות', String(a.count), a.count && sales.length ? `${(a.count / sales.length).toFixed(1)} בממוצע למכירה` : '', ''),
    kpi('הכנסות', money(a.revenue), '', 'green'),
    kpi('הוצאות', money(a.expenses), '', 'red'),
    kpi('רווח', money(a.profit), a.revenue ? pct(a.profit / a.revenue * 100) : '', 'purple'),
    kpi('נגבה', money(a.collected), '', 'green'),
    kpi('יתרה לגבייה', money(a.outstanding), '', a.outstanding > 0 ? 'amber' : ''),
    kpi('נמסרו', `${a.delivered}/${a.count}`, '', ''),
  ]));

  const byMonth = {};
  for (const s of sales) {
    const g = dayInfo(s.date).greg;
    const k = `${g.y}-${String(g.m).padStart(2, '0')}`;
    if (!byMonth[k]) byMonth[k] = { revenue: 0, expenses: 0 };
    const t = saleTotals(s);
    byMonth[k].revenue += t.revenue;
    byMonth[k].expenses += t.expenses;
  }
  const months = Object.keys(byMonth).sort();
  if (months.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['הכנסות לפי חודש']),
      el('div.card-body', {}, [
        barChart(months.map((m) => ({ label: m, value: byMonth[m].revenue, color: 'green' })), money),
      ]),
    ]));
  }

  const top = sales.map((s) => ({ s, t: saleTotals(s) }))
    .sort((a, b) => b.t.profit - a.t.profit).slice(0, 10);
  body.appendChild(reportCard('10 המכירות הרווחיות ביותר',
    top.map(({ s, t }) => [shortDate(s.date), s.city || '—', s.neighborhood || '—',
      t.count, money(t.revenue), money(t.expenses), money(t.profit), t.revenue ? t.margin.toFixed(0) + '%' : '—']),
    ['תאריך', 'עיר', 'שכונה', 'לקוחות', 'הכנסות', 'הוצאות', 'רווח', 'רווחיות']));
}

function repSales(body, sales) {
  const rows = sales.map((s) => {
    const t = saleTotals(s);
    const d = dayInfo(s.date);
    return [shortDate(s.date), d.hebLabelFull, d.weekdayLabel, s.city || '', s.neighborhood || '',
      s.hallName || '', [s.street, s.houseNumber].filter(Boolean).join(' '),
      statusLabel(s.status), t.count, money(t.revenue), money(t.collected),
      money(t.outstanding), money(t.expenses), money(t.profit)];
  });
  const a = agg(sales);
  body.appendChild(reportCard('דוח מכירות מפורט', rows,
    ['תאריך', 'תאריך עברי', 'יום', 'עיר', 'שכונה', 'אולם', 'כתובת', 'סטטוס', 'לקוחות',
      'הכנסות', 'נגבה', 'יתרה', 'הוצאות', 'רווח'],
    { totals: ['סה״כ', '', '', '', '', '', '', '', a.count, money(a.revenue), money(a.collected), money(a.outstanding), money(a.expenses), money(a.profit)] }));
}

function repProfit(body, sales) {
  const rows = sales.map((s) => {
    const t = saleTotals(s);
    return [shortDate(s.date), [s.city, s.neighborhood].filter(Boolean).join(' · ') || '—',
      t.count, money(t.revenue), money(t.expenses), money(t.profit),
      t.revenue ? t.margin.toFixed(1) + '%' : '—',
      t.count ? money(t.profit / t.count) : '—',
      t.avgTicket > 0 ? Math.ceil(t.expenses / t.avgTicket) : '—'];
  });
  body.appendChild(reportCard('דוח רווחיות', rows,
    ['תאריך', 'מיקום', 'לקוחות', 'הכנסות', 'הוצאות', 'רווח', 'שיעור רווח', 'רווח ללקוח', 'נק׳ איזון (לקוחות)']));

  const sorted = sales.map((s) => ({ s, t: saleTotals(s) })).filter((x) => x.t.revenue > 0)
    .sort((a, b) => b.t.margin - a.t.margin).slice(0, 12);
  if (sorted.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['שיעור רווחיות לפי מכירה']),
      el('div.card-body', {}, [barChart(sorted.map(({ s, t }) => ({
        label: (s.city || '') + ' ' + shortDate(s.date), value: +t.margin.toFixed(1),
        color: t.margin >= 0 ? 'green' : 'red',
      })), (v) => v + '%')]),
    ]));
  }
}

function repGeo(body, sales) {
  const map = {};
  for (const s of sales) {
    const t = saleTotals(s);
    const key = (s.city || 'לא צוין') + '|' + (s.neighborhood || 'לא צוין');
    if (!map[key]) map[key] = { city: s.city || 'לא צוין', hood: s.neighborhood || 'לא צוין', sales: 0, count: 0, revenue: 0, expenses: 0 };
    map[key].sales++; map[key].count += t.count;
    map[key].revenue += t.revenue; map[key].expenses += t.expenses;
  }
  const rows = Object.values(map).sort((a, b) => b.revenue - a.revenue).map((r) => [
    r.city, r.hood, r.sales, r.count, money(r.revenue), money(r.expenses),
    money(r.revenue - r.expenses), r.count ? money(r.revenue / r.count) : '—',
  ]);
  body.appendChild(reportCard('דוח ערים ושכונות', rows,
    ['עיר', 'שכונה', 'מכירות', 'לקוחות', 'הכנסות', 'הוצאות', 'רווח', 'ממוצע ללקוח']));

  const byCity = {};
  for (const r of Object.values(map)) byCity[r.city] = (byCity[r.city] || 0) + r.revenue;
  const top = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['הכנסות לפי עיר']),
      el('div.card-body', {}, [barChart(top.map(([k, v]) => ({ label: k, value: v, color: 'green' })), money)]),
    ]));
  }
}

function repPayments(body, sales) {
  const byMethod = {};
  const rows = [];
  let totalPaid = 0, totalDue = 0;
  for (const s of sales) {
    for (const c of s.customers || []) {
      const price = num(c.price);
      const paid = c.paid ? price : num(c.paidAmount);
      const due = Math.max(0, price - paid);
      totalPaid += paid; totalDue += due;
      const m = c.paymentMethod || 'לא צוין';
      if (paid > 0) byMethod[m] = (byMethod[m] || 0) + paid;
      if (due > 0) {
        rows.push([shortDate(s.date), [s.city, s.neighborhood].filter(Boolean).join(' · '),
          [c.firstName, c.lastName].filter(Boolean).join(' '), c.phone || '',
          money(price), money(paid), money(due), c.paymentMethod || '']);
      }
    }
  }
  body.appendChild(el('div.kpis', {}, [
    kpi('נגבה', money(totalPaid), '', 'green'),
    kpi('יתרה לגבייה', money(totalDue), '', 'amber'),
    kpi('לקוחות בחוב', String(rows.length), '', 'red'),
    ...Object.entries(byMethod).map(([k, v]) => kpi(k, money(v), '', 'blue')),
  ]));
  body.appendChild(reportCard('דוח חובות פתוחים', rows,
    ['תאריך', 'מכירה', 'לקוח', 'טלפון', 'מחיר', 'שולם', 'יתרה', 'אמצעי תשלום']));
}

function repDelivery(body, sales) {
  const rows = [];
  for (const s of sales) {
    for (const c of s.customers || []) {
      if (c.delivered) continue;
      rows.push([shortDate(s.date), [s.city, s.neighborhood].filter(Boolean).join(' · '),
        [c.firstName, c.lastName].filter(Boolean).join(' '), c.phone || '',
        c.glassesType || '', money(num(c.price)), c.paid ? 'שולם' : 'לא שולם']);
    }
  }
  body.appendChild(reportCard('משקפיים שטרם נמסרו', rows,
    ['תאריך המכירה', 'מכירה', 'לקוח', 'טלפון', 'סוג משקפיים', 'מחיר', 'תשלום']));
}

function repProducts(body, sales) {
  const map = {};
  for (const s of sales) {
    for (const c of s.customers || []) {
      const k = c.glassesType || 'לא צוין';
      if (!map[k]) map[k] = { count: 0, revenue: 0 };
      map[k].count++; map[k].revenue += num(c.price);
    }
  }
  const rows = Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([k, v]) => [k, v.count, money(v.revenue), money(v.revenue / v.count)]);
  body.appendChild(reportCard('דוח סוגי משקפיים', rows, ['סוג משקפיים', 'כמות', 'סה״כ הכנסות', 'מחיר ממוצע']));
  if (rows.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['התפלגות לפי סוג']),
      el('div.card-body', {}, [barChart(Object.entries(map).map(([k, v]) => ({ label: k, value: v.count })), numFmt)]),
    ]));
  }
}

function repExpenses(body, sales) {
  const rows = [];
  const byLabel = {};
  for (const s of sales) {
    for (const c of s.costs || []) {
      if (!c.label && !num(c.amount)) continue;
      rows.push([shortDate(s.date), [s.city, s.neighborhood].filter(Boolean).join(' · '),
        c.label || '—', money(num(c.amount)), c.paymentMethod || '', c.paidTo || '',
        c.status || '', c.dueDate || '', c.note || '']);
      const k = c.label || 'אחר';
      byLabel[k] = (byLabel[k] || 0) + num(c.amount);
    }
  }
  body.appendChild(reportCard('דוח הוצאות', rows,
    ['תאריך', 'מכירה', 'סעיף', 'סכום', 'אופן תשלום', 'למי מעבירים', 'סטטוס', 'תאריך יעד', 'הערה']));
  const top = Object.entries(byLabel).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['הוצאות לפי סעיף']),
      el('div.card-body', {}, [barChart(top.map(([k, v]) => ({ label: k, value: v, color: 'red' })), money)]),
    ]));
  }
}

function repMonthly(body, sales) {
  const map = {};
  for (const s of sales) {
    const g = dayInfo(s.date).greg;
    const k = `${g.y}-${String(g.m).padStart(2, '0')}`;
    if (!map[k]) map[k] = { label: `${GREG_MONTH_NAMES[g.m - 1]} ${g.y}`, sales: 0, count: 0, revenue: 0, expenses: 0, collected: 0 };
    const t = saleTotals(s);
    map[k].sales++; map[k].count += t.count;
    map[k].revenue += t.revenue; map[k].expenses += t.expenses; map[k].collected += t.collected;
  }
  const keys = Object.keys(map).sort();
  const rows = keys.map((k) => {
    const m = map[k];
    return [m.label, m.sales, m.count, money(m.revenue), money(m.expenses),
      money(m.revenue - m.expenses), m.revenue ? ((m.revenue - m.expenses) / m.revenue * 100).toFixed(1) + '%' : '—',
      money(m.collected), money(m.revenue - m.collected)];
  });
  body.appendChild(reportCard('דוח חודשי', rows,
    ['חודש', 'מכירות', 'לקוחות', 'הכנסות', 'הוצאות', 'רווח', 'רווחיות', 'נגבה', 'יתרה']));
  if (keys.length) {
    body.appendChild(el('div.card', {}, [
      el('h3', {}, ['רווח לפי חודש']),
      el('div.card-body', {}, [barChart(keys.map((k) => ({
        label: map[k].label, value: map[k].revenue - map[k].expenses,
        color: map[k].revenue - map[k].expenses >= 0 ? 'green' : 'red',
      })), money)]),
    ]));
  }
}

function repCampaigns(body) {
  const rows = store.state.campaigns
    .filter((c) => inRange(c.sentAt.slice(0, 10)))
    .map((c) => [new Date(c.sentAt).toLocaleString('he-IL'), c.typeLabel, c.saleLabel || '—',
      c.targets.length, c.targets.filter((t) => t.listened === true).length,
      c.targets.filter((t) => t.rsvp === 'כן').length, c.ok ? 'נשלח' : 'נכשל']);
  body.appendChild(reportCard('דוח צינתוקים והודעות', rows,
    ['תאריך', 'סוג', 'מכירה', 'נמענים', 'שמעו', 'אישרו הגעה', 'סטטוס']));
}

function statusLabel(s) {
  return { planned: 'מתוכננת', confirmed: 'מאושרת', done: 'הסתיימה', cancelled: 'בוטלה' }[s] || s || '';
}
