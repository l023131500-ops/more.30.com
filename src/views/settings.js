/**
 * views/settings.js — הגדרות המערכת: כללי לוח השנה, ימות המשיח,
 * טבלת הלקוחות, סעיפי הוצאה קבועים, תבניות משימות, גיבוי ושחזור.
 */
import { store, DEFAULT_COST_ROWS, uid } from '../store.js';
import { HOLIDAY_KINDS } from '../holidays.js';
import {
  el, clear, toast, toastOk, toastErr, confirmDialog, field, textInput,
  selectInput, checkInput, numberInput, pickFile, emptyState,
} from '../ui.js';
import { downloadBlob } from '../xlsx.js';
import { tableSettingsDialog } from './customers.js';
import * as yemot from '../yemot.js';

export function render(root, nav) {
  clear(root);
  const S = store.state.settings;
  const save = () => store.save();

  /* ------------------------------ כללי ------------------------------ */
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['הגדרות כלליות']),
    el('div.card-body', {}, [
      el('div.grid.c3', {}, [
        field('שם הארגון', textInput(S.orgName, (v) => { S.orgName = v; save(); refreshBrand(); })),
        field('כותרת משנה', textInput(S.subtitle, (v) => { S.subtitle = v; save(); refreshBrand(); })),
        field('סמל מטבע', textInput(S.currency, (v) => { S.currency = v || '₪'; save(); })),
      ]),
    ]),
  ]));

  /* --------------------------- ימות המשיח --------------------------- */
  const yem = S.yemot;
  const statusBox = el('div', { style: { marginTop: '10px' } });

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['חיבור למערכת ימות המשיח (צינתוקים ו-SMS)']),
    el('div.card-body', {}, [
      el('p', {
        style: { marginTop: 0, color: '#64748b', fontSize: '13.5px' },
        text: 'הזינו את מספר המערכת ואת סיסמת/מפתח ה-API. הנתונים נשמרים מקומית בדפדפן. ' +
              'מומלץ לעבוד במצב "דרך שרת ביניים" כדי למנוע חסימות CORS ולהסתיר את המפתח.',
      }),
      el('div.grid.c3', {}, [
        field('מספר המערכת (טלפון)', textInput(yem.systemNumber, (v) => { yem.systemNumber = v.trim(); save(); }, { dir: 'ltr', placeholder: '077-XXXXXXX' })),
        field('מפתח API / סיסמה', el('input.input', {
          type: 'password', value: yem.apiKey || '', dir: 'ltr', placeholder: '••••••',
          oninput: (e) => { yem.apiKey = e.target.value.trim(); save(); },
        })),
        field('מספר מזוהה יוצא (callerId)', textInput(yem.callerId, (v) => { yem.callerId = v.trim(); save(); }, { dir: 'ltr' })),
        field('משך צינתוק (שניות)', numberInput(yem.tzintukTimeout, (v) => { yem.tzintukTimeout = v || 6; save(); })),
        field('אופן החיבור', selectInput(yem.mode, [
          { value: 'proxy', label: 'דרך שרת ביניים (מומלץ)' },
          { value: 'direct', label: 'ישירות מהדפדפן' },
        ], (v) => { yem.mode = v; save(); render(root, nav); })),
        yem.mode === 'proxy'
          ? field('כתובת שרת הביניים', textInput(yem.proxyUrl, (v) => { yem.proxyUrl = v; save(); }, { dir: 'ltr', placeholder: '/api/yemot' }))
          : field('כתובת ה-API', textInput(yem.baseUrl, (v) => { yem.baseUrl = v; save(); }, { dir: 'ltr' })),
        field('קובץ ההודעה במערכת', textInput(yem.messageFile, (v) => { yem.messageFile = v; save(); }, { dir: 'ltr', placeholder: 'ivr2:/1/000.wav' })),
        field('טקסט להקראה (TTS)', textInput(yem.ttsText, (v) => { yem.ttsText = v; save(); })),
      ]),
      el('div.checkline', {}, [
        checkInput(yem.rsvpEnabled, (v) => { yem.rsvpEnabled = v; save(); render(root, nav); }),
        el('span', { text: 'הפעלת קמפיין אישורי הגעה (דורש שלוחת IVR ייעודית)' }),
      ]),
      yem.rsvpEnabled
        ? field('שלוחת אישורי ההגעה', textInput(yem.rsvpExtension, (v) => { yem.rsvpExtension = v; save(); }, { dir: 'ltr', placeholder: 'ivr2:/5' }))
        : null,
      el('div.row', { style: { marginTop: '10px' } }, [
        el('button.btn.primary', {
          text: 'שמירה ובדיקת חיבור',
          onclick: async () => {
            store.save(true);
            clear(statusBox);
            statusBox.appendChild(el('span.badge', { text: 'בודק חיבור…' }));
            try {
              const res = await yemot.testConnection();
              clear(statusBox);
              statusBox.appendChild(el('span.badge.green', { text: 'החיבור תקין ✓' }));
              statusBox.appendChild(el('pre', {
                text: JSON.stringify(res, null, 2),
                style: { fontSize: '11px', direction: 'ltr', background: '#f8fafc', padding: '8px', marginTop: '8px', maxHeight: '160px', overflow: 'auto' },
              }));
              toastOk('החיבור לימות המשיח תקין');
            } catch (e) {
              clear(statusBox);
              statusBox.appendChild(el('span.badge.red', { text: 'שגיאה: ' + e.message }));
              toastErr(e.message);
            }
          },
        }),
        el('span', { text: 'תיעוד מלא: docs/YEMOT_API.md', style: { color: '#64748b', fontSize: '13px' } }),
      ]),
      statusBox,
    ]),
  ]));

  /* ----------------------- לוח שנה ומועדים ----------------------- */
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['לוח השנה — ימים שאינם פנויים למכירה']),
    el('div.card-body', {}, [
      el('p', { style: { marginTop: 0, color: '#64748b', fontSize: '13.5px' },
        text: 'בחרו אילו ימים ייחסמו אוטומטית ויוצגו באפור בלוח השנה.' }),
      el('div.grid.c2', {}, [
        el('div.checkline', {}, [
          checkInput(S.weekend.friday, (v) => { S.weekend.friday = v; save(); }),
          el('span', { text: 'יום שישי — ללא מכירות' }),
        ]),
        el('div.checkline', {}, [
          checkInput(S.weekend.saturday, (v) => { S.weekend.saturday = v; save(); }),
          el('span', { text: 'שבת — ללא מכירות' }),
        ]),
      ]),
      el('h4', { text: 'מועדי ישראל', style: { margin: '14px 0 6px' } }),
      el('div.grid.c3', {}, Object.entries(HOLIDAY_KINDS).map(([key, meta]) =>
        el('div.checkline', {}, [
          checkInput(S.holidayRules[key], (v) => { S.holidayRules[key] = v; save(); }),
          el('span', { text: meta.label }),
        ]))),
    ]),
  ]));

  /* ----------------------- סעיפי הוצאה קבועים ----------------------- */
  const costBox = el('div');
  function drawCosts() {
    clear(costBox);
    S.defaultCostRows.forEach((c, i) => {
      costBox.appendChild(el('div.row', { style: { padding: '6px 0', borderBottom: '1px solid #e2e8f0' } }, [
        el('input.input', { value: c.label, style: { flex: '1' }, oninput: (e) => { c.label = e.target.value; save(); } }),
        el('input.input', { type: 'number', value: c.amount || 0, style: { width: '120px' }, placeholder: 'סכום ברירת מחדל',
          oninput: (e) => { c.amount = parseFloat(e.target.value) || 0; save(); } }),
        el('button.btn.sm.ghost', { text: '▲', onclick: () => { if (i > 0) { [S.defaultCostRows[i - 1], S.defaultCostRows[i]] = [S.defaultCostRows[i], S.defaultCostRows[i - 1]]; save(); drawCosts(); } } }),
        el('button.btn.sm.ghost', { text: '▼', onclick: () => { if (i < S.defaultCostRows.length - 1) { [S.defaultCostRows[i + 1], S.defaultCostRows[i]] = [S.defaultCostRows[i], S.defaultCostRows[i + 1]]; save(); drawCosts(); } } }),
        el('button.btn.sm.ghost', { text: '🗑', onclick: () => { S.defaultCostRows.splice(i, 1); save(); drawCosts(); } }),
      ]));
    });
  }
  drawCosts();

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['סעיפי הוצאה קבועים (נוצרים אוטומטית בכל מכירה חדשה)',
      el('div.spacer'),
      el('button.btn.sm.primary', { text: '+ הוספה', onclick: () => { S.defaultCostRows.push({ label: '', amount: 0 }); save(); drawCosts(); } }),
      el('button.btn.sm', { text: 'שחזור ברירת מחדל', onclick: () => { S.defaultCostRows = DEFAULT_COST_ROWS.map((c) => ({ ...c })); save(); drawCosts(); } }),
    ]),
    el('div.card-body', {}, [costBox]),
  ]));

  /* ------------------------- תבניות משימות ------------------------- */
  const taskBox = el('div');
  function drawTasks() {
    clear(taskBox);
    S.taskTemplates.forEach((t, i) => {
      taskBox.appendChild(el('div.row', { style: { padding: '5px 0' } }, [
        el('input.input', { value: t, style: { flex: '1' }, oninput: (e) => { S.taskTemplates[i] = e.target.value; save(); } }),
        el('button.btn.sm.ghost', { text: '🗑', onclick: () => { S.taskTemplates.splice(i, 1); save(); drawTasks(); } }),
      ]));
    });
  }
  drawTasks();

  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['תבניות משימות מהירות',
      el('div.spacer'),
      el('button.btn.sm.primary', { text: '+ הוספה', onclick: () => { S.taskTemplates.push(''); save(); drawTasks(); } }),
    ]),
    el('div.card-body', {}, [taskBox]),
  ]));

  /* --------------------------- טבלת לקוחות --------------------------- */
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['טבלת הלקוחות']),
    el('div.card-body', {}, [
      el('p', { style: { marginTop: 0, color: '#64748b' }, text: 'הגדרת העמודות, הכותרת העליונה וכותרת הצד של טבלת הלקוחות.' }),
      el('button.btn.primary', { text: '⚙ פתיחת הגדרות הטבלה', onclick: () => tableSettingsDialog(() => render(root, nav)) }),
    ]),
  ]));

  /* --------------------------- גיבוי ושחזור --------------------------- */
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['גיבוי ושחזור נתונים']),
    el('div.card-body', {}, [
      el('p', { style: { marginTop: 0, color: '#64748b' },
        text: 'כל הנתונים נשמרים בדפדפן של המחשב הזה. מומלץ לגבות באופן קבוע ולשמור את קובץ הגיבוי במקום בטוח.' }),
      el('div.row', {}, [
        el('button.btn.primary', {
          text: '⬇ הורדת גיבוי מלא',
          onclick: () => {
            const blob = new Blob([store.exportJson()], { type: 'application/json' });
            downloadBlob(blob, `גיבוי מערכת מכירות ${new Date().toISOString().slice(0, 10)}.json`);
            toastOk('הגיבוי הורד');
          },
        }),
        el('button.btn', {
          text: '⬆ שחזור מגיבוי',
          onclick: async () => {
            const files = await pickFile('.json');
            if (!files.length) return;
            const text = await files[0].text();
            confirmDialog('שחזור יחליף את כל הנתונים הקיימים במערכת. להמשיך?', async () => {
              try {
                await store.importJson(text);
                toastOk('הנתונים שוחזרו');
                render(root, nav);
              } catch (e) { toastErr('קובץ גיבוי לא תקין'); }
            }, { danger: true, yes: 'שחזור' });
          },
        }),
        el('div.spacer'),
        el('button.btn.danger', {
          text: '🗑 מחיקת כל הנתונים',
          onclick: () => confirmDialog(
            'פעולה זו תמחק את כל המכירות, הלקוחות וההגדרות. מומלץ להוריד גיבוי לפני. להמשיך?',
            async () => { await store.reset(); toast('הנתונים נמחקו'); render(root, nav); },
            { danger: true, yes: 'מחיקה מלאה' }),
        }),
      ]),
      el('div', { style: { marginTop: '14px', fontSize: '13px', color: '#64748b' } }, [
        el('div', { text: `מכירות במערכת: ${store.state.sales.length}` }),
        el('div', { text: `לקוחות: ${store.state.sales.reduce((a, s) => a + (s.customers || []).length, 0)}` }),
        el('div', { text: `רשומות בארכיון: ${store.state.archive.length}` }),
        el('div', { text: `קמפיינים: ${store.state.campaigns.length}` }),
      ]),
    ]),
  ]));

  /* -------------------------- נתוני הדגמה -------------------------- */
  root.appendChild(el('div.card', {}, [
    el('h3', {}, ['נתוני הדגמה']),
    el('div.card-body', {}, [
      el('p', { style: { marginTop: 0, color: '#64748b' }, text: 'טעינת מכירות לדוגמה כדי להתנסות במערכת. לא ימחק נתונים קיימים.' }),
      el('button.btn', { text: 'טעינת נתוני הדגמה', onclick: () => { loadDemo(); toastOk('נתוני ההדגמה נטענו'); nav('calendar'); } }),
    ]),
  ]));

  function refreshBrand() {
    const b = document.querySelector('.sidebar .brand h1');
    const p = document.querySelector('.sidebar .brand p');
    if (b) b.textContent = S.orgName;
    if (p) p.textContent = S.subtitle;
  }
}

/* ------------------------------ הדגמה ------------------------------ */

export function loadDemo() {
  const today = new Date();
  // מדלג על שישי/שבת כדי שנתוני ההדגמה ייפלו על ימים פעילים
  const iso = (offset) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + (offset >= 0 ? 1 : -1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const demos = [
    { date: iso(2), city: 'ירושלים', neighborhood: 'רמות', hallName: 'אולמי הדר', street: 'הרב פרנק', houseNumber: '12',
      customers: [
        ['ישראל', 'כהן', '0501234567', 'ראייה', '-1.25', '-1.50', 450, true, true],
        ['שרה', 'לוי', '0527654321', 'מולטיפוקל', '+2.00', '+2.25', 1250, false, false],
        ['משה', 'פרידמן', '0533456789', 'קריאה', '+1.50', '+1.50', 320, true, false],
      ] },
    { date: iso(-12), city: 'בני ברק', neighborhood: 'פרדס כץ', hallName: 'היכל שמחה', street: 'רבי עקיבא', houseNumber: '88',
      customers: [
        ['חיים', 'רוזנברג', '0544567890', 'ראייה', '-3.00', '-2.75', 690, true, true],
        ['רבקה', 'ויס', '0556789012', 'שמש', '0', '0', 240, true, true],
        ['יעקב', 'שטרן', '0587654321', 'מולטיפוקל', '+1.75', '+2.00', 1450, false, false],
        ['מרים', 'גולד', '0523344556', 'קריאה', '+2.50', '+2.50', 280, true, true],
      ] },
    { date: iso(-40), city: 'אשדוד', neighborhood: 'רובע ז׳', hallName: 'אולם הרובע', street: 'הרצל', houseNumber: '5',
      customers: [
        ['דוד', 'ביטון', '0501112223', 'ראייה', '-0.75', '-1.00', 380, true, true],
        ['אסתר', 'מזרחי', '0509998887', 'מחשב', '-1.00', '-1.00', 520, true, true],
      ] },
  ];

  store.update((s) => {
    for (const d of demos) {
      const sale = {
        id: uid(), date: d.date, slot: 1, city: d.city, neighborhood: d.neighborhood,
        hallName: d.hallName, street: d.street, houseNumber: d.houseNumber,
        startTime: '17:00', endTime: '22:00', status: 'confirmed', separation: 'הפרדה מלאה',
        contactName: '', contactPhone: '',
        costs: [
          { id: uid(), label: 'מחיר האולם', amount: 800, paymentMethod: 'העברה בנקאית', paidTo: 'ועד השכונה', status: 'שולם', dueDate: '', note: '' },
          { id: uid(), label: 'מודעה במקומון', amount: 350, paymentMethod: 'אשראי', paidTo: 'מקומון', status: 'שולם', dueDate: '', note: '' },
          { id: uid(), label: 'הדפסת והדבקת מודעות', amount: 220, paymentMethod: 'מזומן', paidTo: 'מדביק', status: 'טרם שולם', dueDate: '', note: '' },
        ],
        customers: d.customers.map(([fn, ln, ph, gt, re, le, price, paid, delivered]) => ({
          id: uid(), firstName: fn, lastName: ln, phone: ph, email: '',
          city: d.city, neighborhood: d.neighborhood, glassesType: gt,
          rightEye: re, leftEye: le, price, paid, paidAmount: paid ? price : '',
          paymentMethod: paid ? 'מזומן' : '', delivered, notes: '',
        })),
        tasks: [
          { id: uid(), title: 'אופטומטריסט', assignee: 'ר׳ יוסי', done: true, dueDate: '', note: '' },
          { id: uid(), title: 'להוסיף משקפי קריאה +3.00', assignee: '', done: false, dueDate: '', note: '' },
        ],
        notes: [{ id: uid(), text: 'מכירה בהפרדה מלאה — כניסה נפרדת מרחוב צדדי.', createdAt: new Date().toISOString() }],
        ads: [], campaigns: [], createdAt: new Date().toISOString(),
      };
      s.sales.push(sale);
    }
  });
}
