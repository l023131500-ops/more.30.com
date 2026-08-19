/**
 * api/yemot.js — פרוקסי לשרת ימות המשיח (Vercel / Netlify Functions / Node).
 * נועד לעקוף מגבלות CORS ולמנוע חשיפת מפתח ה-API בכתובת ה-URL של הדפדפן.
 *
 * גוף הבקשה (POST JSON):  { action: "RunTzintuk", params: { token, ... }, baseUrl? }
 * תשובה: גוף התשובה של ימות המשיח כפי שהוא (JSON או טקסט).
 */

const DEFAULT_BASE = 'https://www.call2all.co.il/ym/api';
const ALLOWED_ACTIONS = new Set([
  'GetSession', 'Login', 'Logout', 'RunTzintuk', 'RunCampaign', 'SendSms',
  'GetCampaignsList', 'GetCampaignReport', 'GetIVR2Dir', 'UploadFile',
  'DownloadFile', 'TzintukStatus', 'GetTzintukReport',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, params = {}, baseUrl } = body;

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'פעולה לא מורשית', action });
    }

    // מאפשר להזריק את הטוקן מצד השרת (מומלץ בפרודקשן):
    // הגדירו את משתני הסביבה YEMOT_SYSTEM ו-YEMOT_TOKEN, ואז אין צורך לשלוח token מהדפדפן.
    const envToken = process.env.YEMOT_SYSTEM && process.env.YEMOT_TOKEN
      ? `${process.env.YEMOT_SYSTEM}:${process.env.YEMOT_TOKEN}` : null;
    const finalParams = { ...params };
    if (envToken) finalParams.token = envToken;
    if (!finalParams.token) return res.status(400).json({ error: 'חסר token' });

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(finalParams)) {
      if (v === undefined || v === null || v === '') continue;
      qs.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }

    const base = (baseUrl || process.env.YEMOT_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const upstream = await fetch(`${base}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.toString(),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    try {
      res.json(JSON.parse(text));
    } catch {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(text);
    }
  } catch (err) {
    res.status(500).json({ error: 'שגיאה בפרוקסי', message: String(err && err.message || err) });
  }
}
