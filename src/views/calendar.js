/**
 * views/calendar.js — הדשבורד המרכזי: לוח שנה חודשי עברי־לועזי.
 * צבעים: ירוק=פנוי למכירה · כחול=יש מכירה · אדום=לא פנוי · אפור=שישי/שבת/חג.
 */
import {
  dayInfo, isoToAbs, absToIso, gregToAbs, absToGreg, daysInGregMonth,
  GREG_MONTH_NAMES, WEEKDAY_SHORT, todayIso, hebMonthName, hebYearToGematria, absToHeb,
} from '../hebcal.js';
import { evaluateDay } from '../holidays.js';
import { store, saleTotals } from '../store.js';
import { el, clear, money, toast, confirmDialog, openModal, field, textInput, emptyState } from '../ui.js';

let cursor = null; // {y, m}

function initCursor() {
  if (cursor) return;
  const t = dayInfo(todayIso()).greg;
  cursor = { y: t.y, m: t.m };
}

export function gotoMonth(iso) {
  const g = dayInfo(iso).greg;
  cursor = { y: g.y, m: g.m };
}

/** מצב היום: 'sale' | 'blocked' | 'off' | 'available' */
export function dayStatus(iso) {
  const st = store.state;
  const sales = store.salesOn(iso);
  const ev = evaluateDay(iso, st.settings.holidayRules, st.settings.weekend);
  if (sales.length) return { kind: 'sale', sales, ev };
  if (st.dayFlags[iso] && st.dayFlags[iso].blocked) return { kind: 'blocked', sales, ev };
  if (ev.blocked) return { kind: 'off', sales, ev };
  return { kind: 'available', sales, ev };
}

export function render(root, nav) {
  initCursor();
  clear(root);

  const monthAbsStart = gregToAbs(cursor.y, cursor.m, 1);
  const daysInMonth = daysInGregMonth(cursor.y, cursor.m);
  const firstWeekday = monthAbsStart % 7;
  const gridStart = monthAbsStart - firstWeekday;
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  // כותרת עברית של החודש (טווח חודשים עבריים)
  const hStart = absToHeb(monthAbsStart);
  const hEnd = absToHeb(monthAbsStart + daysInMonth - 1);
  const hebTitle = hStart.m === hEnd.m
    ? `${hebMonthName(hStart.y, hStart.m)} ${hebYearToGematria(hStart.y)}`
    : `${hebMonthName(hStart.y, hStart.m)} – ${hebMonthName(hEnd.y, hEnd.m)} ${hebYearToGematria(hEnd.y)}`;

  /* ---------------- סרגל ניווט ---------------- */
  const head = el('div.cal-head', {}, [
    el('button.btn', { text: '‹ הקודם', onclick: () => { shift(-1); render(root, nav); } }),
    el('button.btn', { text: 'החודש', onclick: () => { cursor = null; initCursor(); render(root, nav); } }),
    el('button.btn', { text: 'הבא ›', onclick: () => { shift(1); render(root, nav); } }),
    el('div.cal-title', {}, [
      `${GREG_MONTH_NAMES[cursor.m - 1]} ${cursor.y}`,
      el('small', { text: hebTitle }),
    ]),
    el('div.spacer'),
    el('select.input', {
      style: { width: 'auto' },
      onchange: (e) => { cursor.m = +e.target.value; render(root, nav); },
    }, GREG_MONTH_NAMES.map((n, i) =>
      el('option', { value: i + 1, text: n, selected: i + 1 === cursor.m }))),
    el('input.input', {
      type: 'number', value: cursor.y, style: { width: '90px' },
      onchange: (e) => { cursor.y = +e.target.value || cursor.y; render(root, nav); },
    }),
  ]);
  root.appendChild(head);

  /* ---------------- סיכום חודשי ---------------- */
  const monthSales = store.state.sales.filter((s) => {
    const g = dayInfo(s.date).greg;
    return g.y === cursor.y && g.m === cursor.m;
  });
  let rev = 0, exp = 0, cust = 0, coll = 0;
  for (const s of monthSales) {
    const t = saleTotals(s);
    rev += t.revenue; exp += t.expenses; cust += t.count; coll += t.collected;
  }
  root.appendChild(el('div.kpis', {}, [
    kpiBox('מכירות בחודש', String(monthSales.length), '', 'blue'),
    kpiBox('לקוחות', String(cust), '', ''),
    kpiBox('הכנסות', money(rev), '', 'green'),
    kpiBox('הוצאות', money(exp), '', 'red'),
    kpiBox('רווח', money(rev - exp), rev ? ((rev - exp) / rev * 100).toFixed(1) + '% רווחיות' : '', 'purple'),
    kpiBox('יתרה לגבייה', money(Math.max(0, rev - coll)), '', 'amber'),
  ]));

  /* ---------------- הלוח ---------------- */
  const grid = el('div.cal-grid');
  const today = todayIso();

  for (let i = 0; i < totalCells; i++) {
    const abs = gridStart + i;
    const iso = absToIso(abs);
    const info = dayInfo(iso);
    const inMonth = info.greg.y === cursor.y && info.greg.m === cursor.m;
    const st = dayStatus(iso);

    const cls = ['cal-day', 'st-' + st.kind];
    if (!inMonth) cls.push('other');
    if (iso === today) cls.push('today');

    const holNames = st.ev.holidays.filter((h) => h.kind !== 'roshchodesh').map((h) => h.name);
    const rc = st.ev.holidays.some((h) => h.kind === 'roshchodesh');

    const cell = el('div', { class: cls.join(' '), 'data-iso': iso });
    cell.appendChild(el('div.dnum', {}, [
      el('span.g', { text: String(info.greg.d) }),
      el('span.h', { text: info.hebLabel }),
    ]));
    if (holNames.length) cell.appendChild(el('div.hol', { text: holNames.join(' · ') }));
    else if (rc) cell.appendChild(el('div.hol', { text: 'ראש חודש' }));

    // תגיות מכירות
    for (const s of st.sales) {
      const t = saleTotals(s);
      cell.appendChild(el('div.sale-chip' + (s.slot >= 2 ? '.s2' : ''), {
        title: `${s.hallName || 'מכירה'} · ${s.city || ''} ${s.neighborhood || ''} — ${t.count} לקוחות`,
      }, [
        el('b', { text: [s.city, s.neighborhood].filter(Boolean).join(' · ') || 'מכירה' }),
        el('span', { text: [s.hallName, s.street && s.street + ' ' + (s.houseNumber || '')].filter(Boolean).join(' · ') || 'ללא פרטים' }),
      ]));
    }
    if (st.sales.length > 1) {
      cell.appendChild(el('div.badge.purple', { text: `${st.sales.length} מכירות`, style: { alignSelf: 'flex-start' } }));
    }

    // כפתור "מכירה נוספת"
    if (inMonth) {
      const addBtn = el('button.cal-add', {
        text: '+',
        title: st.sales.length ? 'הוספת מכירה נוספת ליום זה' : 'פתיחת מכירה ביום זה',
        onclick: (e) => {
          e.stopPropagation();
          const s = store.createSale(iso);
          toast('נפתחה מכירה חדשה');
          nav('sale', { id: s.id });
        },
      });
      cell.appendChild(addBtn);
    }

    cell.addEventListener('click', () => openDay(iso, nav, root));
    cell.addEventListener('contextmenu', (e) => { e.preventDefault(); dayMenu(iso, root, nav); });
    grid.appendChild(cell);
  }

  root.appendChild(el('div.calendar', {}, [
    el('div.cal-dow', {}, WEEKDAY_SHORT.map((d, i) =>
      el('div', { text: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][i] }))),
    grid,
  ]));

  root.appendChild(el('div.legend', {}, [
    lg('#dcfce7', 'פנוי למכירה'),
    lg('#dbeafe', 'יש מכירה'),
    lg('#fee2e2', 'לא פנוי למכירה'),
    lg('#e9edf3', 'שישי / שבת / חג'),
    el('span', { text: '· לחיצה על יום פותחת אותו · לחיצה ימנית לתפריט מהיר · כפתור + מוסיף מכירה נוספת' }),
  ]));

  /* ---------------- מכירות קרובות ---------------- */
  const upcoming = store.state.sales
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.slot || 1) - (b.slot || 1))
    .slice(0, 6);
  if (upcoming.length) {
    root.appendChild(el('div.card', { style: { marginTop: '18px' } }, [
      el('h3', {}, ['מכירות קרובות']),
      el('div.card-body.tight', {}, [
        el('div.table-wrap', {}, [
          el('table.tbl', {}, [
            el('thead', {}, [el('tr', {}, ['תאריך', 'יום', 'עיר', 'שכונה', 'אולם', 'לקוחות', 'הכנסות', 'רווח', ''].map((h) => el('th', { text: h })))]),
            el('tbody', {}, upcoming.map((s) => {
              const t = saleTotals(s);
              const d = dayInfo(s.date);
              return el('tr', {}, [
                el('td', { text: `${d.greg.d}/${d.greg.m}` }),
                el('td', { text: d.weekdayLabel }),
                el('td', { text: s.city || '—' }),
                el('td', { text: s.neighborhood || '—' }),
                el('td', { text: s.hallName || '—' }),
                el('td.center', { text: String(t.count) }),
                el('td', { text: money(t.revenue) }),
                el('td', { text: money(t.profit) }),
                el('td', {}, [el('button.btn.sm.primary', { text: 'פתיחה', onclick: () => nav('sale', { id: s.id }) })]),
              ]);
            })),
          ]),
        ]),
      ]),
    ]));
  }
}

function shift(delta) {
  cursor.m += delta;
  while (cursor.m > 12) { cursor.m -= 12; cursor.y++; }
  while (cursor.m < 1) { cursor.m += 12; cursor.y--; }
}

function lg(color, text) {
  return el('span', {}, [el('i', { style: { background: color } }), text]);
}

function kpiBox(label, value, sub, kind) {
  return el('div.kpi' + (kind ? '.' + kind : ''), {}, [
    el('div.label', { text: label }),
    el('div.value', { text: value }),
    sub ? el('div.sub', { text: sub }) : null,
  ]);
}

/** לחיצה על יום — אם יש מכירה אחת נכנסים אליה, אחרת חלון בחירה */
function openDay(iso, nav, root) {
  const st = dayStatus(iso);
  if (st.sales.length === 1) return nav('sale', { id: st.sales[0].id });
  if (st.sales.length > 1) {
    return openModal({
      title: 'מכירות ביום ' + dayInfo(iso).hebLabelFull,
      size: 'narrow',
      body: el('div', {}, st.sales.map((s) => el('button.btn', {
        style: { width: '100%', marginBottom: '8px', justifyContent: 'flex-start' },
        text: `מכירה ${s.slot} — ${[s.city, s.neighborhood, s.hallName].filter(Boolean).join(' · ') || 'ללא פרטים'}`,
        onclick: () => { document.querySelector('.modal-back').remove(); nav('sale', { id: s.id }); },
      }))),
      buttons: [{
        label: '+ מכירה נוספת', kind: 'primary',
        onClick: (c) => { c(); const s = store.createSale(iso); nav('sale', { id: s.id }); },
      }],
    });
  }
  dayMenu(iso, root, nav);
}

/** תפריט יום ריק — פתיחת מכירה / חסימה / שחרור */
function dayMenu(iso, root, nav) {
  const st = dayStatus(iso);
  const info = dayInfo(iso);
  const flag = store.state.dayFlags[iso] || {};
  const noteInput = textInput(flag.note || '', () => {}, { placeholder: 'סיבה / הערה ליום (אופציונלי)' });

  const statusText = {
    available: 'היום פנוי למכירה',
    blocked: 'היום מסומן כלא פנוי למכירה',
    off: 'אין מכירות ביום זה: ' + st.ev.reason,
    sale: 'קיימת מכירה ביום זה',
  }[st.kind];

  openModal({
    title: info.weekdayLabel + ', ' + info.hebLabelFull,
    size: 'narrow',
    body: el('div', {}, [
      el('p', { text: info.gregLabel, style: { margin: '0 0 6px', color: '#64748b' } }),
      el('p', { text: statusText, style: { margin: '0 0 14px', fontWeight: '600' } }),
      st.ev.holidays.length
        ? el('div', { style: { marginBottom: '12px' } },
            st.ev.holidays.map((h) => el('span.badge', { text: h.name, style: { marginLeft: '5px' } })))
        : null,
      field('הערה ליום', noteInput),
    ]),
    buttons: [
      {
        label: 'פתיחת מכירה ביום זה', kind: 'primary',
        onClick: (c) => { c(); const s = store.createSale(iso); nav('sale', { id: s.id }); },
      },
      st.kind === 'blocked'
        ? {
            label: 'שחרור היום (פנוי)', kind: 'success',
            onClick: (c) => {
              store.update((s) => { delete s.dayFlags[iso]; });
              c(); render(root, nav); toast('היום שוחרר למכירה');
            },
          }
        : {
            label: 'סימון כלא פנוי', kind: 'danger',
            onClick: (c) => {
              store.update((s) => { s.dayFlags[iso] = { blocked: true, note: noteInput.value }; });
              c(); render(root, nav); toast('היום סומן כלא פנוי');
            },
          },
    ],
  });
}
