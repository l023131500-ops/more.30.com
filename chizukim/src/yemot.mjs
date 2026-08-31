import { cfg } from './config.mjs';

/**
 * שומר הסף: כל נתיב שנכתב אליו חייב לשבת בתוך שלוחת היעד.
 * זו ההגנה שמונעת נגיעה בשלוחות אחרות במערכת.
 */
export function assertInRoot(path) {
  const root = cfg.rootExt;
  const ok = new RegExp(`^ivr2:/${root}(/|$)`).test(path);
  if (!ok) throw new Error(`חסימת בטיחות: ניסיון לכתוב אל "${path}" מחוץ לשלוחה ${root}`);
  if (path.includes('..')) throw new Error(`חסימת בטיחות: נתיב מפוקפק "${path}"`);
  return path;
}

async function call(action, fields, { retries = 4 } = {}) {
  const url = `${cfg.yemotBase}/${action}`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    try {
      const body = new FormData();
      body.append('token', cfg.token);
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null) continue;
        body.append(k, v);
      }
      const res = await fetch(url, { method: 'POST', body });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { responseStatus: 'PARSE_ERROR', raw: text }; }
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
      if (json.responseStatus && json.responseStatus !== 'OK') {
        // שגיאת הרשאה או טוקן אינה חולפת — אין טעם לנסות שוב
        if (/UNAUTHORIZED|TOKEN/i.test(json.responseStatus)) {
          throw Object.assign(new Error(`${action}: ${json.responseStatus}`), { fatal: true });
        }
        throw new Error(`${action}: ${json.responseStatus} ${JSON.stringify(json).slice(0, 200)}`);
      }
      return json;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
    }
  }
  throw new Error(`${action} נכשל אחרי ${retries + 1} ניסיונות — ${lastErr?.message}`);
}

/** בדיקת תקינות הטוקן */
export const getSession = () => call('GetSession', {});

/** רשימת הקבצים והתיקיות בשלוחה */
export const listDir = (path) => call('GetIVR2Dir', { path: assertInRoot(path) });

/** כתיבת קובץ טקסט (ext.ini וכדומה) */
export function uploadText(path, contents) {
  assertInRoot(path);
  return call('UploadTextFile', { what: path, contents });
}

/** העלאת קובץ שמע. convertAudio=1 מבקש מהמערכת להמיר לפורמט שלה. */
export function uploadFile(path, buffer, filename) {
  assertInRoot(path);
  const body = new FormData();
  body.append('token', cfg.token);
  body.append('path', path);
  body.append('convertAudio', '1');
  body.append('file', new Blob([buffer]), filename);
  return fetch(`${cfg.yemotBase}/UploadFile`, { method: 'POST', body })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(`UploadFile HTTP ${res.status} — ${text.slice(0, 200)}`);
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`UploadFile תשובה לא צפויה: ${text.slice(0, 200)}`); }
      if (json.responseStatus && json.responseStatus !== 'OK') {
        throw new Error(`UploadFile: ${json.responseStatus}`);
      }
      return json;
    });
}

// שים לב: אין כאן שום פעולת מחיקה, במכוון.
