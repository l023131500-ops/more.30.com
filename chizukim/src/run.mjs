import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, cfg } from './config.mjs';
import { fetchRecordings, downloadAudio } from './source.mjs';
import { buildPlan, renderTree } from './plan.mjs';
import { getSession, listDir, uploadFile, uploadText, assertInRoot } from './yemot.mjs';
import { menuIni, playfileIni } from './templates.mjs';

const PLAN_FILE = join(OUT, 'plan.json');
const STATE_FILE = join(OUT, 'state.json');
const LOG_FILE = join(OUT, 'run.log');

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
};

const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { done: {}, failed: {} });
const saveState = (s) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

async function cmdPlan() {
  log('שולף רשומות מהאתר…');
  const rows = await fetchRecordings({ log });
  const plan = buildPlan(rows);
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
  writeFileSync(join(OUT, 'tree.txt'), renderTree(plan));
  writeFileSync(
    join(OUT, 'skipped.txt'),
    plan.skipped.map((s) => `${s.seq}\t${s.why}\t${s.topic || ''}`).join('\n'),
  );
  // ההקלטות השבועיות — מסומנות לבדיקה, לא מופרדות לשלוחה נפרדת
  const weekly = plan.files.filter((f) => f.weekly);
  writeFileSync(
    join(OUT, 'weekly.txt'),
    ['# הקלטות שנפתחות ב"שבוע טוב" — לבדיקה אם זה רב אחר',
     '# seq\tשלוחה\tכותרת', ''].join('\n')
    + weekly.map((f) => `${f.seq}\t${f.folder}\t${f.title}`).join('\n'),
  );
  console.log('\n' + renderTree(plan) + '\n');
  log(`סה"כ ${plan.stats.total} רשומות · ${plan.stats.uploading} להעלאה · ${plan.stats.skipped} מדולגות`);
  log(`מתוכן ${plan.stats.weekly} נפתחות ב"שבוע טוב" (מסומנות ב-out/weekly.txt, לא מופרדות)`);
  log(`${plan.stats.folders} תיקיות`);
  log(`נשמר: ${PLAN_FILE} · out/tree.txt · out/skipped.txt · out/weekly.txt`);
}

async function cmdVerify() {
  log('בודק חיבור לימות המשיח…');
  const s = await getSession();
  log(`חיבור תקין: ${JSON.stringify(s).slice(0, 200)}`);
  const root = `ivr2:/${cfg.rootExt}`;
  const dir = await listDir(root);
  const entries = dir.files || dir.data || [];
  log(`שלוחה ${cfg.rootExt} מכילה כרגע ${entries.length} פריטים`);
  if (entries.length) {
    console.log(JSON.stringify(entries, null, 2).slice(0, 2000));
    log('שימו לב: השלוחה אינה ריקה. הכלי לא ימחק דבר, אך ייתכן שקבצים ידרסו.');
  }
  if (!existsSync(PLAN_FILE)) return log('אין עדיין תוכנית — הריצו קודם: npm run plan');
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8'));
  for (const f of plan.files) assertInRoot(f.path);
  log(`כל ${plan.files.length} הנתיבים עברו את בדיקת הבטיחות (בתוך ${root} בלבד)`);
}

async function cmdUpload({ pilot }) {
  if (!existsSync(PLAN_FILE)) throw new Error('אין תוכנית — הריצו קודם: npm run plan');
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8'));
  const state = loadState();

  await getSession();
  log('חיבור תקין.');

  let files = plan.files.filter((f) => !state.done[f.id]);
  if (pilot) {
    const folder = files[0]?.folder;
    files = files.filter((f) => f.folder === folder).slice(0, 3);
    log(`מצב טייס: מעלה ${files.length} קבצים לתיקייה ${folder} בלבד.`);
  }
  log(`להעלאה: ${files.length} קבצים`);

  // הגדרת השלוחות. רק שלוחות שיש בהן תוכן — אין טעם בתפריט ריק.
  const leafPaths = new Set(files.map((f) => f.folder));
  const needed = new Set();
  for (const p of leafPaths) {
    needed.add(p);
    let cur = p;
    while (cur !== plan.root) { cur = cur.slice(0, cur.lastIndexOf('/')); needed.add(cur); }
  }
  for (const p of [...needed].sort()) {
    if (state.done[`ini:${p}`]) continue;
    const label = plan.menus[p] || p.split('/').pop();
    const ini = leafPaths.has(p) ? playfileIni(label) : menuIni(label);
    try {
      await uploadText(`${p}/ext.ini`, ini);
      state.done[`ini:${p}`] = { path: `${p}/ext.ini`, at: new Date().toISOString() };
      log(`✓ הגדרת שלוחה ${p} · ${label}`);
    } catch (e) {
      log(`✗ הגדרת שלוחה ${p} — ${e.message}`);
      if (e.fatal) throw e;
    }
  }
  saveState(state);

  let ok = 0;
  let fail = 0;
  for (const [i, f] of files.entries()) {
    try {
      const buf = await downloadAudio({ audio_url: f.audioUrl });
      await uploadFile(f.path, buf, f.path.split('/').pop());
      state.done[f.id] = { path: f.path, at: new Date().toISOString() };
      delete state.failed[f.id];
      ok++;
      if (ok % 10 === 0 || pilot) saveState(state);
      log(`(${i + 1}/${files.length}) ✓ ${f.path}`);
    } catch (e) {
      fail++;
      state.failed[f.id] = { path: f.path, error: e.message, at: new Date().toISOString() };
      saveState(state);
      log(`(${i + 1}/${files.length}) ✗ ${f.path} — ${e.message}`);
      if (e.fatal) { log('שגיאה חוסמת — עוצר.'); break; }
    }
  }
  saveState(state);
  log(`סיום: ${ok} הצליחו · ${fail} נכשלו · ניתן להריץ שוב כדי להשלים רק את מה שחסר.`);
}

function cmdStatus() {
  const state = loadState();
  const done = Object.keys(state.done).length;
  const failed = Object.entries(state.failed);
  console.log(`הועלו: ${done}`);
  console.log(`נכשלו: ${failed.length}`);
  for (const [, v] of failed.slice(0, 30)) console.log(`  ${v.path} — ${v.error}`);
}

const [cmd, ...args] = process.argv.slice(2);
const opts = { pilot: args.includes('--pilot') };
const run = { plan: cmdPlan, verify: cmdVerify, status: cmdStatus, upload: () => cmdUpload(opts) }[cmd];
if (!run) {
  console.log('שימוש: node src/run.mjs <plan|verify|upload [--pilot]|status>');
  process.exit(1);
}
run().catch((e) => { log(`שגיאה: ${e.message}`); process.exit(1); });
