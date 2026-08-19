/**
 * views/past.js — דשבורד מכירות קודמות ומאגר לקוחות היסטורי.
 * סינון לפי ערים, שכונות, תאריכים וסוג משקפיים; ייבוא אקסל של מכירות עבר;
 * וסימון קבוצת לקוחות לשליחת צינתוק לפי אזור.
 */
import { store, uid, num, saleTotals } from '../store.js';
import {
  el, clear, money, numFmt, shortDate, toast, toastOk, toastErr, confirmDialog,
  openModal, field, textInput, selectInput, checkInput, emptyState, kpi,
} from '../ui.js';
import { downloadXlsx } from '../xlsx.js';
import { importDialog } from './customers.js';
import { openCampaignDialog } from './campaigns.js';
import { normalizePhone } from '../yemot.js';

const filters = {
  city: '', neighborhood: '', from: '', to: '', glassesType: '',
  paid: '', delivered: '', search: '', source: '',
};

/** מאחד לקוחות מכל המכירות + הארכיון לרשומות אחידות */
export function allCustomers() {
  const out = [];
  for (const s of store.state.sales) {
    for (const c of s.customers || []) {
      out.push({
        ...c,
        _saleId: s.id,
        _date: s.date,
        _city: c.city || s.city || '',
        _neighborhood: c.neighborhood || s.neighborhood || '',
        _hall: s.hallName || '',
        _source: 'מכירה במערכת',
      });
    }
  }
  for (const a of store.state.archive) {
    out.push({
      ...a,
      _saleId: null,
      _date: a.saleDate || a._date || '',
      _city: a.city || '',
      _neighborhood: a.neighborhood || '',
      _hall: a.saleTitle || '',
      _source: a._source || 'ייבוא מאקסל',
    });
  }
  return out;
}

function applyFilters(list) {
  return list.filter((c) => {
    if (filters.city && c._city !== filters.city) return false;
    if (filters.neighborhood && c._neighborhood !== filters.neighborhood) return false;
    if (filters.glassesType && (c.glassesType || '') !== filters.glassesType) return false;
    if (filters.source && c._source !== filters.source) return false;
    if (filters.from && (!c._date || c._date < filters.from)) return false;
    if (filters.to && (!c._date || c._date > filters.to)) return false;
    if (filters.paid === 'yes' && !c.paid) return false;
    if (filters.paid === 'no' && c.paid) return false;
    if (filters.delivered === 'yes' && !c.delivered) return false;
    if (filters.delivered === 'no' && c.delivered) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = [c.firstName, c.lastName, c.phone, c.email, c._city, c._neighborhood, c._hall]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function render(root, nav) {
  clear(root);
  const all = allCustomers();
  const cities = [...new Set(all.map((c) => c._city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
  const hoods = [...new Set(all
    .filter((c) => !filters.city || c._city === filters.city)
    .map((c) => c._neighborhood).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
  const types = [...new Set(all.map((c) => c.glassesType).filter(Boolean))].sort();
  const sources = [...new Set(all.map((c) => c._source))];

  const selection = new Set();
  const tableBox = el('div');
  const kpiBox = el('div.kpis');
  const selBar = el('div.row', { style: { marginBottom: '10px' } });

  /* ------------------------------ סינון ------------------------------ */
  const rerender = () => render(root, nav);
  const setF = (k) => (v) => { filters[k] = v; draw(); };

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['סינון לקוחות ממכירות קודמות',
      el('div.spacer'),
      el('button.btn.sm', { text: 'ניקוי סינון', onclick: () => { for (const k of Object.keys(filters)) filters[k] = ''; rerender(); } }),
      el('button.btn.sm.primary', {
        text: '📥 ייבוא נתוני מכירות קודמות',
        onclick: () => importDialog('לארכיון המכירות הקודמות', (records) => {
          store.update((s) => {
            for (const r of records) {
              s.archive.push({ id: uid(), ...r, _source: 'ייבוא מאקסל', importedAt: new Date().toISOString() });
            }
          });
          toastOk(`יובאו ${records.length} רשומות לארכיון`);
          rerender();
        }),
      }),
    ]),
    el('div.card-body', {}, [
      el('div.filters', {}, [
        field('חיפוש חופשי', textInput(filters.search, setF('search'), { placeholder: 'שם / טלפון / מיקום' })),
        field('עיר', selectInput(filters.city, [{ value: '', label: 'כל הערים' }, ...cities], (v) => { filters.city = v; filters.neighborhood = ''; rerender(); })),
        field('שכונה', selectInput(filters.neighborhood, [{ value: '', label: 'כל השכונות' }, ...hoods], setF('neighborhood'))),
        field('סוג משקפיים', selectInput(filters.glassesType, [{ value: '', label: 'הכל' }, ...types], setF('glassesType'))),
        field('מתאריך', el('input.input', { type: 'date', value: filters.from, onchange: (e) => setF('from')(e.target.value) })),
        field('עד תאריך', el('input.input', { type: 'date', value: filters.to, onchange: (e) => setF('to')(e.target.value) })),
        field('תשלום', selectInput(filters.paid, [
          { value: '', label: 'הכל' }, { value: 'yes', label: 'שולם' }, { value: 'no', label: 'לא שולם' }], setF('paid'))),
        field('מסירה', selectInput(filters.delivered, [
          { value: '', label: 'הכל' }, { value: 'yes', label: 'נמסר' }, { value: 'no', label: 'לא נמסר' }], setF('delivered'))),
        field('מקור', selectInput(filters.source, [{ value: '', label: 'הכל' }, ...sources], setF('source'))),
      ]),
    ]),
  ]));

  root.appendChild(kpiBox);
  root.appendChild(selBar);
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['לקוחות',
      el('div.spacer'),
      el('button.btn.sm', { text: '📊 ייצוא לאקסל', onclick: () => exportFiltered() }),
    ]),
    el('div.card-body.tight', {}, [tableBox]),
  ]));

  /* ------------------------ סיכום מכירות עבר ------------------------ */
  const pastSales = store.state.sales.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (pastSales.length) {
    root.appendChild(el('div.card', {}, [
      el('h3', {}, ['היסטוריית מכירות']),
      el('div.card-body.tight', {}, [el('div.table-wrap', {}, [el('table.tbl', {}, [
        el('thead', {}, [el('tr', {}, ['תאריך', 'עיר', 'שכונה', 'אולם', 'לקוחות', 'הכנסות', 'הוצאות', 'רווח', 'רווחיות', ''].map((h) => el('th', { text: h })))]),
        el('tbody', {}, pastSales.map((s) => {
          const t = saleTotals(s);
          return el('tr', {}, [
            el('td', { text: shortDate(s.date) }),
            el('td', { text: s.city || '—' }),
            el('td', { text: s.neighborhood || '—' }),
            el('td', { text: s.hallName || '—' }),
            el('td.center', { text: String(t.count) }),
            el('td', { text: money(t.revenue) }),
            el('td', { text: money(t.expenses) }),
            el('td', { text: money(t.profit), style: { color: t.profit >= 0 ? '#15803d' : '#b91c1c', fontWeight: '600' } }),
            el('td', { text: t.revenue ? t.margin.toFixed(0) + '%' : '—' }),
            el('td', {}, [el('button.btn.sm.primary', { text: 'פתיחה', onclick: () => nav('sale', { id: s.id }) })]),
          ]);
        })),
      ])])]),
    ]));
  }

  let filtered = [];

  function draw() {
    filtered = applyFilters(all);

    clear(kpiBox);
    const revenue = filtered.reduce((a, c) => a + num(c.price), 0);
    const paidCnt = filtered.filter((c) => c.paid).length;
    const phones = new Set(filtered.map((c) => normalizePhone(c.phone)).filter(Boolean));
    kpiBox.appendChild(kpi('לקוחות בסינון', String(filtered.length), `מתוך ${all.length} במאגר`, 'blue'));
    kpiBox.appendChild(kpi('טלפונים ייחודיים', String(phones.size), 'זמינים לצינתוק', 'purple'));
    kpiBox.appendChild(kpi('סה״כ מכירות', money(revenue), '', 'green'));
    kpiBox.appendChild(kpi('שולם', `${paidCnt}/${filtered.length}`, '', ''));
    kpiBox.appendChild(kpi('ערים', String(new Set(filtered.map((c) => c._city).filter(Boolean)).size), ''));
    kpiBox.appendChild(kpi('שכונות', String(new Set(filtered.map((c) => c._neighborhood).filter(Boolean)).size), ''));

    clear(selBar);
    selBar.appendChild(el('button.btn.primary', {
      text: '📞 שליחת צינתוק לנמענים המסומנים',
      onclick: () => {
        const targets = selection.size
          ? filtered.filter((c) => selection.has(rowKey(c)))
          : filtered;
        if (!targets.length) return toastErr('אין נמענים');
        openCampaignDialog(targets, {
          title: `שליחה לפי אזור — ${filters.city || 'כל הערים'} ${filters.neighborhood || ''}`.trim(),
          onDone: () => rerender(),
        });
      },
    }));
    selBar.appendChild(el('button.btn', {
      text: 'סימון הכל', onclick: () => { for (const c of filtered) selection.add(rowKey(c)); draw(); },
    }));
    selBar.appendChild(el('button.btn', {
      text: 'ניקוי סימון', onclick: () => { selection.clear(); draw(); },
    }));
    selBar.appendChild(el('span', {
      text: selection.size ? `${selection.size} מסומנים` : 'ללא סימון — השליחה תתבצע לכל התוצאות המסוננות',
      style: { color: '#64748b', fontSize: '13px' },
    }));

    clear(tableBox);
    if (!filtered.length) {
      tableBox.appendChild(emptyState('לא נמצאו לקוחות התואמים לסינון', '🔍'));
      return;
    }
    const shown = filtered.slice(0, 500);
    tableBox.appendChild(el('div.table-wrap', {}, [el('table.tbl', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { style: { width: '36px' } }),
        ...['#', 'שם', 'משפחה', 'טלפון', 'עיר', 'שכונה', 'מיקום המכירה', 'תאריך', 'סוג משקפיים', 'מחיר', 'שולם', 'נמסר', 'מקור']
          .map((h) => el('th', { text: h })),
      ])]),
      el('tbody', {}, shown.map((c, i) => el('tr', {}, [
        el('td.center', {}, [checkInput(selection.has(rowKey(c)), (v) => {
          if (v) selection.add(rowKey(c)); else selection.delete(rowKey(c));
          draw();
        })]),
        el('td.rownum', { text: String(i + 1) }),
        el('td', { text: c.firstName || '' }),
        el('td', { text: c.lastName || '' }),
        el('td', { text: c.phone || '', dir: 'ltr' }),
        el('td', { text: c._city }),
        el('td', { text: c._neighborhood }),
        el('td', { text: c._hall }),
        el('td', { text: c._date ? shortDate(c._date) : '' }),
        el('td', { text: c.glassesType || '' }),
        el('td', { text: c.price ? money(c.price) : '' }),
        el('td.center', { text: c.paid ? '✓' : '' }),
        el('td.center', { text: c.delivered ? '✓' : '' }),
        el('td', { text: c._source }),
      ]))),
    ])]));
    if (filtered.length > shown.length) {
      tableBox.appendChild(el('div', {
        style: { padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '13px' },
        text: `מוצגות ${shown.length} שורות ראשונות מתוך ${filtered.length}. ניתן לצמצם בסינון או לייצא לאקסל את כל התוצאות.`,
      }));
    }
  }

  function exportFiltered() {
    const rows = [['#', 'שם פרטי', 'שם משפחה', 'טלפון', 'דוא״ל', 'עיר', 'שכונה', 'מיקום המכירה',
      'תאריך', 'סוג משקפיים', 'עין ימין', 'עין שמאל', 'מחיר', 'שולם', 'אמצעי תשלום', 'נמסר', 'הערות', 'מקור']];
    filtered.forEach((c, i) => rows.push([
      i + 1, c.firstName || '', c.lastName || '', c.phone || '', c.email || '',
      c._city, c._neighborhood, c._hall, c._date || '', c.glassesType || '',
      c.rightEye || '', c.leftEye || '', num(c.price), c.paid ? 'כן' : 'לא',
      c.paymentMethod || '', c.delivered ? 'כן' : 'לא', c.notes || '', c._source,
    ]));
    downloadXlsx([{ name: 'לקוחות', rows }], 'לקוחות ממכירות קודמות.xlsx');
    toastOk('הקובץ הורד');
  }

  const rowKey = (c) => c.id || (c.phone + '|' + c._date);
  draw();
}
