import { cfg } from './config.mjs';
import { classify, CHUMASHIM, MOADIM, TOPICS } from './classify.mjs';

/** מנקה כותרת לשם קובץ חוקי בימות המשיח */
export function safeName(title) {
  return String(title)
    .replace(/[\/\\:*?"<>|\r\n]+/g, ' ')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
}

const pad = (n) => String(n).padStart(3, '0');

/**
 * בונה את עץ השלוחות המלא מתוך הרשומות.
 * @returns {{tree:Array, files:Array, skipped:Array, stats:Object}}
 */
export function buildPlan(rows) {
  const root = `ivr2:/${cfg.rootExt}`;
  const skipped = [];
  const kept = [];

  for (const row of rows) {
    const dur = Number(row.duration_seconds);
    if (!row.audio_url) { skipped.push({ seq: row.seq, topic: row.topic, why: 'אין קובץ שמע' }); continue; }
    if (!Number.isFinite(dur)) { skipped.push({ seq: row.seq, topic: row.topic, why: 'אין נתון אורך' }); continue; }
    if (dur < cfg.minSeconds) { skipped.push({ seq: row.seq, topic: row.topic, why: `קצר מ-${cfg.minSeconds} שניות (${Math.round(dur)})` }); continue; }
    const c = classify(row);
    if (c.skip) { skipped.push({ seq: row.seq, topic: row.topic, why: c.skip }); continue; }
    kept.push({ row, c });
  }

  // אשכולות: מפתח תיקייה -> רשומות
  const buckets = new Map();
  const put = (path, label, item) => {
    if (!buckets.has(path)) buckets.set(path, { path, label, items: [] });
    buckets.get(path).items.push(item);
  };

  for (const item of kept) {
    const { c } = item;
    if (c.weekly) { put(`${root}/0`, 'החיזוק השבועי — מוצאי שבת', item); continue; }
    if (c.cat === 1) {
      const ci = CHUMASHIM.findIndex((x) => x.name === c.sub);
      const pi = CHUMASHIM[ci].parshiot.indexOf(c.parsha);
      put(`${root}/1/${ci + 1}/${pi + 1}`, `פרשת ${c.parsha}`, item);
    } else if (c.cat === 2) {
      const mi = MOADIM.findIndex((x) => x.name === c.sub);
      put(`${root}/2/${mi + 1}`, c.sub, item);
    } else {
      put(`${root}/${c.cat}`, c.catName, item);
    }
  }

  // פיצול תיקייה גדולה מדי ל"חלק א׳ / חלק ב׳"
  const LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳'];
  const leaves = [];
  for (const b of buckets.values()) {
    b.items.sort((x, y) => (x.row.seq ?? 0) - (y.row.seq ?? 0));
    if (b.items.length <= cfg.maxPerFolder) { leaves.push(b); continue; }
    const parts = Math.ceil(b.items.length / cfg.maxPerFolder);
    const per = Math.ceil(b.items.length / parts);
    for (let i = 0; i < parts; i++) {
      leaves.push({
        path: `${b.path}/${i + 1}`,
        label: `${b.label} — חלק ${LETTERS[i] || i + 1}`,
        items: b.items.slice(i * per, (i + 1) * per),
      });
    }
  }

  // קבצים בפועל
  const files = [];
  for (const leaf of leaves) {
    leaf.items.forEach((item, i) => {
      files.push({
        seq: item.row.seq,
        id: item.row.id,
        path: `${leaf.path}/${pad(i)} ${safeName(item.row.topic)}.wav`,
        folder: leaf.path,
        title: item.row.topic,
        durationSeconds: Math.round(Number(item.row.duration_seconds)),
        audioUrl: item.row.audio_url,
        weekly: item.c.weekly,
      });
    });
  }

  // תפריטי הביניים, עם שם לכל אחד — כדי שהעץ יהיה קריא לאישור
  const menus = new Map([[root, 'חיזוקים קצרים']]);
  menus.set(`${root}/0`, 'החיזוק השבועי — מוצאי שבת');
  menus.set(`${root}/1`, 'פרשות השבוע');
  CHUMASHIM.forEach((c, i) => menus.set(`${root}/1/${i + 1}`, `חומש ${c.name}`));
  menus.set(`${root}/2`, 'מועדים וזמנים');
  MOADIM.forEach((m, i) => menus.set(`${root}/2/${i + 1}`, m.name));
  for (const t of TOPICS) if (t.key >= 3) menus.set(`${root}/${t.key}`, t.name);
  for (const leaf of leaves) if (!menus.has(leaf.path)) menus.set(leaf.path, leaf.label);

  const stats = {
    total: rows.length,
    uploading: files.length,
    skipped: skipped.length,
    weekly: files.filter((f) => f.weekly).length,
    daily: files.filter((f) => !f.weekly).length,
    folders: leaves.length,
  };

  return { leaves, files, skipped, menus: Object.fromEntries(menus), stats, root };
}

/** מיון נתיבים לפי מספר השלוחה בכל רמה, לא לפי סדר לקסיקוגרפי */
const byExt = (a, b) => {
  const A = a.split('/');
  const B = b.split('/');
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (Number(A[i]) || 0) - (Number(B[i]) || 0);
    if (d) return d;
    if (A[i] !== B[i]) return (A[i] || '').localeCompare(B[i] || '');
  }
  return 0;
};

/** תיאור קריא של העץ, לאישור לפני העלאה */
export function renderTree(plan) {
  const counts = new Map(plan.leaves.map((l) => [l.path, l.items.length]));
  const lines = [`${plan.root}  —  חיזוקים קצרים  (${plan.stats.uploading} הקלטות)`];
  for (const p of Object.keys(plan.menus).sort(byExt)) {
    if (p === plan.root) continue;
    const depth = p.slice(plan.root.length).split('/').filter(Boolean).length;
    const n = counts.get(p);
    lines.push(`${'   '.repeat(depth)}${p.split('/').pop()} · ${plan.menus[p]}${n ? `  (${n})` : ''}`);
  }
  return lines.join('\n');
}

export { TOPICS };
