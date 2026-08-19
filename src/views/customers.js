/**
 * views/customers.js — טבלת הלקוחות בסגנון אקסל, כולל סיכומים, הגדרות עמודות,
 * ייבוא/ייצוא, וסימון קבוצה לשליחת צינתוק.
 */
import { store, uid, num, saleTotals, PAYMENT_METHODS } from '../store.js';
import {
  el, clear, money, numFmt, toast, toastOk, toastErr, confirmDialog, openModal,
  field, textInput, selectInput, checkInput, pickFile, emptyState,
} from '../ui.js';
import { downloadXlsx, downloadCsv, readTableFile } from '../xlsx.js';

/** העמודות הפעילות לפי ההגדרות */
export function activeColumns() {
  return store.state.settings.customerColumns.filter((c) => c.visible !== false);
}

/* ============================ טבלת הלקוחות ============================ */

/**
 * @param {object} sale
 * @param {function} onChange  נקרא אחרי כל שינוי (לרענון סיכומים)
 * @param {object} opts { selectable:boolean, onSelectionChange(ids) }
 */
export function renderCustomerTable(sale, onChange, opts = {}) {
  const cfg = store.state.settings.tableConfig;
  const cols = activeColumns();
  const wrap = el('div');
  const selected = opts.selection || new Set();

  const table = el('table.tbl');

  /* ------- כותרת עליונה ------- */
  const thead = el('thead');
  const hr = el('tr');
  if (opts.selectable) {
    hr.appendChild(el('th', { style: { width: '36px' } }, [
      checkInput(false, (v) => {
        selected.clear();
        if (v) for (const c of sale.customers) selected.add(c.id);
        draw();
        if (opts.onSelectionChange) opts.onSelectionChange([...selected]);
      }),
    ]));
  }
  hr.appendChild(el('th', { text: cfg.sideHeader || 'מס׳', style: { width: '52px' } }));
  for (const c of cols) hr.appendChild(el('th', { text: c.label, style: { minWidth: (c.width || 110) + 'px' } }));
  hr.appendChild(el('th', { text: '', style: { width: '46px' } }));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  table.appendChild(tbody);
  const tfoot = el('tfoot');
  table.appendChild(tfoot);

  function sideValue(cust, i) {
    const f = cfg.sideHeaderField || 'index';
    if (f === 'index') return String(i + 1);
    return cust[f] || String(i + 1);
  }

  function draw() {
    drawBody();
    drawFooter();
  }

  function drawBody() {
    clear(tbody);
    if (!sale.customers.length) {
      const td = el('td', { colspan: String(cols.length + 2 + (opts.selectable ? 1 : 0)) }, [
        emptyState('אין עדיין לקוחות במכירה זו — לחצו על "הוספת לקוח"', '👓'),
      ]);
      tbody.appendChild(el('tr', {}, [td]));
    }

    sale.customers.forEach((cust, i) => {
      const tr = el('tr');
      if (opts.selectable) {
        tr.appendChild(el('td.center', {}, [
          checkInput(selected.has(cust.id), (v) => {
            if (v) selected.add(cust.id); else selected.delete(cust.id);
            if (opts.onSelectionChange) opts.onSelectionChange([...selected]);
          }),
        ]));
      }
      tr.appendChild(el('td.side-head', { text: sideValue(cust, i) }));

      for (const col of cols) {
        const td = el('td');
        td.appendChild(cellEditor(cust, col, () => { commit(); }));
        if (col.type === 'check') td.classList.add('center');
        tr.appendChild(td);
      }

      tr.appendChild(el('td.center', {}, [
        el('button.btn.sm.ghost', {
          text: '🗑', title: 'מחיקת שורה',
          onclick: () => confirmDialog(
            `למחוק את ${cust.firstName || ''} ${cust.lastName || ''}?`,
            () => {
              store.update(() => { sale.customers = sale.customers.filter((x) => x.id !== cust.id); });
              draw(); onChange && onChange();
            }, { danger: true, yes: 'מחיקה' }),
        }),
      ]));
      tbody.appendChild(tr);
    });
  }

  /* ------- שורת סיכום (מצוירת בנפרד כדי לא לבנות מחדש את הטבלה בכל הקלדה) ------- */
  function drawFooter() {
    clear(tfoot);
    // רענון עמודת הצד אם היא מציגה שדה מהרשומה
    if ((cfg.sideHeaderField || 'index') !== 'index') {
      const cells = tbody.querySelectorAll('td.side-head');
      sale.customers.forEach((c, i) => { if (cells[i]) cells[i].textContent = sideValue(c, i); });
    }
    if (cfg.showTotals !== false && sale.customers.length) {
      const t = saleTotals(sale);
      const ftr = el('tr');
      if (opts.selectable) ftr.appendChild(el('td'));
      ftr.appendChild(el('td.center', { text: 'סה״כ' }));
      for (const col of cols) {
        let txt = '';
        if (col.key === 'price') txt = money(t.revenue);
        else if (col.key === 'paidAmount') txt = money(t.collected);
        else if (col.key === 'paid') txt = `${t.paidCount}/${t.count}`;
        else if (col.key === 'delivered') txt = `${t.delivered}/${t.count}`;
        ftr.appendChild(el('td', { text: txt, class: col.type === 'check' ? 'center' : '' }));
      }
      ftr.appendChild(el('td'));
      tfoot.appendChild(ftr);
    }
  }

  /** נקרא אחרי עריכת תא — מעדכן סיכומים בלבד, בלי לבנות מחדש את הטבלה
   *  (שומר על מיקום הסמן ומונע שגיאות DOM בתוך אירועי blur) */
  function commit() {
    store.save();
    onChange && onChange();
    drawFooter();
  }

  draw();
  wrap.appendChild(el('div.table-wrap', {}, [table]));
  wrap._redraw = draw;
  wrap._selected = selected;
  return wrap;
}

/** עורך תא בהתאם לסוג העמודה */
function cellEditor(cust, col, onChange) {
  const set = (v) => { cust[col.key] = v; onChange(); };
  switch (col.type) {
    case 'check':
      return checkInput(cust[col.key], (v) => {
        cust[col.key] = v;
        // סימון "שולם" משלים אוטומטית את סכום התשלום
        if (col.key === 'paid' && v && !num(cust.paidAmount)) cust.paidAmount = num(cust.price);
        if (col.key === 'paid' && !v && num(cust.paidAmount) === num(cust.price)) cust.paidAmount = '';
        onChange();
      });
    case 'money':
      return el('input', {
        type: 'number', step: 'any', value: cust[col.key] ?? '',
        oninput: (e) => { cust[col.key] = e.target.value === '' ? '' : parseFloat(e.target.value); store.save(); },
        onchange: onChange, style: { textAlign: 'right' },
      });
    case 'select':
      return selectInput(cust[col.key] || '', ['', ...(col.options || [])], set);
    case 'tel':
      return el('input', {
        type: 'tel', value: cust[col.key] ?? '', dir: 'ltr', style: { textAlign: 'right' },
        oninput: (e) => { cust[col.key] = e.target.value; store.save(); }, onchange: onChange,
      });
    default:
      return el('input', {
        type: col.type === 'email' ? 'email' : 'text', value: cust[col.key] ?? '',
        oninput: (e) => { cust[col.key] = e.target.value; store.save(); }, onchange: onChange,
      });
  }
}

/* ============================ פעולות ============================ */

export function addCustomer(sale) {
  const c = { id: uid(), createdAt: new Date().toISOString() };
  for (const col of store.state.settings.customerColumns) {
    c[col.key] = col.type === 'check' ? false : '';
  }
  // ירושת עיר/שכונה מהמכירה
  if (sale.city && 'city' in c) c.city = sale.city;
  if (sale.neighborhood && 'neighborhood' in c) c.neighborhood = sale.neighborhood;
  store.update(() => sale.customers.push(c));
  return c;
}

/** שורות לייצוא */
export function customerRows(sale, includeMeta = true) {
  const cols = activeColumns();
  const rows = [[store.state.settings.tableConfig.sideHeader || 'מס׳', ...cols.map((c) => c.label)]];
  sale.customers.forEach((cust, i) => {
    rows.push([String(i + 1), ...cols.map((c) => {
      const v = cust[c.key];
      if (c.type === 'check') return v ? 'כן' : 'לא';
      return v ?? '';
    })]);
  });
  if (includeMeta) {
    const t = saleTotals(sale);
    rows.push([]);
    rows.push(['סה״כ לקוחות', String(t.count)]);
    rows.push(['סה״כ הכנסות', t.revenue]);
    rows.push(['שולם', t.collected]);
    rows.push(['יתרה לתשלום', t.outstanding]);
    rows.push(['סה״כ הוצאות', t.expenses]);
    rows.push(['רווח', t.profit]);
  }
  return rows;
}

export function exportCustomersXlsx(sale) {
  const cols = activeColumns();
  const title = [sale.city, sale.neighborhood, sale.hallName].filter(Boolean).join(' - ') || 'מכירה';
  downloadXlsx([{
    name: 'לקוחות',
    rows: customerRows(sale),
    colWidths: [6, ...cols.map((c) => Math.round((c.width || 110) / 8))],
  }], `לקוחות - ${title} - ${sale.date}.xlsx`);
  toastOk('קובץ האקסל הורד');
}

export function exportCustomersCsv(sale) {
  const title = [sale.city, sale.neighborhood].filter(Boolean).join(' - ') || 'מכירה';
  downloadCsv(customerRows(sale), `לקוחות - ${title} - ${sale.date}.csv`);
  toastOk('קובץ ה-CSV הורד');
}

/* ======================= ייבוא לקוחות מקובץ ======================= */

/**
 * חלון ייבוא עם מיפוי עמודות.
 * onImport(records[]) מקבל אובייקטים ממופים.
 */
export async function importDialog(targetLabel, onImport) {
  const files = await pickFile('.xlsx,.xlsm,.csv,.tsv,.txt');
  if (!files.length) return;
  let sheets;
  try {
    sheets = await readTableFile(files[0]);
  } catch (e) {
    return toastErr('שגיאה בקריאת הקובץ: ' + e.message);
  }
  const sheet = sheets.find((s) => s.rows && s.rows.length) || sheets[0];
  if (!sheet || !sheet.rows.length) return toastErr('הקובץ ריק');

  const rows = sheet.rows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  const header = rows[0].map((h) => String(h ?? '').trim());
  const dataRows = rows.slice(1);

  const cols = store.state.settings.customerColumns;
  const mapping = {};

  // ניחוש אוטומטי לפי שם הכותרת
  const guess = (label) => {
    const norm = (s) => String(s).replace(/[\s"׳״'`־-]/g, '').toLowerCase();
    const h = norm(label);
    for (const c of cols) {
      if (norm(c.label) === h || norm(c.key) === h) return c.key;
    }
    const alias = {
      'שם': 'firstName', 'שםפרטי': 'firstName', 'firstname': 'firstName', 'name': 'firstName',
      'משפחה': 'lastName', 'שםמשפחה': 'lastName', 'lastname': 'lastName',
      'טלפון': 'phone', 'נייד': 'phone', 'phone': 'phone', 'mobile': 'phone', 'טלפוןנייד': 'phone',
      'מייל': 'email', 'דואל': 'email', 'email': 'email',
      'עיר': 'city', 'city': 'city', 'ישוב': 'city', 'יישוב': 'city',
      'שכונה': 'neighborhood', 'אזור': 'neighborhood',
      'מחיר': 'price', 'סכום': 'price', 'price': 'price',
      'סוגמשקפיים': 'glassesType', 'סוג': 'glassesType',
      'עיןימין': 'rightEye', 'ימין': 'rightEye',
      'עיןשמאל': 'leftEye', 'שמאל': 'leftEye',
      'הערות': 'notes', 'הערה': 'notes',
      'כתובת': 'address', 'רחוב': 'address',
      'תאריך': 'saleDate', 'תאריךמכירה': 'saleDate',
    };
    return alias[h] || '';
  };

  const targets = [
    { value: '', label: '— לא לייבא —' },
    ...cols.map((c) => ({ value: c.key, label: c.label })),
    { value: 'city', label: 'עיר' },
    { value: 'neighborhood', label: 'שכונה' },
    { value: 'address', label: 'כתובת' },
    { value: 'saleDate', label: 'תאריך מכירה' },
    { value: 'saleTitle', label: 'שם/מיקום המכירה' },
  ].filter((v, i, a) => a.findIndex((x) => x.value === v.value) === i);

  const mapRows = header.map((h, i) => {
    mapping[i] = guess(h);
    return el('tr', {}, [
      el('td', { text: h || `עמודה ${i + 1}` }),
      el('td', { text: String(dataRows[0] && dataRows[0][i] !== undefined ? dataRows[0][i] : ''), style: { color: '#64748b' } }),
      el('td', {}, [selectInput(mapping[i], targets, (v) => { mapping[i] = v; })]),
    ]);
  });

  openModal({
    title: `ייבוא נתונים ${targetLabel} — ${dataRows.length} שורות`,
    size: 'wide',
    body: el('div', {}, [
      el('p', { text: 'התאימו כל עמודה בקובץ לשדה במערכת. שורות ללא שם וללא טלפון יידלגו.', style: { marginTop: 0, color: '#64748b' } }),
      el('div.table-wrap', { style: { maxHeight: '52vh' } }, [
        el('table.tbl', {}, [
          el('thead', {}, [el('tr', {}, ['כותרת בקובץ', 'דוגמה', 'שדה במערכת'].map((h) => el('th', { text: h })))]),
          el('tbody', {}, mapRows),
        ]),
      ]),
    ]),
    buttons: [{
      label: 'ייבוא', kind: 'primary',
      onClick: (close) => {
        const records = [];
        for (const r of dataRows) {
          const rec = {};
          for (const [i, key] of Object.entries(mapping)) {
            if (!key) continue;
            const v = r[i];
            if (v === undefined || v === null || String(v).trim() === '') continue;
            rec[key] = String(v).trim();
          }
          if (!rec.firstName && !rec.lastName && !rec.phone) continue;
          records.push(rec);
        }
        close();
        if (!records.length) return toastErr('לא נמצאו שורות תקינות לייבוא');
        onImport(records);
      },
    }],
  });
}

/* ==================== הגדרות טבלת הלקוחות ==================== */

export function tableSettingsDialog(onSaved) {
  const cfg = JSON.parse(JSON.stringify(store.state.settings.tableConfig));
  const cols = JSON.parse(JSON.stringify(store.state.settings.customerColumns));

  const listBox = el('div');

  function drawCols() {
    clear(listBox);
    cols.forEach((c, i) => {
      listBox.appendChild(el('div.row', {
        style: { borderBottom: '1px solid #e2e8f0', padding: '7px 0' },
      }, [
        checkInput(c.visible !== false, (v) => { c.visible = v; }),
        el('input.input', {
          value: c.label, style: { width: '160px' },
          oninput: (e) => { c.label = e.target.value; },
        }),
        selectInput(c.type, [
          { value: 'text', label: 'טקסט' }, { value: 'tel', label: 'טלפון' },
          { value: 'email', label: 'דוא״ל' }, { value: 'money', label: 'סכום' },
          { value: 'check', label: 'סימון ✓' }, { value: 'select', label: 'רשימה' },
        ], (v) => { c.type = v; }, { style: { width: '110px' }, disabled: c.locked }),
        el('input.input', {
          value: (c.options || []).join(', '), placeholder: 'אפשרויות (מופרד בפסיק)',
          style: { flex: '1', minWidth: '120px' },
          oninput: (e) => { c.options = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); },
        }),
        el('input.input', {
          type: 'number', value: c.width || 110, style: { width: '72px' },
          title: 'רוחב', oninput: (e) => { c.width = +e.target.value || 110; },
        }),
        el('button.btn.sm.ghost', { text: '▲', title: 'העלאה', onclick: () => { if (i > 0) { [cols[i - 1], cols[i]] = [cols[i], cols[i - 1]]; drawCols(); } } }),
        el('button.btn.sm.ghost', { text: '▼', title: 'הורדה', onclick: () => { if (i < cols.length - 1) { [cols[i + 1], cols[i]] = [cols[i], cols[i + 1]]; drawCols(); } } }),
        c.locked ? el('span.badge', { text: 'קבוע' })
          : el('button.btn.sm.ghost', { text: '🗑', onclick: () => { cols.splice(i, 1); drawCols(); } }),
      ]));
    });
  }
  drawCols();

  const topTitle = textInput(cfg.topTitle, (v) => { cfg.topTitle = v; });
  const sideHeader = textInput(cfg.sideHeader, (v) => { cfg.sideHeader = v; });
  const sideField = selectInput(cfg.sideHeaderField || 'index', [
    { value: 'index', label: 'מספר שורה רץ' },
    { value: 'lastName', label: 'שם משפחה' },
    { value: 'firstName', label: 'שם פרטי' },
    { value: 'phone', label: 'טלפון' },
  ], (v) => { cfg.sideHeaderField = v; });
  const totals = checkInput(cfg.showTotals !== false, (v) => { cfg.showTotals = v; });

  openModal({
    title: 'הגדרות טבלת הלקוחות',
    size: 'wide',
    body: el('div', {}, [
      el('div.grid.c3', {}, [
        field('כותרת עליונה (מעל הטבלה)', topTitle),
        field('כותרת הצד (העמודה הראשונה)', sideHeader),
        field('תוכן עמודת הצד', sideField),
      ]),
      el('div.checkline', {}, [totals, el('span', { text: 'הצגת שורת סיכומים בתחתית הטבלה' })]),
      el('h4', { text: 'עמודות הטבלה', style: { margin: '16px 0 6px' } }),
      el('p', { text: 'סמנו אילו עמודות יוצגו, שנו שמות, סוג, סדר ורוחב. עמודות "קבוע" נדרשות לחישובים.', style: { margin: '0 0 8px', color: '#64748b', fontSize: '13px' } }),
      listBox,
      el('button.btn', {
        text: '+ הוספת עמודה', style: { marginTop: '10px' },
        onclick: () => {
          cols.push({ key: 'f' + Math.random().toString(36).slice(2, 7), label: 'עמודה חדשה', type: 'text', width: 110, visible: true });
          drawCols();
        },
      }),
    ]),
    buttons: [{
      label: 'שמירה', kind: 'primary',
      onClick: (close) => {
        store.update((s) => {
          s.settings.tableConfig = cfg;
          s.settings.customerColumns = cols;
        });
        close(); toastOk('ההגדרות נשמרו'); onSaved && onSaved();
      },
    }],
  });
}
