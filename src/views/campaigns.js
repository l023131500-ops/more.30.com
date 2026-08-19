/**
 * views/campaigns.js — שליחת צינתוקים/הודעות דרך ימות המשיח ומעקב אחר הנמענים.
 */
import { store, uid, num } from '../store.js';
import {
  el, clear, toast, toastOk, toastErr, openModal, field, textInput,
  selectInput, checkInput, emptyState, kpi, shortDate,
} from '../ui.js';
import * as yemot from '../yemot.js';
import { downloadXlsx } from '../xlsx.js';

/* ===================== חלון שליחת קמפיין ===================== */

/**
 * @param {Array} targets רשומות לקוח (צריך שדה phone)
 * @param {object} opts { sale, title, onDone }
 */
export function openCampaignDialog(targets, opts = {}) {
  const cfg = store.state.settings.yemot;
  const valid = [];
  const invalid = [];
  for (const t of targets) {
    const p = yemot.normalizePhone(t.phone);
    if (p) valid.push({ ...t, phone: p });
    else invalid.push(t);
  }

  const typeSel = selectInput('tzintuk', [
    { value: 'tzintuk', label: 'צינתוק (חיוג ללא מענה)' },
    { value: 'campaign', label: 'קמפיין השמעת הודעה' },
    { value: 'sms', label: 'הודעת SMS' },
    { value: 'rsvp', label: 'קמפיין אישור הגעה (בקרוב)' },
  ], (v) => { typeVal = v; refreshFields(); });
  let typeVal = 'tzintuk';

  const callerId = textInput(cfg.callerId || '', () => {}, { dir: 'ltr', placeholder: 'מספר מזוהה יוצא' });
  const timeout = textInput(String(cfg.tzintukTimeout || 6), () => {}, { type: 'number', style: { maxWidth: '110px' } });
  const messageFile = textInput(cfg.messageFile || '', () => {}, { dir: 'ltr', placeholder: 'ivr2:/1/000.wav' });
  const smsText = el('textarea.input', { placeholder: 'תוכן ההודעה' });
  if (opts.sale) {
    smsText.value = `מכירת משקפיים ${[opts.sale.city, opts.sale.neighborhood].filter(Boolean).join(' ')}` +
      `${opts.sale.hallName ? ' ב' + opts.sale.hallName : ''} בתאריך ${shortDate(opts.sale.date)}` +
      `${opts.sale.startTime ? ' בשעה ' + opts.sale.startTime : ''}.`;
  }
  const dryRun = checkInput(false, (v) => { dryVal = v; });
  let dryVal = false;

  const fieldsBox = el('div');
  function refreshFields() {
    clear(fieldsBox);
    fieldsBox.appendChild(el('div.grid.c2', {}, [
      field('מספר מזוהה יוצא (callerId)', callerId),
      typeVal === 'tzintuk' ? field('משך הצינתוק (שניות)', timeout) : null,
      (typeVal === 'campaign' || typeVal === 'rsvp')
        ? field('קובץ ההודעה במערכת', messageFile) : null,
    ].filter(Boolean)));
    if (typeVal === 'sms' || typeVal === 'campaign') {
      fieldsBox.appendChild(field(typeVal === 'sms' ? 'תוכן ההודעה' : 'טקסט נלווה / הקראה', smsText));
    }
    if (typeVal === 'rsvp') {
      fieldsBox.appendChild(el('div', {
        style: { background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px', fontSize: '13px' },
        text: 'קמפיין אישורי הגעה: התשתית מוכנה. להפעלה יש להגדיר בהגדרות > ימות המשיח שלוחת IVR שמקבלת הקשה 1 = מגיע, 2 = לא מגיע, ולסמן "הפעלת אישורי הגעה".',
      }));
    }
  }
  refreshFields();

  const listBox = el('div.table-wrap', { style: { maxHeight: '30vh', marginTop: '10px' } }, [
    el('table.tbl', {}, [
      el('thead', {}, [el('tr', {}, ['שם', 'טלפון'].map((h) => el('th', { text: h })))]),
      el('tbody', {}, valid.map((t) => el('tr', {}, [
        el('td', { text: [t.firstName, t.lastName].filter(Boolean).join(' ') || '—' }),
        el('td', { text: t.phone, dir: 'ltr' }),
      ]))),
    ]),
  ]);

  openModal({
    title: opts.title || 'שליחת צינתוק / הודעה',
    size: 'wide',
    body: el('div', {}, [
      el('div.row', { style: { marginBottom: '12px' } }, [
        el('span.badge.green', { text: `${valid.length} נמענים תקינים` }),
        invalid.length ? el('span.badge.red', { text: `${invalid.length} ללא טלפון תקין — יידלגו` }) : null,
        yemot.isConfigured()
          ? el('span.badge.blue', { text: 'מערכת ' + store.state.settings.yemot.systemNumber })
          : el('span.badge.red', { text: 'לא הוגדרו פרטי ימות המשיח' }),
      ]),
      field('סוג השליחה', typeSel),
      fieldsBox,
      el('div.checkline', {}, [dryRun, el('span', { text: 'הרצת בדיקה (לא נשלח בפועל — רק רישום ביומן)' })]),
      el('h4', { text: 'רשימת הנמענים', style: { margin: '14px 0 4px', fontSize: '14px' } }),
      valid.length ? listBox : emptyState('אין נמענים עם מספר טלפון תקין', '📵'),
    ]),
    buttons: [{
      label: 'שליחה', kind: 'primary',
      onClick: async (close) => {
        if (!valid.length) return toastErr('אין נמענים תקינים');
        if (!dryVal && !yemot.isConfigured()) {
          return toastErr('יש להגדיר מספר מערכת ומפתח API בהגדרות > ימות המשיח');
        }
        close();
        await sendCampaign(typeVal, valid, {
          callerId: callerId.value,
          timeout: num(timeout.value) || 6,
          messageFile: messageFile.value,
          smsText: smsText.value,
          dryRun: dryVal,
          sale: opts.sale,
        });
        opts.onDone && opts.onDone();
      },
    }],
  });
}

const TYPE_LABELS = {
  tzintuk: 'צינתוק', campaign: 'קמפיין הודעה', sms: 'SMS', rsvp: 'אישור הגעה',
};

async function sendCampaign(type, targets, opts) {
  const phones = targets.map((t) => t.phone);
  const record = {
    id: uid(),
    type,
    typeLabel: TYPE_LABELS[type] || type,
    sentAt: new Date().toISOString(),
    saleId: opts.sale ? opts.sale.id : null,
    saleLabel: opts.sale ? [opts.sale.city, opts.sale.neighborhood].filter(Boolean).join(' · ') : '',
    dryRun: !!opts.dryRun,
    ok: false,
    error: '',
    response: null,
    targets: targets.map((t) => ({
      customerId: t.id || null,
      name: [t.firstName, t.lastName].filter(Boolean).join(' '),
      phone: t.phone,
      status: opts.dryRun ? 'בדיקה' : 'נשלח',
      listened: null,
      rsvp: null,
    })),
  };

  if (opts.dryRun) {
    record.ok = true;
    saveCampaign(record, opts.sale);
    return toastOk(`הרצת בדיקה הושלמה — ${phones.length} נמענים (לא נשלח בפועל)`);
  }

  toast('שולח…');
  try {
    let res;
    if (type === 'tzintuk') {
      res = await yemot.runTzintuk(phones, { callerId: opts.callerId, timeout: opts.timeout, yourId: record.id });
    } else if (type === 'sms') {
      res = await yemot.sendSms(phones, opts.smsText, { from: opts.callerId });
    } else if (type === 'rsvp') {
      res = await yemot.runRsvpCampaign(targets, { callerId: opts.callerId, messageFile: opts.messageFile, smsText: opts.smsText });
    } else {
      res = await yemot.runCampaign(targets, {
        callerId: opts.callerId, messageFile: opts.messageFile,
        smsText: opts.smsText, withSms: Boolean(opts.smsText),
      });
    }
    record.ok = true;
    record.response = res.res || null;
    if (res.res && (res.res.campaignId || res.res.CampaignId)) {
      record.campaignId = res.res.campaignId || res.res.CampaignId;
    }
    toastOk(`נשלח בהצלחה ל-${phones.length} נמענים`);
  } catch (e) {
    record.ok = false;
    record.error = e.message;
    for (const t of record.targets) t.status = 'נכשל';
    toastErr('השליחה נכשלה: ' + e.message);
  }
  saveCampaign(record, opts.sale);
}

function saveCampaign(record, sale) {
  store.update((s) => {
    s.campaigns.push(record);
    if (sale) {
      const target = s.sales.find((x) => x.id === sale.id);
      if (target) {
        if (!target.campaigns) target.campaigns = [];
        target.campaigns.push({
          id: record.id, type: record.type, typeLabel: record.typeLabel,
          sentAt: record.sentAt, ok: record.ok, targets: record.targets,
        });
      }
    }
  });
}

/* ===================== מסך מעקב קמפיינים ===================== */

export function render(root, nav) {
  clear(root);
  const camps = store.state.campaigns.slice().reverse();

  const totalTargets = camps.reduce((a, c) => a + c.targets.length, 0);
  const listened = camps.reduce((a, c) => a + c.targets.filter((t) => t.listened === true).length, 0);
  const rsvpYes = camps.reduce((a, c) => a + c.targets.filter((t) => t.rsvp === 'כן').length, 0);

  root.appendChild(el('div.kpis', {}, [
    kpi('קמפיינים שנשלחו', String(camps.length), '', 'blue'),
    kpi('סה״כ נמענים', String(totalTargets), ''),
    kpi('שמעו את ההודעה', String(listened), totalTargets ? ((listened / totalTargets) * 100).toFixed(0) + '%' : '', 'green'),
    kpi('אישרו הגעה', String(rsvpYes), '', 'purple'),
  ]));

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['מעקב צינתוקים והודעות',
      el('div.spacer'),
      el('button.btn.sm', {
        text: '🔄 עדכון סטטוסים מהמערכת',
        onclick: () => refreshStatuses(root, nav),
      }),
      el('button.btn.sm', { text: '📊 ייצוא', onclick: () => exportCampaigns() }),
    ]),
    el('div.card-body.tight', {}, [
      camps.length ? el('div.table-wrap', {}, [el('table.tbl', {}, [
        el('thead', {}, [el('tr', {}, ['תאריך שליחה', 'סוג', 'מכירה', 'נמענים', 'שמעו', 'אישרו הגעה', 'סטטוס', ''].map((h) => el('th', { text: h })))]),
        el('tbody', {}, camps.map((c) => el('tr', {}, [
          el('td', { text: new Date(c.sentAt).toLocaleString('he-IL') }),
          el('td', { text: c.typeLabel + (c.dryRun ? ' (בדיקה)' : '') }),
          el('td', { text: c.saleLabel || '—' }),
          el('td.center', { text: String(c.targets.length) }),
          el('td.center', { text: String(c.targets.filter((t) => t.listened === true).length) }),
          el('td.center', { text: String(c.targets.filter((t) => t.rsvp === 'כן').length) }),
          el('td', {}, [el('span.badge' + (c.ok ? '.green' : '.red'), { text: c.ok ? 'נשלח' : 'נכשל' }),
            c.error ? el('div', { text: c.error, style: { fontSize: '11px', color: '#b91c1c' } }) : null]),
          el('td', {}, [el('button.btn.sm.primary', { text: 'פירוט', onclick: () => showDetail(c, root, nav) })]),
        ]))),
      ])]) : emptyState('טרם נשלחו צינתוקים. שליחה מתבצעת ממסך יום המכירה או ממסך מכירות קודמות.', '📞'),
    ]),
  ]));
}

function showDetail(camp, root, nav) {
  const rows = camp.targets.map((t, i) => el('tr', {}, [
    el('td.center', { text: String(i + 1) }),
    el('td', { text: t.name || '—' }),
    el('td', { text: t.phone, dir: 'ltr' }),
    el('td', {}, [selectInput(t.status || '', ['נשלח', 'נענה', 'לא נענה', 'תפוס', 'נכשל', 'בדיקה'], (v) => {
      t.status = v; store.save();
    })]),
    el('td.center', {}, [checkInput(t.listened === true, (v) => { t.listened = v; store.save(); })]),
    el('td', {}, [selectInput(t.rsvp || '', ['', 'כן', 'לא', 'אולי'], (v) => { t.rsvp = v; store.save(); })]),
  ]));

  openModal({
    title: `פירוט ${camp.typeLabel} — ${new Date(camp.sentAt).toLocaleString('he-IL')}`,
    size: 'wide',
    body: el('div', {}, [
      camp.error ? el('div', { text: 'שגיאה: ' + camp.error, style: { color: '#b91c1c', marginBottom: '10px' } }) : null,
      el('p', { text: 'ניתן לעדכן ידנית מי שמע את ההודעה ומי אישר הגעה, או לרענן אוטומטית מהמערכת.', style: { color: '#64748b', marginTop: 0 } }),
      el('div.table-wrap', { style: { maxHeight: '55vh' } }, [el('table.tbl', {}, [
        el('thead', {}, [el('tr', {}, ['#', 'שם', 'טלפון', 'סטטוס שיחה', 'שמע', 'אישור הגעה'].map((h) => el('th', { text: h })))]),
        el('tbody', {}, rows),
      ])]),
      camp.response ? el('details', { style: { marginTop: '12px' } }, [
        el('summary', { text: 'תשובת ה-API הגולמית' }),
        el('pre', { text: JSON.stringify(camp.response, null, 2), style: { fontSize: '11px', overflow: 'auto', direction: 'ltr', background: '#f8fafc', padding: '8px' } }),
      ]) : null,
    ]),
    buttons: [{
      label: 'ייצוא לאקסל', kind: '',
      onClick: () => {
        downloadXlsx([{
          name: 'נמענים',
          rows: [['#', 'שם', 'טלפון', 'סטטוס', 'שמע', 'אישור הגעה'],
            ...camp.targets.map((t, i) => [i + 1, t.name, t.phone, t.status, t.listened ? 'כן' : 'לא', t.rsvp || ''])],
        }], `צינתוק ${camp.sentAt.slice(0, 10)}.xlsx`);
      },
    }],
    onClose: () => render(root, nav),
  });
}

async function refreshStatuses(root, nav) {
  const withId = store.state.campaigns.filter((c) => c.campaignId && !c.dryRun);
  if (!withId.length) return toast('אין קמפיינים עם מזהה לעדכון. ניתן לעדכן ידנית במסך הפירוט.');
  let updated = 0;
  for (const c of withId) {
    try {
      const rep = await yemot.getCampaignReport(c.campaignId);
      const list = rep.rows || rep.report || rep.data || [];
      for (const row of list) {
        const phone = yemot.normalizePhone(row.phone || row.Phone || row.did);
        const t = c.targets.find((x) => x.phone === phone);
        if (!t) continue;
        t.status = yemot.statusLabel(row.status || row.Status);
        if (row.listened !== undefined) t.listened = Boolean(row.listened);
        updated++;
      }
    } catch (e) {
      toastErr('עדכון נכשל: ' + e.message);
    }
  }
  store.save();
  toastOk(`עודכנו ${updated} רשומות`);
  render(root, nav);
}

function exportCampaigns() {
  const rows = [['תאריך', 'סוג', 'מכירה', 'שם', 'טלפון', 'סטטוס', 'שמע', 'אישור הגעה']];
  for (const c of store.state.campaigns) {
    for (const t of c.targets) {
      rows.push([new Date(c.sentAt).toLocaleString('he-IL'), c.typeLabel, c.saleLabel,
        t.name, t.phone, t.status, t.listened ? 'כן' : 'לא', t.rsvp || '']);
    }
  }
  downloadXlsx([{ name: 'קמפיינים', rows }], 'דוח צינתוקים.xlsx');
  toastOk('הדוח הורד');
}
