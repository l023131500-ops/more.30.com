import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'out');

// טעינת .env בלי תלויות חיצוניות
if (existsSync(join(ROOT, '.env'))) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`חסר משתנה סביבה ${name} — העתיקו את .env.example ל-.env ומלאו אותו`);
  return v;
}

export const cfg = {
  yemotBase: process.env.YEMOT_BASE || 'https://www.call2all.co.il/ym/api',
  get token() {
    const sys = need('YEMOT_SYSTEM');
    const key = process.env.YEMOT_APIKEY;
    return key ? `${sys}:${key}` : `${sys}:${need('YEMOT_PASSWORD')}`;
  },
  rootExt: process.env.YEMOT_ROOT_EXT || '5',
  supabaseUrl: () => need('SUPABASE_URL'),
  supabaseKey: () => need('SUPABASE_KEY'),
  // מינימום אורך הקלטה תקינה, בשניות
  minSeconds: Number(process.env.MIN_SECONDS || 30),
  // כמה קבצים לכל תיקייה לפני פיצול ל"חלק א׳ / חלק ב׳"
  maxPerFolder: Number(process.env.MAX_PER_FOLDER || 60),
  // האם להפריד את החיזוק השבועי לשלוחה משלו.
  // כרגע לא — ההקלטות רק מסומנות ב-out/weekly.txt לבדיקה.
  // אחרי שיתברר שזה אכן רב אחר, מדליקים כאן ומריצים plan מחדש.
  splitWeekly: process.env.SPLIT_WEEKLY === '1',
};

mkdirSync(OUT, { recursive: true });
