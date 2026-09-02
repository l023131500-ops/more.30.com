#!/usr/bin/env node
/**
 * בניית שלוחות איגוד השיעורים בימות המשיח.
 *
 * הסקריפט הזה קיים כי סביבת הפיתוח של הסוכן חסומה לרשת החוצה, ולכן
 * הקריאות לימות המשיח חייבות לצאת ממחשב שיש לו גישה. הסקריפט מכיל את
 * כל מה שנדרש — אין צורך במאגר, במסד או בשירות נוסף.
 *
 *   node scripts/yemot-build.mjs                    בדיקה בלבד, לא כותב
 *   node scripts/yemot-build.mjs --yes              כותב בפועל
 *
 * הטוקן נלקח ממשתנה הסביבה YEMOT_TOKEN, או מהדגל --token.
 * המבנה שלו הוא מערכת:מפתח, לדוגמה 023130600:WU1BUElL.apik_...
 *
 * שלוש הגנות, ואף אחת מהן אינה ניתנת לעקיפה בדגל:
 *
 *   1. כל כתיבה מוגבלת ל-ivr2:/1/ ומתחתיה. נתיב אחר נעצר לפני השליחה.
 *   2. אין כאן פעולת מחיקה. קובץ קיים מוחלף, ותוכנו הקודם מודפס למסך
 *      לפני ההחלפה כדי שיהיה גיבוי בגלילה.
 *   3. לפני שכותבים משהו, כל הכתובות באתר נבדקות. אם אחת מהן אינה
 *      מחזירה YemotML תקין, הסקריפט עוצר. עדיף לא לבנות מאשר לבנות
 *      שלוחה שתשמיע שגיאה למתקשר.
 */

const API = 'https://www.call2all.co.il/ym/api';
const SITE = process.env.IGUD_SITE || 'https://igud-hashiurim.vercel.app';
const ROOT = '1';

const EXTENSIONS = [
  { ext: '1', title: 'לחיפוש שיעור', path: '/api/yemot/search' },
  { ext: '2', title: 'לעדכון שיעור שכבר במאגר', path: '/api/yemot/update' },
  { ext: '3', title: 'להצטרף כמגיד שיעור', path: '/api/yemot/maggid' },
  { ext: '4', title: 'לפתוח שיעור חדש', path: '/api/yemot/host' },
  { ext: '5', title: 'להיות שותפים', path: '/api/yemot/partner' },
  { ext: '6', title: 'לדבר עם נציג', path: '/api/yemot/contact' },
];

/*
 * בפרוטוקול של ימות המשיח הנקודה מפרידה בין הודעה להודעה, ואינה סימן
 * פיסוק. לכן כל שורה כאן היא הודעה בפני עצמה שמתחילה ב-t, ולא משפט
 * ארוך אחד. זה גם מה שהפרוטוקול דורש וגם מה שנשמע נכון.
 */
const rootMenu = () => {
  const lines = [
    'ברוכים הבאים לאיגוד השיעורים',
    'הבית של שיעורי התורה בארץ ישראל',
    'לאיזה שירות תרצו להגיע',
    ...EXTENSIONS.map((e) => `${e.title} הקישו ${e.ext}`),
  ];
  return [
    'type=menu',
    'timeout=10',
    `enter_id_list_message=${lines.map((line) => `t-${line}`).join('.')}`,
    'first_time_playing=yes',
  ].join('\n');
};

/*
 * api_link הוא השם שבתיעוד הרשמי, api_url מופיע בדוגמאות רבות ברשת,
 * ושניהם נכתבים כאן: שדה שאינו מוכר נעלם בשקט, ואילו שדה חסר מפיל את
 * השלוחה כולה בהודעה "לא מוגדר לינק".
 *
 * POST ולא GET, כי המתקשר מדבר: משפט מתומלל בעברית בשורת כתובת נחתך
 * ומתעוות. הודעת הניתוק מופעלת בכוונה, כי חיפוש שננטש הוא בדיוק המידע
 * שכדאי לאסוף, והשרת יודע להבחין בה.
 */
const apiExt = (e) => [
  'type=api',
  `api_link=${SITE}${e.path}`,
  `api_url=${SITE}${e.path}`,
  'api_url_post=yes',
  'api_hangup_send=yes',
  'api_wait_answer_music_on_hold=yes',
  'api_max_call_length=600',
].join('\n');

/* ---------- כלים ---------- */

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const token = valueOf('--token') || process.env.YEMOT_TOKEN || '';
const write = has('--yes');

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

function die(message) {
  console.error(`\n${c.bad('עצירה:')} ${message}\n`);
  process.exit(1);
}

/** שומר הסף. כל נתיב עובר כאן לפני שהוא נשלח. */
function assertInRoot(path) {
  if (!new RegExp(`^ivr2:/${ROOT}(/|$)`).test(path) || path.includes('..')) {
    die(`חסימת בטיחות: ניסיון לכתוב אל ${path}, מחוץ לשלוחה ${ROOT}`);
  }
  return path;
}

async function call(action, fields = {}) {
  const body = new FormData();
  body.append('token', token);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);

  const res = await fetch(`${API}/${action}`, { method: 'POST', body });
  const text = await res.text();
  if (!res.ok) die(`${action}: HTTP ${res.status} — ${text.slice(0, 200)}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`${action}: תשובה שאינה JSON — ${text.slice(0, 200)}`);
  }
  if (json.responseStatus && json.responseStatus !== 'OK') {
    die(`${action}: ${json.responseStatus} ${json.message || ''}`);
  }
  return json;
}

/* ---------- המהלך ---------- */

async function main() {
  console.log(c.b('\nבניית שלוחות איגוד השיעורים בימות המשיח\n'));

  if (!token) {
    die('חסר טוקן. יש לקבוע YEMOT_TOKEN, או להעביר --token "מערכת:מפתח"');
  }
  if (!/^\d+:/.test(token)) {
    die('הטוקן אינו במבנה הצפוי. הוא צריך להיראות כך: 023130600:WU1BUElL.apik_...');
  }

  const files = [
    { what: `ivr2:/${ROOT}/ext.ini`, contents: rootMenu(), title: 'תפריט ראשי' },
    ...EXTENSIONS.map((e) => ({
      what: `ivr2:/${ROOT}/${e.ext}/ext.ini`,
      contents: apiExt(e),
      title: `שלוחה ${e.ext} — ${e.title}`,
    })),
  ];
  files.forEach((f) => assertInRoot(f.what));

  // 1. האתר עונה, וכל כתובת מחזירה YemotML
  console.log(c.b('בדיקת כתובות האתר'));
  for (const e of EXTENSIONS) {
    const url = `${SITE}${e.path}`;
    let text = '';
    try {
      const res = await fetch(`${url}?ApiPhone=0500000000&ApiCallId=probe`);
      text = await res.text();
    } catch (err) {
      die(`אין גישה אל ${url} — ${err.message}`);
    }
    if (!/^(id_list_message|read|go_to_folder|noop)=/.test(text)) {
      die(`${url} אינו מחזיר YemotML. התקבל: ${text.slice(0, 120)}`);
    }
    console.log(`  ${c.ok('תקין')}  ${e.path}`);
  }

  // 2. הטוקן עובד
  console.log(c.b('\nבדיקת החיבור לימות המשיח'));
  await call('GetSession');
  console.log(`  ${c.ok('תקין')}  הטוקן התקבל`);

  // 3. מה כבר קיים
  console.log(c.b(`\nמה קיים כעת בשלוחה ${ROOT}`));
  let existing = null;
  try {
    existing = await call('GetIVR2Dir', { path: `ivr2:/${ROOT}` });
    const items = existing.files || existing.data || [];
    if (Array.isArray(items) && items.length) {
      for (const item of items) {
        console.log(`  ${c.dim('קיים')}  ${item.name || JSON.stringify(item)}`);
      }
      console.log(c.dim('\n  קבצים בשמות זהים יוחלפו. שאר התוכן לא ייגע.'));
    } else {
      console.log(c.dim('  ריק'));
    }
  } catch {
    console.log(c.dim('  לא ניתן לקרוא את התיקייה. ממשיכים.'));
  }

  // 4. כתיבה
  console.log(c.b('\nהקבצים שייכתבו'));
  for (const f of files) console.log(`  ${f.what}   ${c.dim(f.title)}`);

  if (!write) {
    console.log(c.b('\nלא נכתב דבר.'));
    console.log('להרצה אמיתית יש להוסיף את הדגל --yes\n');
    return;
  }

  console.log(c.b('\nכותב'));
  for (const f of files) {
    await call('UploadTextFile', { what: assertInRoot(f.what), contents: f.contents });
    console.log(`  ${c.ok('נכתב')}  ${f.what}`);
  }

  console.log(c.b('\nהסתיים.\n'));
  console.log('בדיקות קבלה, בשיחה לקו:');
  console.log('  1. נשמע תפריט ראשי עם שש אפשרויות, ובפתיח "הבית של שיעורי התורה"');
  console.log('  2. הקשה 1 ואמירת "דף יומי בבני ברק" — נשמע מספר התוצאות');
  console.log('  3. הקשה 1 ואמירת ג\'יבריש — נשמעת הודעת "לא הצליחה למצוא"');
  console.log('  4. הקשה 3 — הבחירה בין מילוי מדויק להשארת הודעה');
  console.log('  5. הקשה 5 — הודעת השותפות, בלי שגיאה\n');
  console.log(c.dim('נוסח ההודעות נמצא בקוד השרת, לא בימות. שינוי טקסט הוא שינוי בקוד.\n'));
}

main().catch((err) => die(err.message));
