#!/usr/bin/env node
/**
 * חיזוקים קצרים ← ימות המשיח
 * ---------------------------------------------------------------------------
 * קובץ יחיד, בלי התקנות ובלי תלויות. דורש Node 18 ומעלה.
 *
 *   node chizukim.mjs selftest   בדיקה עצמית, לא נוגע ברשת
 *   node chizukim.mjs plan       בונה תוכנית מהאתר. לא נוגע בימות המשיח
 *   node chizukim.mjs verify     בודק חיבור ומדפיס את מצב שלוחת היעד
 *   node chizukim.mjs pilot      מעלה 3 הקלטות בלבד, לבדיקה בטלפון
 *   node chizukim.mjs upload     ההעלאה המלאה
 *   node chizukim.mjs status     מה הועלה, מה נכשל
 *
 * בטיחות: כל כתיבה נחסמת אם הנתיב אינו בתוך שלוחת היעד,
 * ואין בקובץ הזה שום פעולת מחיקה.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

// ── הגדרות ────────────────────────────────────────────────────────────────

const env = process.env;
const CFG = {
  yemotBase: env.YEMOT_BASE || 'https://www.call2all.co.il/ym/api',
  system: env.YEMOT_SYSTEM || '',
  secret: env.YEMOT_APIKEY || env.YEMOT_PASSWORD || '',
  rootExt: env.YEMOT_ROOT_EXT || '5',
  supabaseUrl: env.SUPABASE_URL || 'https://csjekrvukbdznetsrodj.supabase.co',
  supabaseKey: env.SUPABASE_KEY || 'sb_publishable_Bv6ysG9LfUZ2lUPgZVZO6g_l1wEZIlX',
  minSeconds: Number(env.MIN_SECONDS || 30),
  maxPerFolder: Number(env.MAX_PER_FOLDER || 60),
  splitWeekly: env.SPLIT_WEEKLY === '1',
};
const token = () => `${CFG.system}:${CFG.secret}`;

const OUT = join(process.cwd(), 'chizukim-out');
mkdirSync(OUT, { recursive: true });
const F = (n) => join(OUT, n);

const log = (m) => {
  const line = `[${new Date().toLocaleTimeString('he-IL')}] ${m}`;
  console.log(line);
  try { appendFileSync(F('run.log'), line + '\n'); } catch {}
};

// ── סיווג ─────────────────────────────────────────────────────────────────

export const CHUMASHIM = [
  { name: 'בראשית', parshiot: ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי'] },
  { name: 'שמות', parshiot: ['שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי'] },
  { name: 'ויקרא', parshiot: ['ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקותי'] },
  { name: 'במדבר', parshiot: ['במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חוקת', 'בלק', 'פינחס', 'מטות', 'מסעי'] },
  { name: 'דברים', parshiot: ['דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'] },
];
const ALL_PARSHIOT = CHUMASHIM.flatMap((c) => c.parshiot).concat(['תצווה', 'בחוקתי', 'פנחס', 'ניצבים']);
const PARSHA_CANON = { תצווה: 'תצוה', בחוקתי: 'בחוקותי', פנחס: 'פינחס', ניצבים: 'נצבים' };
const PARSHA_RE = new RegExp(`פרשת\\s+(${ALL_PARSHIOT.join('|')})`);

export const MOADIM = [
  { name: 'אלול וסליחות', re: /אלול|סליחות/ },
  { name: 'ראש השנה', re: /ראש השנה|ימים נוראים|יום הדין/ },
  { name: 'יום כיפור', re: /יום כיפור|יום הכיפורים/ },
  { name: 'סוכות ושמחת תורה', re: /סוכות|הושענא רבה|שמחת תורה|שמיני עצרת|ארבעת המינים/ },
  { name: 'חנוכה', re: /חנוכה/ },
  { name: 'ט״ו בשבט', re: /ט"ו בשבט|ט״ו בשבט|טו בשבט/ },
  { name: 'פורים', re: /פורים|מגילת אסתר|משלוח מנות|תענית אסתר/ },
  { name: 'פסח', re: /פסח|ליל הסדר|חמץ|שביעי של פסח/ },
  { name: 'ספירת העומר ול״ג בעומר', re: /ל"ג בעומר|ל״ג בעומר|ספירת העומר|בעומר/ },
  { name: 'שבועות', re: /שבועות|מתן תורה|קבלת התורה/ },
  { name: 'בין המצרים וצומות', re: /תשעה באב|בין המצרים|שלושת השבועות|י"ז בתמוז|יז בתמוז|עשרה בטבת|צום/ },
  { name: 'ראש חודש', re: /ראש חודש|שובבים/ },
];

export const TOPICS = [
  { key: 3, name: 'אמונה, ביטחון והשגחה', re: /אמונה|ביטחון|בטחון|השגחה|לטובה|פרנסה|יהבך|לחסות|בורא עולם|הקדוש ברוך הוא|משמיים|ישועה|תקווה/ },
  { key: 4, name: 'תפילה, ברכות ולימוד תורה', re: /תפילה|להתפלל|ברכת המזון|ברכות|ברכה|אמן|בית הכנסת|תורה|לימוד|ללמוד|התמדה|גמרא|דף יומי|מצוות|מצווה|תלמידי חכמים/ },
  { key: 5, name: 'מידות, שמחה והכרת הטוב', re: /הכרת הטוב|שמח בחלקו|שמחה|להודות|עין טובה|ענווה|גאווה|כעס|מידות|מידה|סבלנות|הרגל|אמת|שקר|גזל|עיניים/ },
  { key: 6, name: 'בין אדם לחברו ושמירת הלשון', re: /לשון הרע|שמירת הלשון|כוח הדיבור|השתיקה|לשתוק|רכילות|להלבין|מחלוקת|שנאת חינם|לכף זכות|אהבת ישראל|לרעך|לוותר|ויתור|הזולת|חברו|אחדות|לעודד|לפרגן|השני/ },
  { key: 7, name: 'שלום בית, חינוך וצדקה', re: /שלום בית|זוגיות|אשת חיל|חינוך|כיבוד הורים|החתן והכלה|ילדים|הורים|צדקה|חסד|מעשר|זיכוי הרבים|ביקור חולים|נתינה|לתת|תמיכה|להיטיב/ },
  { key: 8, name: 'תשובה, יצר הרע והתמודדות', re: /יצר הרע|תשובה|ניסיון|ניסיונות|התגברות|להתגבר|עבירה|חטא|ייאוש|דחיינות|עצלות|בחירה|לבחור|קשיים|ייסורים|התמודד|פחד/ },
  { key: 9, name: 'משלים, סיפורי צדיקים ועבודת האדם', re: /.*/ },
];

const NOTICE_RE = /הודעה טכנית|הודעות טכניות|עדכון מספר|הוראות שימוש|הנחיות שימוש|הנחיות ניווט|הפעלת מערכת|שינויים בקו|בעניין שליחת/;

const stripHeader = (t) => (t || '').replace(/^נושא:[^\n]*\n(תאריך:[^\n]*\n)?/, '');

export function classify(row) {
  const topic = row.topic || '';
  const body = stripHeader(row.edited_transcript || row.raw_transcript || '');
  const win = `${topic} ~ ${row.parsha_or_date || ''} ~ ${body.slice(0, 300)}`;
  const weekly = /שבוע טוב/.test(body.slice(0, 200));

  if (NOTICE_RE.test(topic)) return { skip: 'הודעה טכנית', weekly };
  if (!topic.trim()) return { skip: 'אין כותרת', weekly };

  for (const m of MOADIM) {
    if (m.re.test(win)) return { weekly, cat: 2, catName: 'מועדים וזמנים', sub: m.name, parsha: null };
  }
  const pm = win.match(PARSHA_RE);
  if (pm) {
    const parsha = PARSHA_CANON[pm[1]] || pm[1];
    const chumash = CHUMASHIM.find((c) => c.parshiot.includes(parsha)) || CHUMASHIM[0];
    return { weekly, cat: 1, catName: 'פרשות השבוע', sub: chumash.name, parsha };
  }
  for (const t of TOPICS) {
    if (t.re.test(topic)) return { weekly, cat: t.key, catName: t.name, sub: null, parsha: null };
  }
  return { weekly, cat: 9, catName: 'משלים, סיפורי צדיקים ועבודת האדם', sub: null, parsha: null };
}

// ── בניית התוכנית ─────────────────────────────────────────────────────────

export const safeName = (t) => String(t)
  .replace(/[\/\\:*?"<>|\r\n]+/g, ' ').replace(/["']/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, 60).trim();

const pad = (n) => String(n).padStart(3, '0');
const LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳'];

export function buildPlan(rows) {
  const root = `ivr2:/${CFG.rootExt}`;
  const skipped = [];
  const kept = [];
  for (const row of rows) {
    const dur = Number(row.duration_seconds);
    if (!row.audio_url) { skipped.push({ seq: row.seq, topic: row.topic, why: 'אין קובץ שמע' }); continue; }
    if (!Number.isFinite(dur)) { skipped.push({ seq: row.seq, topic: row.topic, why: 'אין נתון אורך' }); continue; }
    if (dur < CFG.minSeconds) { skipped.push({ seq: row.seq, topic: row.topic, why: `קצר מ-${CFG.minSeconds} שניות (${Math.round(dur)})` }); continue; }
    const c = classify(row);
    if (c.skip) { skipped.push({ seq: row.seq, topic: row.topic, why: c.skip }); continue; }
    kept.push({ row, c });
  }

  const buckets = new Map();
  const put = (path, label, item) => {
    if (!buckets.has(path)) buckets.set(path, { path, label, items: [] });
    buckets.get(path).items.push(item);
  };
  for (const item of kept) {
    const { c } = item;
    if (c.weekly && CFG.splitWeekly) { put(`${root}/0`, 'החיזוק השבועי — מוצאי שבת', item); continue; }
    if (c.cat === 1) {
      const ci = CHUMASHIM.findIndex((x) => x.name === c.sub);
      const pi = CHUMASHIM[ci].parshiot.indexOf(c.parsha);
      put(`${root}/1/${ci + 1}/${pi + 1}`, `פרשת ${c.parsha}`, item);
    } else if (c.cat === 2) {
      put(`${root}/2/${MOADIM.findIndex((x) => x.name === c.sub) + 1}`, c.sub, item);
    } else {
      put(`${root}/${c.cat}`, c.catName, item);
    }
  }

  const leaves = [];
  for (const b of buckets.values()) {
    b.items.sort((x, y) => (x.row.seq ?? 0) - (y.row.seq ?? 0));
    if (b.items.length <= CFG.maxPerFolder) { leaves.push(b); continue; }
    const parts = Math.ceil(b.items.length / CFG.maxPerFolder);
    const per = Math.ceil(b.items.length / parts);
    for (let i = 0; i < parts; i++) {
      leaves.push({ path: `${b.path}/${i + 1}`, label: `${b.label} — חלק ${LETTERS[i] || i + 1}`, items: b.items.slice(i * per, (i + 1) * per) });
    }
  }

  const files = [];
  for (const leaf of leaves) {
    leaf.items.forEach((item, i) => files.push({
      seq: item.row.seq,
      id: item.row.id,
      folder: leaf.path,
      path: `${leaf.path}/${pad(i)} ${safeName(item.row.topic)}.wav`,
      title: item.row.topic,
      durationSeconds: Math.round(Number(item.row.duration_seconds)),
      audioUrl: item.row.audio_url,
      weekly: item.c.weekly,
    }));
  }

  const menus = new Map([[root, 'חיזוקים קצרים']]);
  if (CFG.splitWeekly) menus.set(`${root}/0`, 'החיזוק השבועי — מוצאי שבת');
  menus.set(`${root}/1`, 'פרשות השבוע');
  CHUMASHIM.forEach((c, i) => {
    menus.set(`${root}/1/${i + 1}`, `חומש ${c.name}`);
    c.parshiot.forEach((p, j) => menus.set(`${root}/1/${i + 1}/${j + 1}`, `פרשת ${p}`));
  });
  menus.set(`${root}/2`, 'מועדים וזמנים');
  MOADIM.forEach((m, i) => menus.set(`${root}/2/${i + 1}`, m.name));
  for (const t of TOPICS) if (t.key >= 3) menus.set(`${root}/${t.key}`, t.name);
  for (const l of leaves) if (!menus.has(l.path)) menus.set(l.path, l.label);

  return {
    root, leaves, files, skipped, menus: Object.fromEntries(menus),
    stats: {
      total: rows.length, uploading: files.length, skipped: skipped.length,
      weekly: files.filter((f) => f.weekly).length, folders: leaves.length,
    },
  };
}

const byExt = (a, b) => {
  const A = a.split('/'); const B = b.split('/');
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (Number(A[i]) || 0) - (Number(B[i]) || 0);
    if (d) return d;
    if (A[i] !== B[i]) return (A[i] || '').localeCompare(B[i] || '');
  }
  return 0;
};

export function renderTree(plan) {
  const counts = new Map(plan.leaves.map((l) => [l.path, l.items.length]));
  const out = [`${plan.root}  —  חיזוקים קצרים  (${plan.stats.uploading} הקלטות)`];
  for (const p of Object.keys(plan.menus).sort(byExt)) {
    if (p === plan.root) continue;
    const depth = p.slice(plan.root.length).split('/').filter(Boolean).length;
    const n = counts.get(p);
    out.push(`${'   '.repeat(depth)}${p.split('/').pop()} · ${plan.menus[p]}${n ? `  (${n})` : ''}`);
  }
  return out.join('\n');
}

// ── מקור הנתונים ──────────────────────────────────────────────────────────

const FIELDS = 'id,seq,topic,parsha_or_date,duration_seconds,audio_url,original_name,subfolder,source,edited_transcript,raw_transcript';

async function fetchRecordings() {
  const out = [];
  const size = 200;
  for (let from = 0; ; from += size) {
    const res = await fetch(`${CFG.supabaseUrl}/rest/v1/recordings?select=${FIELDS}&deleted_at=is.null&order=seq.asc`, {
      headers: { apikey: CFG.supabaseKey, Authorization: `Bearer ${CFG.supabaseKey}`, Range: `${from}-${from + size - 1}` },
    });
    if (!res.ok) throw new Error(`שליפה מהמסד נכשלה: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows);
    log(`נשלפו ${out.length} רשומות`);
    if (rows.length < size) return out;
  }
}

async function downloadAudio(url, retries = 3) {
  let last;
  for (let i = 0; i <= retries; i++) {
    if (i) await sleep(2000 * 2 ** (i - 1));
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10000 || buf.subarray(0, 200).toString('utf8').includes('<html')) {
        throw new Error(`התקבל תוכן שאינו שמע (${buf.length} בתים) — ייתכן שהקובץ אינו משותף`);
      }
      return buf;
    } catch (e) { last = e; }
  }
  throw new Error(`הורדה נכשלה — ${last?.message}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ימות המשיח ────────────────────────────────────────────────────────────

function assertInRoot(path) {
  if (!new RegExp(`^ivr2:/${CFG.rootExt}(/|$)`).test(path) || path.includes('..')) {
    throw new Error(`חסימת בטיחות: ניסיון לכתוב אל "${path}" מחוץ לשלוחה ${CFG.rootExt}`);
  }
  return path;
}

async function ymCall(action, fields, retries = 4) {
  let last;
  for (let i = 0; i <= retries; i++) {
    if (i) await sleep(2000 * 2 ** (i - 1));
    try {
      const body = new FormData();
      body.append('token', token());
      for (const [k, v] of Object.entries(fields)) if (v != null) body.append(k, v);
      const res = await fetch(`${CFG.yemotBase}/${action}`, { method: 'POST', body });
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
  throw new Error(`${action} נכשל אחרי ${retries + 1} ניסיונות — ${last?.message}`);
}

const getSession = () => ymCall('GetSession', {});
const listDir = (p) => ymCall('GetIVR2Dir', { path: assertInRoot(p) });
const uploadText = (p, contents) => (assertInRoot(p), ymCall('UploadTextFile', { what: p, contents }));

async function uploadFile(path, buffer) {
  assertInRoot(path);
  const body = new FormData();
  body.append('token', token());
  body.append('path', path);
  body.append('convertAudio', '1');
  body.append('file', new Blob([buffer]), path.split('/').pop());
  const res = await fetch(`${CFG.yemotBase}/UploadFile`, { method: 'POST', body });
  const text = await res.text();
  if (!res.ok) throw new Error(`UploadFile HTTP ${res.status} — ${text.slice(0, 200)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`UploadFile תשובה לא צפויה: ${text.slice(0, 200)}`); }
  if (json.responseStatus && json.responseStatus !== 'OK') throw new Error(`UploadFile: ${json.responseStatus}`);
  return json;
}

// תבניות ההגדרה של השלוחות. אם הפיילוט מראה שצריך תיקון — משנים כאן בלבד.
const menuIni = (label) => `# ${label}\ntype=menu\ntimeout=7\nenable_keyboard=yes\n`;
const playfileIni = (label) => `# ${label}\ntype=playfile\nplayfileListSort=name\nenable_keyboard=yes\n`;

// ── פקודות ────────────────────────────────────────────────────────────────

const loadState = () => (existsSync(F('state.json')) ? JSON.parse(readFileSync(F('state.json'), 'utf8')) : { done: {}, failed: {} });
const saveState = (s) => writeFileSync(F('state.json'), JSON.stringify(s, null, 2));

async function cmdPlan() {
  log('שולף רשומות מאתר החיזוקים…');
  const plan = buildPlan(await fetchRecordings());
  writeFileSync(F('plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(F('tree.txt'), renderTree(plan));
  writeFileSync(F('skipped.txt'), plan.skipped.map((s) => `${s.seq}\t${s.why}\t${s.topic || ''}`).join('\n'));
  const weekly = plan.files.filter((f) => f.weekly);
  writeFileSync(F('weekly.txt'),
    '# הקלטות שנפתחות ב"שבוע טוב" — לבדיקה אם זה רב אחר\n# seq\tשלוחה\tכותרת\n\n'
    + weekly.map((f) => `${f.seq}\t${f.folder}\t${f.title}`).join('\n'));
  console.log('\n' + renderTree(plan) + '\n');
  log(`סה"כ ${plan.stats.total} · ${plan.stats.uploading} להעלאה · ${plan.stats.skipped} מדולגות · ${plan.stats.folders} תיקיות`);
  log(`${plan.stats.weekly} נפתחות ב"שבוע טוב" — מסומנות ב-chizukim-out/weekly.txt, לא מופרדות`);
  log('נשמר בתיקייה chizukim-out: plan.json · tree.txt · skipped.txt · weekly.txt');
}

async function cmdVerify() {
  if (!CFG.system || !CFG.secret) throw new Error('חסרים YEMOT_SYSTEM ו-YEMOT_APIKEY');
  log('בודק חיבור לימות המשיח…');
  log(`חיבור תקין: ${JSON.stringify(await getSession()).slice(0, 200)}`);
  const dir = await listDir(`ivr2:/${CFG.rootExt}`);
  const entries = dir.files || dir.data || [];
  log(`שלוחה ${CFG.rootExt} מכילה כרגע ${entries.length} פריטים`);
  if (entries.length) console.log(JSON.stringify(entries, null, 2).slice(0, 1500));
  if (existsSync(F('plan.json'))) {
    const plan = JSON.parse(readFileSync(F('plan.json'), 'utf8'));
    for (const f of plan.files) assertInRoot(f.path);
    log(`כל ${plan.files.length} הנתיבים בתוך ivr2:/${CFG.rootExt} — בדיקת הבטיחות עברה`);
  }
}

async function cmdUpload(pilot) {
  if (!existsSync(F('plan.json'))) throw new Error('אין תוכנית — הריצו קודם: node chizukim.mjs plan');
  const plan = JSON.parse(readFileSync(F('plan.json'), 'utf8'));
  const state = loadState();
  await getSession();
  log('חיבור תקין.');

  let files = plan.files.filter((f) => !state.done[f.id]);
  if (pilot) {
    const folder = files[0]?.folder;
    files = files.filter((f) => f.folder === folder).slice(0, 3);
    log(`מצב טייס: ${files.length} הקלטות לתיקייה ${folder} בלבד.`);
  }

  // הגדרת השלוחות שיש בהן תוכן
  const leafPaths = new Set(files.map((f) => f.folder));
  const needed = new Set();
  for (const p of leafPaths) {
    needed.add(p);
    let cur = p;
    while (cur !== plan.root) { cur = cur.slice(0, cur.lastIndexOf('/')); needed.add(cur); }
  }
  for (const p of [...needed].sort(byExt)) {
    if (state.done[`ini:${p}`]) continue;
    const label = plan.menus[p] || p.split('/').pop();
    try {
      await uploadText(`${p}/ext.ini`, leafPaths.has(p) ? playfileIni(label) : menuIni(label));
      state.done[`ini:${p}`] = { at: new Date().toISOString() };
      log(`✓ שלוחה ${p} · ${label}`);
    } catch (e) {
      log(`✗ שלוחה ${p} — ${e.message}`);
      if (e.fatal) throw e;
    }
  }
  saveState(state);

  log(`מעלה ${files.length} הקלטות…`);
  let ok = 0; let bad = 0;
  for (const [i, f] of files.entries()) {
    try {
      await uploadFile(f.path, await downloadAudio(f.audioUrl));
      state.done[f.id] = { path: f.path, at: new Date().toISOString() };
      delete state.failed[f.id];
      ok++;
      if (ok % 10 === 0 || pilot) saveState(state);
      log(`(${i + 1}/${files.length}) ✓ ${f.path}`);
    } catch (e) {
      bad++;
      state.failed[f.id] = { path: f.path, error: e.message };
      saveState(state);
      log(`(${i + 1}/${files.length}) ✗ ${f.path} — ${e.message}`);
      if (e.fatal) { log('שגיאה חוסמת — עוצר.'); break; }
    }
  }
  saveState(state);
  log(`סיום: ${ok} הצליחו · ${bad} נכשלו.`);
  if (pilot) log('התקשרו לשלוחה ובדקו שההשמעה תקינה, ואז: node chizukim.mjs upload');
  else if (bad) log('להשלמת הכושלות — הריצו שוב את אותה פקודה. מה שכבר עלה יידלג.');
}

function cmdStatus() {
  const s = loadState();
  const failed = Object.entries(s.failed);
  console.log(`הועלו: ${Object.keys(s.done).filter((k) => !k.startsWith('ini:')).length}`);
  console.log(`נכשלו: ${failed.length}`);
  for (const [, v] of failed.slice(0, 40)) console.log(`  ${v.path} — ${v.error}`);
}

function cmdSelftest() {
  const R = (seq, topic, pod, body, dur = 200) => ({ id: 'i' + seq, seq, topic, parsha_or_date: pod, duration_seconds: dur, audio_url: 'http://x/' + seq, edited_transcript: body });
  const rows = [
    R(1, 'השם אברהם וטענת ישמעאל', 'פרשת חיי שרה', 'יום שישי, ערב שבת קודש, פרשת חיי שרה.'),
    R(2, 'שמחת פורים וכוחה של השמחה', 'פורים', 'יום שני.'),
    R(3, 'הכרת הטוב — להודות על מה שיש', '', 'שבוע טוב ומבורך לכולם.'),
    R(4, 'הודעות טכניות למאזינים', '', 'שלום'),
    R(5, 'המקטרגים על תפילת האדם', '', 'יום שני.', 19),
  ];
  const plan = buildPlan(rows);
  const expect = [
    ['סווג פרשה', plan.files.some((f) => f.path.startsWith('ivr2:/5/1/1/5/'))],
    ['סווג מועד', plan.files.some((f) => f.path.startsWith('ivr2:/5/2/7/'))],
    ['זוהתה שבועית', plan.stats.weekly === 1],
    ['סוננה הודעה טכנית', plan.skipped.some((s) => s.why === 'הודעה טכנית')],
    ['סוננה הקלטה קצרה', plan.skipped.some((s) => s.why.includes('קצר'))],
    ['שם קובץ נקי', safeName('א/ב:ג"ד  ה') === 'א ב ג ד ה'],
  ];
  let bad = 0;
  for (const [name, pass] of expect) { console.log(`${pass ? '✓' : '✗'} ${name}`); if (!pass) bad++; }
  try { assertInRoot('ivr2:/4/000.wav'); console.log('✗ שומר הסף לא חסם'); bad++; }
  catch { console.log('✓ שומר הסף חוסם כתיבה מחוץ לשלוחה'); }
  console.log(bad ? `\n${bad} בדיקות נכשלו` : '\nכל הבדיקות עברו. הקובץ תקין.');
  process.exit(bad ? 1 : 0);
}

// ── כניסה ─────────────────────────────────────────────────────────────────

const cmd = process.argv[2];
const run = {
  selftest: cmdSelftest, plan: cmdPlan, verify: cmdVerify, status: cmdStatus,
  pilot: () => cmdUpload(true), upload: () => cmdUpload(false),
}[cmd];

if (!run) {
  console.log('שימוש: node chizukim.mjs <selftest|plan|verify|pilot|upload|status>');
  process.exit(1);
}
await Promise.resolve(run()).catch((e) => { log(`שגיאה: ${e.message}`); process.exit(1); });
