/**
 * yemot.js — לקוח API של "ימות המשיח" (call2all).
 *
 * תיעוד: כל הקריאות הן GET/POST אל  https://www.call2all.co.il/ym/api/<Action>
 * אימות: token=<מספר מערכת>:<סיסמת API>  (למשל 077123456:1234)
 * פעולות עיקריות בשימוש המערכת:
 *   GetSession    — בדיקת חיבור ותקינות הטוקן
 *   RunTzintuk    — הרצת צינתוק לרשימת מספרים
 *   RunCampaign   — הרצת קמפיין (השמעת הודעה / סמס)
 *   SendSms       — שליחת סמס
 *   GetCampaignsList / GetCampaignReport — סטטוס נמענים
 *
 * בגלל CORS מומלץ לעבוד דרך ה-proxy המצורף (api/yemot.js) — ראו docs/YEMOT_API.md
 */

import { store } from './store.js';

/* --------------------------- נרמול מספרי טלפון --------------------------- */

/** מנרמל מספר ישראלי לפורמט 0XXXXXXXXX. מחזיר null אם לא תקין. */
export function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, '');
  d = d.replace(/^\+/, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (d.startsWith('00972')) d = '0' + d.slice(5);
  if (!d.startsWith('0')) {
    if (d.length === 9) d = '0' + d;      // 501234567 -> 0501234567
    else return null;
  }
  if (d.length < 9 || d.length > 10) return null;
  return d;
}

export function uniquePhones(list) {
  const set = new Set();
  for (const p of list) {
    const n = normalizePhone(p);
    if (n) set.add(n);
  }
  return [...set];
}

/* ------------------------------- הקונפיג ------------------------------- */

export function yemotConfig() {
  return store.state.settings.yemot || {};
}

export function isConfigured() {
  const c = yemotConfig();
  return Boolean(c.systemNumber && c.apiKey);
}

function token() {
  const c = yemotConfig();
  return `${c.systemNumber}:${c.apiKey}`;
}

/* ------------------------------- הקריאה ------------------------------- */

/**
 * קריאה גנרית ל-API.
 * @param {string} action  שם ה-Action (GetSession / RunTzintuk / ...)
 * @param {object} params  פרמטרים (ה-token מתווסף אוטומטית)
 */
export async function call(action, params = {}) {
  const cfg = yemotConfig();
  if (!isConfigured()) throw new Error('לא הוגדרו פרטי ימות המשיח (מספר מערכת + מפתח API) בהגדרות');

  const body = { token: token(), ...params };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }

  let url, init;
  if (cfg.mode === 'direct') {
    url = `${(cfg.baseUrl || 'https://www.call2all.co.il/ym/api').replace(/\/$/, '')}/${action}`;
    init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs.toString() };
  } else {
    url = cfg.proxyUrl || '/api/yemot';
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params: body, baseUrl: cfg.baseUrl }),
    };
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`שגיאת תקשורת (${res.status}): ${data.message || data.raw || text.slice(0, 200)}`);
  }
  if (data.responseStatus && data.responseStatus !== 'OK') {
    throw new Error(data.message || data.responseMessage || `התקבלה שגיאה מהמערכת: ${data.responseStatus}`);
  }
  return data;
}

/** בדיקת חיבור — מחזיר פרטי המערכת */
export async function testConnection() {
  return await call('GetSession', {});
}

/* ------------------------------ צינתוקים ------------------------------ */

/**
 * שליחת צינתוק לרשימת מספרים.
 * @param {string[]} phones
 * @param {object} opts { callerId, timeout, yourId, sayInfoOnAnswer }
 */
export async function runTzintuk(phones, opts = {}) {
  const cfg = yemotConfig();
  const list = uniquePhones(phones);
  if (!list.length) throw new Error('לא נבחרו מספרי טלפון תקינים');
  const params = {
    callerId: opts.callerId || cfg.callerId || '',
    phones: list.join(','),
    TzintukTimeOut: opts.timeout || cfg.tzintukTimeout || 6,
  };
  if (opts.yourId) params.tzintuk_your_id = opts.yourId;
  if (opts.sayInfoOnAnswer) params.sayInfoOnAnswer = 'true';
  const res = await call('RunTzintuk', params);
  return { res, phones: list };
}

/**
 * הרצת קמפיין השמעת הודעה (ואופציונלית סמס נלווה).
 * @param {Array<{phone:string,text?:string}>} targets
 * @param {object} opts { callerId, messageFile, withSms, smsText, ttsText }
 */
export async function runCampaign(targets, opts = {}) {
  const cfg = yemotConfig();
  const map = {};
  for (const t of targets) {
    const p = normalizePhone(t.phone);
    if (p) map[p] = t.text || opts.smsText || '';
  }
  if (!Object.keys(map).length) throw new Error('לא נבחרו מספרי טלפון תקינים');

  const params = {
    callerId: opts.callerId || cfg.callerId || '',
    phones: JSON.stringify(map),
  };
  if (opts.withSms) params.withSMS = 1;
  const file = opts.messageFile || cfg.messageFile;
  if (file) params.ivrPath = file;
  const tts = opts.ttsText || cfg.ttsText;
  if (tts) params.ttsMessage = tts;

  const res = await call('RunCampaign', params);
  return { res, phones: Object.keys(map) };
}

/** שליחת סמס */
export async function sendSms(phones, message, opts = {}) {
  const cfg = yemotConfig();
  const list = uniquePhones(phones);
  if (!list.length) throw new Error('לא נבחרו מספרי טלפון תקינים');
  if (!message) throw new Error('לא הוזן תוכן הודעה');
  const res = await call('SendSms', {
    phones: list.join(','),
    message,
    from: opts.from || cfg.callerId || '',
  });
  return { res, phones: list };
}

/** שליפת דוח קמפיין (סטטוס נמענים) */
export async function getCampaignReport(campaignId) {
  return await call('GetCampaignReport', { campaignId });
}

/** רשימת קמפיינים במערכת */
export async function getCampaigns() {
  return await call('GetCampaignsList', {});
}

/* --------------------- תשתית אישורי הגעה (RSVP) --------------------- */

/**
 * שליחת קמפיין "אישור הגעה" — התשתית מוכנה; ההפעלה מותנית בהגדרת שלוחת
 * IVR במערכת ימות המשיח שמקבלת הקשה 1=מגיע / 2=לא מגיע ומעדכנת בחזרה.
 * ראו docs/YEMOT_API.md — פרק "אישורי הגעה".
 */
export async function runRsvpCampaign(targets, opts = {}) {
  const cfg = yemotConfig();
  if (!cfg.rsvpEnabled) {
    throw new Error('קמפיין אישורי הגעה אינו מופעל. יש להפעילו בהגדרות > ימות המשיח ולהגדיר שלוחת IVR.');
  }
  return await runCampaign(targets, {
    ...opts,
    messageFile: opts.messageFile || cfg.rsvpExtension || cfg.messageFile,
  });
}

/** מפענח סטטוס נמען מתשובת ה-API לתצוגה בעברית */
export function statusLabel(code) {
  const map = {
    ANSWERED: 'נענה', NOANSWER: 'לא נענה', BUSY: 'תפוס', FAILED: 'נכשל',
    OK: 'נשלח', PENDING: 'בהמתנה', DONE: 'הושלם', LISTENED: 'שמע',
    NOTLISTENED: 'לא שמע', CANCELED: 'בוטל',
  };
  return map[String(code || '').toUpperCase()] || code || 'לא ידוע';
}
