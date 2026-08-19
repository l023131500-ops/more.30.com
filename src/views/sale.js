/**
 * views/sale.js — דשבורד יום המכירה:
 * פרטי המכירה, הוצאות ותשלומים, לוח מחוונים לרווחיות, טבלת לקוחות,
 * מודעה (העלאה/צפייה/הורדה), משימות והערות, ושליחת צינתוק.
 */
import { store, uid, num, saleTotals, PAYMENT_METHODS, PAYMENT_STATUS } from '../store.js';
import { dayInfo, todayIso } from '../hebcal.js';
import { evaluateDay } from '../holidays.js';
import {
  el, clear, money, numFmt, pct, fullDate, toast, toastOk, toastErr,
  confirmDialog, openModal, field, textInput, numberInput, selectInput,
  checkInput, dateInput, pickFile, emptyState, barChart, kpi,
} from '../ui.js';
import { downloadBlob, downloadXlsx } from '../xlsx.js';
import {
  renderCustomerTable, addCustomer, exportCustomersXlsx, exportCustomersCsv,
  tableSettingsDialog, importDialog, activeColumns,
} from './customers.js';
import { openCampaignDialog } from './campaigns.js';

export function render(root, nav, params) {
  const sale = store.getSale(params.id);
  if (!sale) {
    clear(root);
    root.appendChild(emptyState('המכירה לא נמצאה', '🔍'));
    root.appendChild(el('button.btn.primary', { text: 'חזרה ללוח השנה', onclick: () => nav('calendar') }));
    return;
  }
  const rerender = () => render(root, nav, params);
  clear(root);

  const info = dayInfo(sale.date);
  const ev = evaluateDay(sale.date, store.state.settings.holidayRules, store.state.settings.weekend);
  const siblings = store.salesOn(sale.date);

  /* ------------------------------ כותרת ------------------------------ */
  root.appendChild(el('div.row', { style: { marginBottom: '14px' } }, [
    el('button.btn', { text: '→ חזרה ללוח', onclick: () => nav('calendar') }),
    el('div', {}, [
      el('div', { text: [sale.city, sale.neighborhood, sale.hallName].filter(Boolean).join(' · ') || 'מכירה חדשה',
        style: { fontSize: '20px', fontWeight: '700' } }),
      el('div', { text: fullDate(sale.date), style: { fontSize: '13px', color: '#64748b' } }),
    ]),
    siblings.length > 1 ? el('span.badge.purple', { text: `מכירה ${sale.slot} מתוך ${siblings.length}` }) : null,
    ev.blocked ? el('span.badge.amber', { text: 'שימו לב: ' + ev.reason }) : null,
    el('div.spacer'),
    ...siblings.filter((s) => s.id !== sale.id).map((s) =>
      el('button.btn.sm', { text: `מעבר למכירה ${s.slot}`, onclick: () => nav('sale', { id: s.id }) })),
    el('button.btn.sm', {
      text: '+ מכירה נוספת ביום זה',
      onclick: () => { const s = store.createSale(sale.date); nav('sale', { id: s.id }); },
    }),
    el('button.btn.sm.danger', {
      text: 'מחיקת מכירה',
      onclick: () => confirmDialog('למחוק את המכירה וכל הנתונים שבה? פעולה זו אינה הפיכה.',
        () => { store.deleteSale(sale.id); nav('calendar'); toast('המכירה נמחקה'); },
        { danger: true, yes: 'מחיקה' }),
    }),
  ]));

  /* ------------------------------ מחוונים ------------------------------ */
  const kpiBox = el('div.kpis');
  root.appendChild(kpiBox);

  function drawKpis() {
    clear(kpiBox);
    const t = saleTotals(sale);
    kpiBox.appendChild(kpi('לקוחות', String(t.count), `ממוצע ${money(t.avgTicket)} ללקוח`, 'blue'));
    kpiBox.appendChild(kpi('סה״כ מכירות', money(t.revenue), '', 'green'));
    kpiBox.appendChild(kpi('שולם', money(t.collected), `${t.paidCount} מתוך ${t.count} לקוחות`, 'green'));
    kpiBox.appendChild(kpi('נותר לתשלום', money(t.outstanding), '', t.outstanding > 0 ? 'amber' : ''));
    kpiBox.appendChild(kpi('הוצאות', money(t.expenses), `שולמו ${money(t.expensesPaid)}`, 'red'));
    kpiBox.appendChild(kpi('רווח', money(t.profit), 'רווחיות ' + pct(t.margin), t.profit >= 0 ? 'purple' : 'red'));
    kpiBox.appendChild(kpi('נמסרו משקפיים', `${t.delivered}/${t.count}`, `${t.notDelivered} ממתינים למסירה`, ''));
  }
  drawKpis();

  /* --------------------------- פרטי המכירה --------------------------- */
  const upd = (k) => (v) => { store.update(() => { sale[k] = v; }); };
  const updRe = (k) => (v) => { sale[k] = v; store.save(); };

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['ניהול המכירה — פרטי המיקום',
      el('div.spacer'),
      el('button.btn.sm', { text: '🖨 הדפסה', onclick: () => window.print() }),
    ]),
    el('div.card-body', {}, [
      el('div.grid.c4', {}, [
        field('עיר האולם', textInput(sale.city, updRe('city'), { placeholder: 'לדוגמה: ירושלים', onchange: rerender })),
        field('שם האולם', textInput(sale.hallName, updRe('hallName'), { placeholder: 'שם האולם', onchange: rerender })),
        field('שכונה', textInput(sale.neighborhood, updRe('neighborhood'), { placeholder: 'שכונה', onchange: rerender })),
        field('רחוב', textInput(sale.street, updRe('street'))),
        field('מספר', textInput(sale.houseNumber, updRe('houseNumber'), { style: { maxWidth: '110px' } })),
        field('תאריך המכירה', dateInput(sale.date, (v) => {
          if (!v) return;
          store.update(() => { sale.date = v; sale.slot = store.salesOn(v).length; });
          toastOk('התאריך עודכן'); rerender();
        })),
        field('שעת התחלה', el('input.input', { type: 'time', value: sale.startTime || '', onchange: (e) => updRe('startTime')(e.target.value) })),
        field('שעת סיום', el('input.input', { type: 'time', value: sale.endTime || '', onchange: (e) => updRe('endTime')(e.target.value) })),
        field('סטטוס', selectInput(sale.status, [
          { value: 'planned', label: 'מתוכננת' },
          { value: 'confirmed', label: 'מאושרת' },
          { value: 'done', label: 'הסתיימה' },
          { value: 'cancelled', label: 'בוטלה' },
        ], upd('status'))),
        field('אופי המכירה', selectInput(sale.separation || '', [
          '', 'הפרדה מלאה', 'לנשים בלבד', 'לגברים בלבד', 'מעורב', 'לפי שעות',
        ], upd('separation'))),
        field('איש קשר', textInput(sale.contactName, updRe('contactName'))),
        field('טלפון איש קשר', textInput(sale.contactPhone, updRe('contactPhone'), { type: 'tel', dir: 'ltr' })),
      ]),
    ]),
  ]));

  /* ------------------------- הוצאות ותשלומים ------------------------- */
  const costsCard = el('div.card');
  root.appendChild(costsCard);
  drawCosts();

  function drawCosts() {
    clear(costsCard);
    costsCard.appendChild(el('h3', {}, ['הוצאות המכירה ותשלומים',
      el('div.spacer'),
      el('button.btn.sm.primary', {
        text: '+ הוספת שורת הוצאה',
        onclick: () => {
          store.update(() => sale.costs.push({
            id: uid(), label: '', amount: 0, paymentMethod: 'טרם שולם',
            paidTo: '', status: 'טרם שולם', dueDate: '', note: '',
          }));
          drawCosts(); drawKpis(); drawProfit();
        },
      }),
    ]));

    const body = el('div.card-body.tight');
    const rows = sale.costs.map((c, i) => el('tr', {}, [
      el('td.center', { text: String(i + 1), class: 'rownum' }),
      el('td', {}, [el('input', {
        value: c.label, placeholder: 'תיאור ההוצאה',
        oninput: (e) => { c.label = e.target.value; store.save(); },
      })]),
      el('td', {}, [el('input', {
        type: 'number', step: 'any', value: c.amount ?? '',
        oninput: (e) => { c.amount = e.target.value === '' ? '' : parseFloat(e.target.value); store.save(); },
        onchange: () => { drawKpis(); drawProfit(); drawCostFoot(); },
      })]),
      el('td', {}, [selectInput(c.paymentMethod, PAYMENT_METHODS, (v) => { c.paymentMethod = v; store.save(); })]),
      el('td', {}, [el('input', {
        value: c.paidTo, placeholder: 'למי מעבירים',
        oninput: (e) => { c.paidTo = e.target.value; store.save(); },
      })]),
      el('td', {}, [selectInput(c.status, PAYMENT_STATUS, (v) => {
        c.status = v; store.save(); drawKpis(); drawProfit();
      })]),
      el('td', {}, [el('input', {
        type: 'date', value: c.dueDate || '',
        onchange: (e) => { c.dueDate = e.target.value; store.save(); },
      })]),
      el('td', {}, [el('input', {
        value: c.note, placeholder: 'הערה',
        oninput: (e) => { c.note = e.target.value; store.save(); },
      })]),
      el('td.center', {}, [el('button.btn.sm.ghost', {
        text: '🗑',
        onclick: () => {
          store.update(() => { sale.costs = sale.costs.filter((x) => x.id !== c.id); });
          drawCosts(); drawKpis(); drawProfit();
        },
      })]),
    ]));

    const tfoot = el('tfoot');
    const table = el('table.tbl', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: '#', style: { width: '40px' } }),
        el('th', { text: 'סעיף ההוצאה' }),
        el('th', { text: 'סכום', style: { width: '110px' } }),
        el('th', { text: 'אופן התשלום', style: { width: '140px' } }),
        el('th', { text: 'למי מעבירים', style: { width: '150px' } }),
        el('th', { text: 'סטטוס', style: { width: '130px' } }),
        el('th', { text: 'תאריך יעד', style: { width: '140px' } }),
        el('th', { text: 'הערה' }),
        el('th', { text: '', style: { width: '46px' } }),
      ])]),
      el('tbody', {}, rows.length ? rows : [el('tr', {}, [el('td', { colspan: '9' }, [emptyState('אין הוצאות רשומות', '💰')])])]),
      tfoot,
    ]);

    function drawCostFoot() {
      clear(tfoot);
      const total = sale.costs.reduce((a, c) => a + num(c.amount), 0);
      const paid = sale.costs.filter((c) => c.status === 'שולם').reduce((a, c) => a + num(c.amount), 0);
      tfoot.appendChild(el('tr', {}, [
        el('td', { colspan: '2', text: 'סה״כ הוצאות' }),
        el('td', { text: money(total) }),
        el('td', { colspan: '2', text: 'מתוכן שולמו' }),
        el('td', { text: money(paid), colspan: '2' }),
        el('td', { text: 'יתרה: ' + money(total - paid), colspan: '2' }),
      ]));
    }
    drawCostFoot();

    body.appendChild(el('div.table-wrap', {}, [table]));
    costsCard.appendChild(body);
  }

  /* ------------------------ לוח מחוונים רווחיות ------------------------ */
  const profitCard = el('div.card');
  root.appendChild(profitCard);
  drawProfit();

  function drawProfit() {
    clear(profitCard);
    const t = saleTotals(sale);
    profitCard.appendChild(el('h3', {}, ['לוח מחוונים — רווחיות המכירה']));
    const byMethod = Object.entries(t.byMethod);
    profitCard.appendChild(el('div.card-body', {}, [
      el('div.grid.c2', {}, [
        el('div', {}, [
          el('h4', { text: 'הכנסות מול הוצאות', style: { margin: '0 0 4px', fontSize: '14px' } }),
          barChart([
            { label: 'הכנסות', value: t.revenue, color: 'green' },
            { label: 'נגבה', value: t.collected, color: 'green' },
            { label: 'הוצאות', value: t.expenses, color: 'red' },
            { label: 'רווח', value: t.profit, color: t.profit >= 0 ? '' : 'red' },
          ], (v) => money(v)),
        ]),
        el('div', {}, [
          el('h4', { text: 'פילוח אמצעי תשלום', style: { margin: '0 0 4px', fontSize: '14px' } }),
          byMethod.length
            ? barChart(byMethod.map(([k, v]) => ({ label: k, value: v })), (v) => money(v))
            : emptyState('טרם נרשמו תשלומים', '💳'),
        ]),
      ]),
      el('div.row', { style: { marginTop: '10px', gap: '18px' } }, [
        el('span', { text: `נקודת איזון: ${t.avgTicket > 0 ? Math.ceil(t.expenses / t.avgTicket) : '—'} לקוחות` }),
        el('span', { text: `הוצאה ממוצעת ללקוח: ${t.count ? money(t.expenses / t.count) : '—'}` }),
        el('span', { text: `רווח ממוצע ללקוח: ${t.count ? money(t.profit / t.count) : '—'}` }),
      ]),
    ]));
  }

  /* ---------------------------- טבלת לקוחות ---------------------------- */
  const custCard = el('div.card');
  root.appendChild(custCard);
  let selection = new Set();
  drawCustomers();

  function drawCustomers() {
    clear(custCard);
    const cfg = store.state.settings.tableConfig;
    custCard.appendChild(el('h3', {}, [
      cfg.topTitle || 'רשימת לקוחות',
      el('div.spacer'),
      el('button.btn.sm.primary', {
        text: '+ הוספת לקוח',
        onclick: () => { addCustomer(sale); drawCustomers(); drawKpis(); drawProfit(); },
      }),
      el('button.btn.sm', {
        text: '📥 ייבוא מאקסל',
        onclick: () => importDialog('לרשימת הלקוחות', (records) => {
          store.update(() => {
            for (const r of records) {
              const c = { id: uid(), createdAt: new Date().toISOString() };
              for (const col of store.state.settings.customerColumns) {
                c[col.key] = col.type === 'check' ? false : '';
              }
              Object.assign(c, r);
              if (c.price) c.price = num(c.price);
              sale.customers.push(c);
            }
          });
          toastOk(`יובאו ${records.length} לקוחות`);
          drawCustomers(); drawKpis(); drawProfit();
        }),
      }),
      el('button.btn.sm', { text: '📊 הורדת אקסל', onclick: () => exportCustomersXlsx(sale) }),
      el('button.btn.sm', { text: '📄 CSV', onclick: () => exportCustomersCsv(sale) }),
      el('button.btn.sm', {
        text: '📞 שליחת צינתוק',
        onclick: () => {
          const targets = (selection.size
            ? sale.customers.filter((c) => selection.has(c.id))
            : sale.customers);
          openCampaignDialog(targets, { sale, onDone: () => drawCustomers() });
        },
      }),
      el('button.btn.sm', { text: '⚙ הגדרות טבלה', onclick: () => tableSettingsDialog(() => { drawCustomers(); drawKpis(); }) }),
    ]));

    const selInfo = el('div', {
      style: { padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b' },
      text: 'סמנו לקוחות בעמודה הימנית כדי לשלוח להם צינתוק. ללא סימון — הצינתוק יישלח לכל הלקוחות.',
    });
    custCard.appendChild(selInfo);

    const tbl = renderCustomerTable(sale, () => { drawKpis(); drawProfit(); }, {
      selectable: true,
      selection,
      onSelectionChange: (ids) => {
        selInfo.textContent = ids.length
          ? `${ids.length} לקוחות מסומנים לשליחת צינתוק`
          : 'סמנו לקוחות בעמודה הימנית כדי לשלוח להם צינתוק. ללא סימון — הצינתוק יישלח לכל הלקוחות.';
      },
    });
    custCard.appendChild(el('div.card-body.tight', {}, [tbl]));
  }

  /* --------------------- מודעה / משימות / הערות --------------------- */
  root.appendChild(el('div.grid.c3', {}, [adCard(), tasksCard(), notesCard()]));

  /* ------------------------------ מודעה ------------------------------ */
  function adCard() {
    const card = el('div.card');
    const draw = () => {
      clear(card);
      card.appendChild(el('h3', {}, ['מודעת המכירה',
        el('div.spacer'),
        el('button.btn.sm.primary', {
          text: '⬆ העלאה',
          onclick: async () => {
            const files = await pickFile('image/*,application/pdf', true);
            if (!files.length) return;
            for (const f of files) {
              const id = uid();
              await store.putFile(id, f);
              store.update(() => sale.ads.push({
                id, name: f.name, type: f.type, size: f.size, uploadedAt: new Date().toISOString(),
              }));
            }
            toastOk('המודעה הועלתה'); draw();
          },
        }),
      ]));
      const body = el('div.card-body');
      if (!sale.ads.length) {
        body.appendChild(emptyState('לא הועלתה מודעה למכירה זו', '📰'));
      } else {
        for (const ad of sale.ads) {
          const box = el('div.ad-thumb', { style: { marginBottom: '10px' } });
          store.getFile(ad.id).then((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            if ((ad.type || '').startsWith('image/')) {
              box.insertBefore(el('img', { src: url, alt: ad.name }), box.firstChild);
            }
            box.querySelector('[data-view]').onclick = () => window.open(url, '_blank');
            box.querySelector('[data-dl]').onclick = () => downloadBlob(blob, ad.name);
          });
          box.appendChild(el('div.meta', {}, [
            el('span', { text: ad.name, style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
            el('button.btn.sm', { text: '👁 צפייה', 'data-view': '1' }),
            el('button.btn.sm', { text: '⬇ הורדה', 'data-dl': '1' }),
            el('button.btn.sm.ghost', {
              text: '🗑',
              onclick: () => confirmDialog('למחוק את המודעה?', async () => {
                await store.delFile(ad.id);
                store.update(() => { sale.ads = sale.ads.filter((a) => a.id !== ad.id); });
                draw();
              }, { danger: true, yes: 'מחיקה' }),
            }),
          ]));
          body.appendChild(box);
        }
      }
      card.appendChild(body);
    };
    draw();
    return card;
  }

  /* ------------------------------ משימות ------------------------------ */
  function tasksCard() {
    const card = el('div.card');
    const draw = () => {
      clear(card);
      const open = sale.tasks.filter((t) => !t.done).length;
      card.appendChild(el('h3', {}, ['משימות למכירה',
        open ? el('span.badge.amber', { text: `${open} פתוחות` }) : el('span.badge.green', { text: 'הכל הושלם' }),
        el('div.spacer'),
        el('button.btn.sm.primary', { text: '+', title: 'הוספת משימה', onclick: () => addTask() }),
      ]));
      const body = el('div.card-body.tight');
      if (!sale.tasks.length) body.appendChild(emptyState('אין משימות', '✅'));
      else {
        body.appendChild(el('ul.mini-list', {}, sale.tasks.map((t) => el('li', { class: t.done ? 'done' : '' }, [
          checkInput(t.done, (v) => { store.update(() => { t.done = v; }); draw(); }),
          el('span.txt', { text: t.title, style: { flex: '1' } }),
          t.assignee ? el('span.badge', { text: t.assignee }) : null,
          t.dueDate ? el('span.badge.blue', { text: t.dueDate }) : null,
          el('button.btn.sm.ghost', {
            text: '🗑',
            onclick: () => { store.update(() => { sale.tasks = sale.tasks.filter((x) => x.id !== t.id); }); draw(); },
          }),
        ]))));
      }
      const quick = el('div', { style: { padding: '10px 12px', borderTop: '1px solid #e2e8f0' } }, [
        el('div', { text: 'תבניות מהירות:', style: { fontSize: '12px', color: '#64748b', marginBottom: '5px' } }),
        el('div.row', {}, store.state.settings.taskTemplates.map((tp) => el('button.btn.sm', {
          text: tp,
          onclick: () => {
            store.update(() => sale.tasks.push({ id: uid(), title: tp, done: false, assignee: '', dueDate: '', note: '' }));
            draw();
          },
        }))),
      ]);
      body.appendChild(quick);
      card.appendChild(body);
    };

    function addTask() {
      const title = textInput('', () => {}, { placeholder: 'תיאור המשימה' });
      const assignee = textInput('', () => {}, { placeholder: 'אחראי' });
      const due = el('input.input', { type: 'date' });
      openModal({
        title: 'הוספת משימה', size: 'narrow',
        body: el('div', {}, [field('משימה', title), field('אחראי', assignee), field('תאריך יעד', due)]),
        buttons: [{
          label: 'הוספה', kind: 'primary',
          onClick: (c) => {
            if (!title.value.trim()) return toastErr('יש להזין תיאור משימה');
            store.update(() => sale.tasks.push({
              id: uid(), title: title.value.trim(), assignee: assignee.value,
              dueDate: due.value, done: false, note: '',
            }));
            c(); draw();
          },
        }],
      });
    }
    draw();
    return card;
  }

  /* ------------------------------ הערות ------------------------------ */
  function notesCard() {
    const card = el('div.card');
    const draw = () => {
      clear(card);
      card.appendChild(el('h3', {}, ['הערות המכירה',
        el('div.spacer'),
        el('button.btn.sm.primary', { text: '+', title: 'הוספת הערה', onclick: () => addNote() }),
      ]));
      const body = el('div.card-body.tight');
      if (!sale.notes.length) body.appendChild(emptyState('אין הערות. לדוגמה: "מכירה בהפרדה מלאה"', '📝'));
      else {
        body.appendChild(el('ul.mini-list', {}, sale.notes.map((n) => el('li', {}, [
          el('div', { style: { flex: '1' } }, [
            el('div', { text: n.text, style: { whiteSpace: 'pre-wrap' } }),
            el('div', { text: new Date(n.createdAt).toLocaleString('he-IL'), style: { fontSize: '11px', color: '#94a3b8' } }),
          ]),
          el('button.btn.sm.ghost', {
            text: '🗑',
            onclick: () => { store.update(() => { sale.notes = sale.notes.filter((x) => x.id !== n.id); }); draw(); },
          }),
        ]))));
      }
      card.appendChild(body);
    };
    function addNote() {
      const ta = el('textarea.input', { placeholder: 'לדוגמה: מכירה בהפרדה מלאה / הכניסה מרחוב צדדי / נדרש אישור ועד' });
      openModal({
        title: 'הוספת הערה', size: 'narrow',
        body: field('הערה', ta),
        buttons: [{
          label: 'שמירה', kind: 'primary',
          onClick: (c) => {
            if (!ta.value.trim()) return toastErr('ההערה ריקה');
            store.update(() => sale.notes.push({ id: uid(), text: ta.value.trim(), createdAt: new Date().toISOString() }));
            c(); draw();
          },
        }],
      });
    }
    draw();
    return card;
  }

  /* --------------------------- קמפיינים ליום --------------------------- */
  if (sale.campaigns && sale.campaigns.length) {
    root.appendChild(el('div.card', {}, [
      el('h3', {}, ['היסטוריית צינתוקים והודעות במכירה זו',
        el('div.spacer'),
        el('button.btn.sm', { text: 'מסך מעקב מלא', onclick: () => nav('campaigns') }),
      ]),
      el('div.card-body.tight', {}, [
        el('div.table-wrap', {}, [el('table.tbl', {}, [
          el('thead', {}, [el('tr', {}, ['תאריך', 'סוג', 'נמענים', 'סטטוס'].map((h) => el('th', { text: h })))]),
          el('tbody', {}, sale.campaigns.slice().reverse().map((c) => el('tr', {}, [
            el('td', { text: new Date(c.sentAt).toLocaleString('he-IL') }),
            el('td', { text: c.typeLabel || c.type }),
            el('td.center', { text: String((c.targets || []).length) }),
            el('td', {}, [el('span.badge' + (c.ok ? '.green' : '.red'), { text: c.ok ? 'נשלח' : 'נכשל' })]),
          ]))),
        ])]),
      ]),
    ]));
  }
}
