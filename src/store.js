/**
 * store.js — שכבת הנתונים. IndexedDB (עם נפילה ל-localStorage), מטמון בזיכרון,
 * שמירה אוטומטית, גיבוי/שחזור, ומנוי לשינויים.
 */

const DB_NAME = 'optika-sales';
const DB_VERSION = 1;
const STORE_STATE = 'state';
const STORE_FILES = 'files';

export const uid = () =>
  'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/* ------------------------------ ברירות מחדל ------------------------------ */

export const DEFAULT_CUSTOMER_COLUMNS = [
  { key: 'firstName',  label: 'שם פרטי',    type: 'text',   width: 120, visible: true, locked: true },
  { key: 'lastName',   label: 'שם משפחה',   type: 'text',   width: 120, visible: true, locked: true },
  { key: 'phone',      label: 'טלפון',      type: 'tel',    width: 130, visible: true, locked: true },
  { key: 'email',      label: 'דוא״ל',      type: 'email',  width: 170, visible: true },
  { key: 'city',       label: 'עיר',        type: 'text',   width: 110, visible: true },
  { key: 'neighborhood', label: 'שכונה',    type: 'text',   width: 110, visible: true },
  { key: 'glassesType', label: 'סוג משקפיים', type: 'select', width: 130, visible: true,
    options: ['ראייה', 'קריאה', 'מולטיפוקל', 'ביפוקל', 'שמש', 'מחשב', 'ילדים', 'מסגרת בלבד', 'עדשות בלבד'] },
  { key: 'rightEye',   label: 'עין ימין',   type: 'text',   width: 120, visible: true },
  { key: 'leftEye',    label: 'עין שמאל',   type: 'text',   width: 120, visible: true },
  { key: 'price',      label: 'מחיר',       type: 'money',  width: 100, visible: true, locked: true },
  { key: 'paid',       label: 'שולם',       type: 'check',  width: 70,  visible: true, locked: true },
  { key: 'paidAmount', label: 'סכום ששולם', type: 'money',  width: 110, visible: true },
  { key: 'paymentMethod', label: 'אמצעי תשלום', type: 'select', width: 130, visible: true,
    options: ['מזומן', 'אשראי', 'העברה בנקאית', 'צ׳ק', 'ביט/פייבוקס'] },
  { key: 'delivered',  label: 'נמסר',       type: 'check',  width: 70,  visible: true, locked: true },
  { key: 'notes',      label: 'הערות',      type: 'text',   width: 160, visible: true },
];

export const DEFAULT_COST_ROWS = [
  { label: 'מחיר האולם', amount: 0 },
  { label: 'מודעה במקומון', amount: 0 },
  { label: 'הדפסת והדבקת מודעות', amount: 0 },
];

export const PAYMENT_METHODS = ['מזומן', 'אשראי', 'העברה בנקאית', 'צ׳ק', 'ביט/פייבוקס', 'טרם שולם'];
export const PAYMENT_STATUS = ['טרם שולם', 'שולם', 'שולם חלקית'];

export const DEFAULT_TASK_TEMPLATES = [
  'אופטומטריסט',
  'להוסיף משקפי X',
  'הבאת ציוד',
  'תיאום עם ועד השכונה',
  'תליית מודעות',
  'סידור האולם',
];

export function defaultState() {
  return {
    version: 1,
    settings: {
      orgName: 'אופטיקה לכל כיס',
      subtitle: 'בשיתוף ארגון בקלות',
      currency: '₪',
      diaspora: false,
      weekend: { friday: true, saturday: true },
      holidayRules: {
        yomtov: true, cholhamoed: true, erev: false, fastMajor: true,
        fastMinor: false, purim: true, memorial: false, national: false,
        minor: false, roshchodesh: false,
      },
      customerColumns: DEFAULT_CUSTOMER_COLUMNS.map((c) => ({ ...c })),
      tableConfig: {
        topTitle: 'רשימת לקוחות למכירה',
        sideHeader: 'מס׳',
        sideHeaderField: 'index', // index | lastName | phone
        showTotals: true,
        rowsPerPage: 0,
      },
      defaultCostRows: DEFAULT_COST_ROWS.map((c) => ({ ...c })),
      taskTemplates: [...DEFAULT_TASK_TEMPLATES],
      yemot: {
        systemNumber: '',
        apiKey: '',
        callerId: '',
        tzintukTimeout: 6,
        mode: 'proxy',            // proxy | direct
        proxyUrl: '/api/yemot',
        baseUrl: 'https://www.call2all.co.il/ym/api',
        messageFile: '',          // ivr2:/1/000.wav
        ttsText: '',
        rsvpEnabled: false,
        rsvpExtension: '',
      },
    },
    sales: [],
    dayFlags: {},      // iso -> { blocked:true, note:'' }  חסימה ידנית (אדום)
    archive: [],       // לקוחות ממכירות קודמות שיובאו מאקסל
    campaigns: [],     // קמפיינים (צינתוק/סמס/אישורי הגעה)
    meta: { createdAt: new Date().toISOString() },
  };
}

/* ------------------------------ IndexedDB ------------------------------ */

let db = null;
let useFallback = false;

function openDb() {
  return new Promise((resolve) => {
    let req;
    try {
      if (!('indexedDB' in globalThis) || !globalThis.indexedDB) { useFallback = true; return resolve(null); }
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      // סביבות מוגבלות (iframe ללא הרשאות) — נופלים ל-localStorage
      useFallback = true;
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_STATE)) d.createObjectStore(STORE_STATE);
      if (!d.objectStoreNames.contains(STORE_FILES)) d.createObjectStore(STORE_FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useFallback = true; resolve(null); };
  });
}

function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbSet(store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).put(value, key);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

function idbDel(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

/** גיבוי בזיכרון אם גם localStorage חסום */
const memStore = new Map();
function safeLocalSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { memStore.set(k, v); }
}
function safeLocalGet(k) {
  try { return localStorage.getItem(k) ?? memStore.get(k) ?? null; }
  catch (e) { return memStore.get(k) ?? null; }
}

/* ------------------------------ ה-Store ------------------------------ */

export const store = {
  state: defaultState(),
  _listeners: new Set(),
  _saveTimer: null,
  ready: false,

  async init() {
    db = await openDb();
    let loaded = null;
    try {
      loaded = useFallback
        ? JSON.parse(safeLocalGet(DB_NAME) || 'null')
        : await idbGet(STORE_STATE, 'main');
    } catch (e) { console.warn('load failed', e); }
    if (loaded && typeof loaded === 'object') {
      this.state = mergeState(defaultState(), loaded);
    }
    this.ready = true;
    this.emit();
    return this.state;
  },

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  emit() { for (const fn of this._listeners) fn(this.state); },

  save(immediate = false) {
    clearTimeout(this._saveTimer);
    const doSave = async () => {
      try {
        if (useFallback) safeLocalSet(DB_NAME, JSON.stringify(this.state));
        else await idbSet(STORE_STATE, 'main', JSON.parse(JSON.stringify(this.state)));
      } catch (e) { console.error('save failed', e); }
    };
    if (immediate) return doSave();
    this._saveTimer = setTimeout(doSave, 250);
  },

  /** עדכון + שמירה + התראה */
  update(fn) {
    fn(this.state);
    this.save();
    this.emit();
  },

  /* ---------- קבצים (מודעות, לוגו) ---------- */
  async putFile(id, blob) {
    if (useFallback) {
      const dataUrl = await blobToDataUrl(blob);
      safeLocalSet(DB_NAME + ':file:' + id, dataUrl);
      return id;
    }
    await idbSet(STORE_FILES, id, blob);
    return id;
  },
  async getFile(id) {
    if (useFallback) {
      const d = safeLocalGet(DB_NAME + ':file:' + id);
      return d ? await (await fetch(d)).blob() : null;
    }
    return (await idbGet(STORE_FILES, id)) || null;
  },
  async delFile(id) {
    if (useFallback) { try { localStorage.removeItem(DB_NAME + ':file:' + id); } catch (e) {} return; }
    await idbDel(STORE_FILES, id);
  },

  /* ---------- שאילתות נוחות ---------- */
  salesOn(iso) {
    return this.state.sales
      .filter((s) => s.date === iso && !s.deleted)
      .sort((a, b) => (a.slot || 1) - (b.slot || 1));
  },
  getSale(id) { return this.state.sales.find((s) => s.id === id); },

  createSale(iso, slot) {
    const s = {
      id: uid(),
      date: iso,
      slot: slot || (this.salesOn(iso).length + 1),
      title: '',
      city: '', hallName: '', neighborhood: '', street: '', houseNumber: '',
      startTime: '', endTime: '',
      status: 'planned',
      separation: '',            // 'הפרדה מלאה' וכד׳
      contactName: '', contactPhone: '',
      costs: this.state.settings.defaultCostRows.map((c) => ({
        id: uid(), label: c.label, amount: c.amount || 0,
        paymentMethod: 'טרם שולם', paidTo: '', status: 'טרם שולם', dueDate: '', note: '',
      })),
      customers: [],
      tasks: [],
      notes: [],
      ads: [],
      campaigns: [],
      createdAt: new Date().toISOString(),
    };
    this.update((st) => st.sales.push(s));
    return s;
  },

  deleteSale(id) {
    this.update((st) => { st.sales = st.sales.filter((s) => s.id !== id); });
  },

  /* ---------- גיבוי ---------- */
  exportJson() {
    return JSON.stringify({ ...this.state, exportedAt: new Date().toISOString() }, null, 2);
  },
  async importJson(text) {
    const data = JSON.parse(text);
    this.state = mergeState(defaultState(), data);
    await this.save(true);
    this.emit();
  },
  async reset() {
    this.state = defaultState();
    await this.save(true);
    this.emit();
  },
};

function mergeState(base, loaded) {
  const out = { ...base, ...loaded };
  out.settings = { ...base.settings, ...(loaded.settings || {}) };
  out.settings.weekend = { ...base.settings.weekend, ...(loaded.settings?.weekend || {}) };
  out.settings.holidayRules = { ...base.settings.holidayRules, ...(loaded.settings?.holidayRules || {}) };
  out.settings.tableConfig = { ...base.settings.tableConfig, ...(loaded.settings?.tableConfig || {}) };
  out.settings.yemot = { ...base.settings.yemot, ...(loaded.settings?.yemot || {}) };
  if (!Array.isArray(out.settings.customerColumns) || !out.settings.customerColumns.length)
    out.settings.customerColumns = base.settings.customerColumns;
  if (!Array.isArray(out.sales)) out.sales = [];
  if (!Array.isArray(out.archive)) out.archive = [];
  if (!Array.isArray(out.campaigns)) out.campaigns = [];
  if (!out.dayFlags || typeof out.dayFlags !== 'object') out.dayFlags = {};
  return out;
}

function blobToDataUrl(blob) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
}

/* ------------------------------ חישובים ------------------------------ */

export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

/** סיכומים כספיים של מכירה */
export function saleTotals(sale) {
  const customers = sale.customers || [];
  const revenue = customers.reduce((a, c) => a + num(c.price), 0);
  const collected = customers.reduce(
    (a, c) => a + (c.paid ? num(c.price) : num(c.paidAmount)), 0);
  const outstanding = Math.max(0, revenue - collected);
  const expenses = (sale.costs || []).reduce((a, c) => a + num(c.amount), 0);
  const expensesPaid = (sale.costs || [])
    .filter((c) => c.status === 'שולם').reduce((a, c) => a + num(c.amount), 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const byMethod = {};
  for (const c of customers) {
    const amt = c.paid ? num(c.price) : num(c.paidAmount);
    if (amt <= 0) continue;
    const m = c.paymentMethod || 'לא צוין';
    byMethod[m] = (byMethod[m] || 0) + amt;
  }
  return {
    count: customers.length,
    revenue, collected, outstanding, expenses, expensesPaid, profit, margin, byMethod,
    delivered: customers.filter((c) => c.delivered).length,
    notDelivered: customers.filter((c) => !c.delivered).length,
    paidCount: customers.filter((c) => c.paid).length,
    avgTicket: customers.length ? revenue / customers.length : 0,
  };
}
