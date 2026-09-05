#!/usr/bin/env node
/**
 * קמפיין + הודעת כניסה — ימות המשיח
 * ---------------------------------------------------------------------------
 * קובץ יחיד, בלי התקנות. דורש Node 18 ומעלה.
 *
 *   node campaign.mjs selftest              בדיקה עצמית, לא נוגע ברשת
 *   node campaign.mjs check                 בדיקת חיבור + מה יש בשלוחת הקמפיין
 *   node campaign.mjs message <קובץ.wav>    מעלה את ההודעה לשלוחה
 *   node campaign.mjs entry                 מגדיר אותה כהודעת כניסה לשלוחה
 *   node campaign.mjs entry-off             מכבה את הודעת הכניסה (בלי למחוק)
 *   node campaign.mjs send <טלפונים.txt>    יורה את הקמפיין
 *   node campaign.mjs send <קובץ> --dry     מציג למי היה נשלח, בלי לשלוח
 *   node campaign.mjs list                  רשימת הקמפיינים במערכת
 *   node campaign.mjs report <מזהה>         דוח נמענים לקמפיין
 *
 * בטיחות: כל כתיבה מוגבלת לשלוחת הקמפיין בלבד (CAMPAIGN_EXT).
 * אין בקובץ שום פעולת מחיקה, והוא מסרב לעבוד על השלוחה הראשית.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const env = process.env;
const CFG = {
  base: env.YEMOT_BASE || 'https://www.call2all.co.il/ym/api',
  system: env.YEMOT_SYSTEM || '',
  secret: env.YEMOT_APIKEY || env.YEMOT_PASSWORD || '',
  ext: env.CAMPAIGN_EXT || '6',        // שלוחת הקמפיין. חייבת להיות ייעודית.
  callerId: env.YEMOT_CALLER_ID || '', // המספר שיוצג אצל הנמען
  nextExt: env.NEXT_EXT || '',         // לאן להמשיך אחרי ההודעה. ריק = סיום שיחה
};
const token = () => `${CFG.system}:${CFG.secret}`;

const OUT = join(process.cwd(), 'campaign-out');
mkdirSync(OUT, { recursive: true });
const log = (m) => {
  const line = `[${new Date().toLocaleTimeString('he-IL')}] ${m}`;
  console.log(line);
  try { appendFileSync(join(OUT, 'campaign.log'), line + '\n'); } catch {}
};

// ── בטיחות ────────────────────────────────────────────────────────────────

/** שלוחת היעד חייבת להיות ייעודית — לא הראשית ולא הכניסה למערכת */
export function assertExtSafe(ext) {
  const e = String(ext).trim();
  if (!/^\d+$/.test(e)) throw new Error(`שלוחת קמפיין לא חוקית: "${ext}"`);
  if (e === '' || e === '0' || e === '1') {
    throw new Error(`סירוב: שלוחה ${e} היא הכניסה למערכת. בחרו שלוחה ייעודית ב-CAMPAIGN_EXT.`);
  }
  return e;
}

/** כל נתיב כתיבה חייב לשבת בתוך שלוחת הקמפיין */
export function assertInExt(path, ext) {
  const e = assertExtSafe(ext);
  if (!new RegExp(`^ivr2:/${e}(/|$)`).test(path) || path.includes('..')) {
    throw new Error(`חסימת בטיחות: ניסיון לכתוב אל "${path}" מחוץ לשלוחה ${e}`);
  }
  return path;
}

/** נרמול מספר ישראלי לפורמט מקומי. מחזיר null אם לא תקין. */
export function normalizePhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+972')) p = '0' + p.slice(4);
  else if (p.startsWith('00972')) p = '0' + p.slice(5);
  else if (p.startsWith('972')) p = '0' + p.slice(3);
  if (/^[5723489]\d{7,8}$/.test(p)) p = '0' + p;
  if (!/^0\d{8,9}$/.test(p)) return null;
  return p;
}

/** קורא קובץ טלפונים: מספר בכל שורה, אפשר "מספר,שם". מסנן כפילויות ופסולים. */
export function readPhones(text) {
  const ok = [];
  const bad = [];
  const seen = new Set();
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [rawPhone, ...rest] = t.split(',');
    const p = normalizePhone(rawPhone);
    if (!p) { bad.push(t); continue; }
    if (seen.has(p)) continue;
    seen.add(p);
    ok.push({ phone: p, name: rest.join(',').trim() });
  }
  return { ok, bad };
}

// ── קריאות ל-API ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(action, fields, retries = 3) {
  let last;
  for (let i = 0; i <= retries; i++) {
    if (i) await sleep(2000 * 2 ** (i - 1));
    try {
      const body = new FormData();
      body.append('token', token());
      for (const [k, v] of Object.entries(fields)) if (v != null) body.append(k, v);
      const res = await fetch(`${CFG.base}/${action}`, { method: 'POST', body });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`תשובה לא צפויה: ${text.slice(0, 200)}`); }
      if (json.responseStatus && json.responseStatus !== 'OK') {
        const e = new Error(`${action}: ${json.responseStatus}`);
        if (/UNAUTHORIZED|TOKEN|PASSWORD/i.test(json.responseStatus)) e.fatal = true;
        throw e;
      }
      return json;
    } catch (e) { if (e.fatal) throw e; last = e; }
  }
  throw new Error(`${action} נכשל — ${last?.message}`);
}

const MSG_FILE = () => `ivr2:/${assertExtSafe(CFG.ext)}/000.wav`;
const INI_FILE = () => `ivr2:/${assertExtSafe(CFG.ext)}/ext.ini`;

// תבניות ההגדרה. אם הבדיקה בטלפון מראה שצריך תיקון — משנים כאן בלבד.
const entryOn = () => [
  '# הודעת כניסה — קמפיין',
  'type=playfile',
  'playfileListSort=name',
  CFG.nextExt ? `goto_after=/${CFG.nextExt}` : '',
  'enable_keyboard=yes',
].filter(Boolean).join('\n') + '\n';

const entryOff = () => '# הודעת כניסה כבויה\ntype=menu\ntimeout=3\nenable_keyboard=yes\n';

// ── פקודות ────────────────────────────────────────────────────────────────

function need(what) {
  if (!CFG.system || !CFG.secret) throw new Error('חסרים YEMOT_SYSTEM ו-YEMOT_APIKEY');
  if (what === 'caller' && !CFG.callerId) {
    throw new Error('חסר YEMOT_CALLER_ID — המספר המזוהה שיוצג אצל הנמען');
  }
}

async function cmdCheck() {
  need();
  const e = assertExtSafe(CFG.ext);
  log(`חיבור: ${JSON.stringify(await api('GetSession', {})).slice(0, 200)}`);
  const dir = await api('GetIVR2Dir', { path: `ivr2:/${e}` });
  const items = dir.files || dir.data || [];
  log(`שלוחה ${e} מכילה ${items.length} פריטים`);
  if (items.length) console.log(JSON.stringify(items, null, 2).slice(0, 1500));
  else log(`שלוחה ${e} ריקה — אפשר להעלות אליה הודעה.`);
}

async function cmdMessage(file) {
  need();
  if (!file) throw new Error('שימוש: node campaign.mjs message <קובץ.wav>');
  if (!existsSync(file)) throw new Error(`הקובץ לא נמצא: ${file}`);
  const buf = readFileSync(file);
  if (buf.length < 1000) throw new Error(`הקובץ קטן מדי (${buf.length} בתים) — כנראה לא הקלטה`);
  const path = MSG_FILE();
  assertInExt(path, CFG.ext);
  const body = new FormData();
  body.append('token', token());
  body.append('path', path);
  body.append('convertAudio', '1');
  body.append('file', new Blob([buf]), basename(file));
  const res = await fetch(`${CFG.base}/UploadFile`, { method: 'POST', body });
  const text = await res.text();
  if (!res.ok) throw new Error(`UploadFile HTTP ${res.status} — ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  if (json.responseStatus && json.responseStatus !== 'OK') throw new Error(`UploadFile: ${json.responseStatus}`);
  log(`✓ ההודעה הועלתה אל ${path}`);
  log('כעת: node campaign.mjs entry   כדי שתתנגן למי שמתקשר');
}

async function cmdEntry(on) {
  need();
  const path = INI_FILE();
  assertInExt(path, CFG.ext);
  await api('UploadTextFile', { what: path, contents: on ? entryOn() : entryOff() });
  log(on
    ? `✓ הודעת הכניסה פעילה בשלוחה ${CFG.ext}${CFG.nextExt ? `, וממשיכה לשלוחה ${CFG.nextExt}` : ''}`
    : `✓ הודעת הכניסה כובתה בשלוחה ${CFG.ext}. הקובץ עצמו לא נמחק.`);
  log(`התקשרו לשלוחה ${CFG.ext} ובדקו.`);
}

async function cmdSend(file, dry) {
  need('caller');
  if (!file) throw new Error('שימוש: node campaign.mjs send <טלפונים.txt>');
  if (!existsSync(file)) throw new Error(`הקובץ לא נמצא: ${file}`);
  const { ok, bad } = readPhones(readFileSync(file, 'utf8'));
  if (bad.length) {
    writeFileSync(join(OUT, 'invalid-phones.txt'), bad.join('\n'));
    log(`${bad.length} שורות נפסלו — נשמרו ב-campaign-out/invalid-phones.txt`);
  }
  if (!ok.length) throw new Error('לא נמצא אף מספר תקין');
  log(`${ok.length} נמענים תקינים`);
  writeFileSync(join(OUT, 'recipients.txt'), ok.map((r) => `${r.phone}\t${r.name}`).join('\n'));

  if (dry) {
    console.log(ok.slice(0, 20).map((r) => `  ${r.phone}${r.name ? '  ' + r.name : ''}`).join('\n'));
    if (ok.length > 20) console.log(`  … ועוד ${ok.length - 20}`);
    log('הרצה יבשה — לא נשלח דבר. להסרת --dry כדי לשלוח באמת.');
    return;
  }

  const r = await api('RunCampaign', {
    callerId: CFG.callerId,
    phones: JSON.stringify(Object.fromEntries(ok.map((x) => [x.phone, x.name || '']))),
    ivrPath: MSG_FILE(),
  });
  writeFileSync(join(OUT, 'last-campaign.json'), JSON.stringify(r, null, 2));
  log(`✓ הקמפיין יצא. תשובת המערכת: ${JSON.stringify(r).slice(0, 300)}`);
  log('לבדיקת התקדמות: node campaign.mjs list');
}

async function cmdList() {
  need();
  const r = await api('GetCampaignsList', {});
  console.log(JSON.stringify(r, null, 2).slice(0, 4000));
}

async function cmdReport(id) {
  need();
  if (!id) throw new Error('שימוש: node campaign.mjs report <מזהה קמפיין>');
  const r = await api('GetCampaignReport', { campaignId: id });
  writeFileSync(join(OUT, `report-${id}.json`), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 2).slice(0, 4000));
  log(`הדוח נשמר ב-campaign-out/report-${id}.json`);
}

function cmdSelftest() {
  const checks = [];
  const t = (name, fn) => { try { checks.push([name, !!fn()]); } catch { checks.push([name, false]); } };
  const f = (name, fn) => { try { fn(); checks.push([name, false]); } catch { checks.push([name, true]); } };

  t('נרמול 0501234567', () => normalizePhone('050-123-4567') === '0501234567');
  t('נרמול +972', () => normalizePhone('+972501234567') === '0501234567');
  t('נרמול 00972', () => normalizePhone('00972501234567') === '0501234567');
  t('פסילת מספר קצר', () => normalizePhone('12345') === null);
  t('סינון כפילויות', () => readPhones('0501234567\n050-1234567\n0521111111').ok.length === 2);
  t('דילוג על הערות', () => readPhones('# הערה\n0501234567').ok.length === 1);
  f('סירוב לשלוחה 1', () => assertExtSafe('1'));
  f('סירוב לשלוחה 0', () => assertExtSafe('0'));
  f('חסימת נתיב חורג', () => assertInExt('ivr2:/7/000.wav', '6'));
  t('נתיב חוקי עובר', () => assertInExt('ivr2:/6/000.wav', '6'));

  let bad = 0;
  for (const [n, p] of checks) { console.log(`${p ? '✓' : '✗'} ${n}`); if (!p) bad++; }
  console.log(bad ? `\n${bad} בדיקות נכשלו` : '\nכל הבדיקות עברו. הקובץ תקין.');
  process.exit(bad ? 1 : 0);
}

// ── כניסה ─────────────────────────────────────────────────────────────────

const [cmd, arg] = process.argv.slice(2);
const dry = process.argv.includes('--dry');
const run = {
  selftest: cmdSelftest,
  check: cmdCheck,
  message: () => cmdMessage(arg),
  entry: () => cmdEntry(true),
  'entry-off': () => cmdEntry(false),
  send: () => cmdSend(arg, dry),
  list: cmdList,
  report: () => cmdReport(arg),
}[cmd];

if (!run) {
  console.log(`שימוש:
  node campaign.mjs selftest
  node campaign.mjs check
  node campaign.mjs message <קובץ.wav>
  node campaign.mjs entry | entry-off
  node campaign.mjs send <טלפונים.txt> [--dry]
  node campaign.mjs list
  node campaign.mjs report <מזהה>`);
  process.exit(1);
}
await Promise.resolve(run()).catch((e) => { log(`שגיאה: ${e.message}`); process.exit(1); });
