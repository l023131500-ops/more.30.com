import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * שכבת החיבור למערכת הקולית של ימות המשיח.
 *
 * שני חלקים:
 *   1. בניית תשובות לשלוחת API (YemotML) — מה שהמערכת משמיעה למתקשר.
 *   2. לקוח ה-API של ימות, לבניית השלוחות והעלאת קבצי ext.ini.
 *
 * הפרוטוקול כאן נכתב לפי התיעוד הרשמי של מודול ה-API, ושלושה כללים בו
 * אינם אינטואיטיביים אבל קובעים הכל:
 *
 *   הנקודה היא מפריד בין הודעות, לא סימן פיסוק. "שלום. עולם" אינו משפט
 *   אחד אלא שתי הודעות, והשנייה חייבת לפתוח בסוג ההשמעה. טקסט שיש בו
 *   נקודה חופשית שובר את התשובה כולה, והמתקשר שומע "אין מענה משרת".
 *
 *   הקו המפריד מפריד בין סוג ההשמעה לתוכן. t-שלום הוא הקראת "שלום".
 *   מקף בתוך הטקסט נקרא כמפריד נוסף ומקלקל אותו.
 *
 *   סדר הפרמטרים ב-read אינו חופשי, והוא שונה מהאינטואיציה: השם, האם
 *   להשתמש בערך קיים, ורק אחר כך המקסימום ואז המינימום.
 *
 * שלושת הכללים האלה מטופלים כאן, במקום אחד, כדי ששאר הקוד יוכל לכתוב
 * עברית רגילה בלי לחשוב על התחביר.
 */

/* ============================================================
   1. בניית תשובות לשלוחת API
   ============================================================ */

/**
 * ניקוי טקסט להקראה.
 *
 * ארבעה תווים מוסרים כי לכולם יש משמעות תחבירית בפרוטוקול:
 * = מפריד בין פקודה לערך, & בין פקודה לפקודה, . בין הודעה להודעה,
 * ו--- בין סוג ההשמעה לתוכן.
 */
export function speakable(text: string): string {
  return String(text || '')
    .replace(/[=&]/g, ' ')
    .replace(/[.\-–—]/g, ' ')
    .replace(/["'׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * פירוק טקסט לרצף הודעות.
 *
 * במקום להסיר את הנקודות ולקבל משפט אחד ארוך שנקרא ברצף, כל משפט הופך
 * להודעה בפני עצמה. זה גם מה שהפרוטוקול דורש וגם מה שנשמע נכון: בין
 * הודעה להודעה יש נשימה, ומתקשר ששומע תפריט צריך אותה.
 */
function segments(...parts: (string | undefined | null)[]): string[] {
  return parts
    .filter(Boolean)
    .flatMap((part) => String(part).split(/\.\s+|\s\|\s/))
    .map(speakable)
    .filter(Boolean)
    .map((line) => `t-${line}`);
}

/** הודעה מוקראת. כל משפט הופך להודעה נפרדת ברצף. */
export function say(...parts: (string | undefined | null)[]): string {
  const list = segments(...parts);
  return list.length ? `id_list_message=${list.join('.')}` : '';
}

export interface ReadOptions {
  /** number לספרות, voice לזיהוי דיבור, record להקלטה השמורה במערכת */
  mode?: 'number' | 'voice' | 'record';
  /** מספר ספרות מרבי */
  max?: number;
  /** מספר ספרות מזערי */
  min?: number;
  /** שניות המתנה להקשה */
  wait?: number;
  /** צורת ההשמעה של מה שהוקש חזרה למתקשר */
  echo?: 'No' | 'Number' | 'Digits' | 'Phone' | 'TeudatZehut' | 'Time' | 'Date';
  /** האם לבקש אישור על ההקשה. ברירת המחדל היא לא לבקש */
  confirm?: boolean;
  /** האם לאפשר מעבר בלי הקשה */
  allowEmpty?: boolean;
  /** שניות שקט שמסיימות דיבור */
  silence?: number;
  /** שניות מרביות לדיבור */
  seconds?: number;
}

/**
 * בקשת קלט מהמתקשר. הערך חוזר בקריאה הבאה כפרמטר בשם varName.
 *
 * המבנה הוא read=הודעה=מפרט הקלט, ומפרט הקלט תלוי בסוג:
 *
 *   הקשה  שם, שימוש בקיים, מקסימום, מינימום, המתנה, השמעה חוזרת,
 *         חסימת כוכבית, חסימת אפס, החלפת תו, מקשים מותרים, חזרות,
 *         מעבר על ריק, טקסט לריק, נעילת מקלדת, בקשת אישור
 *   דיבור שם, שימוש בקיים, voice, שפה, לאפשר הקשה, מקסימום ספרות,
 *         מנוע, שניות שקט לסיום, שניות מרביות
 *
 * המקסימום קודם למינימום. זה נראה הפוך, וזה מה שהתיעוד אומר.
 */
export function read(text: string, varName: string, options: ReadOptions = {}): string {
  const {
    mode = 'number', max = 10, min = 1, wait = 7,
    echo = 'No', confirm = false, allowEmpty = false,
    silence = 3, seconds = 20,
  } = options;

  const prompt = segments(text).join('.');

  if (mode === 'voice') {
    // המנוע של ההקלטות, ולא של התפריט: הוא מאפשר משפט שלם ולא מילה
    return `read=${prompt}=${varName},,voice,,,,record,${silence},${seconds}`;
  }

  if (mode === 'record') {
    return `read=${prompt}=${varName},,record,,,no,yes,,2,${seconds}`;
  }

  const spec = [
    varName, '', max, min, wait, echo,
    'no', 'no', '', '',
    '', allowEmpty ? 'Ok' : '', '', '',
    confirm ? '' : 'no',
  ];
  return `read=${prompt}=${spec.join(',')}`;
}

/**
 * הקראת מספר ספרה אחר ספרה.
 *
 * הפרוטוקול יודע לעשות את זה בעצמו בסוג ההשמעה d, וזה עדיף על פיזור
 * רווחים בין הספרות בטקסט: ההקראה יוצאת נכונה, ומספר לא ייקרא בטעות
 * כמיליונים.
 */
export function sayDigits(value: string): string {
  const clean = String(value || '').replace(/\D/g, '');
  return clean ? `id_list_message=d-${clean}` : '';
}

/* ---------- סליקה ---------- */

export interface PaymentPlan {
  /** שם הסולק כפי שימות מכירה אותו, למשל nedarim */
  provider: string;
  /** סכום לחיוב בשקלים. בלי סכום, המתקשר בוחר בעצמו */
  amount?: number | string;
  /** מספר חנות או פרויקט אצל הסולק */
  shop?: string;
  /** כמות תשלומים. בלי ערך, המתקשר בוחר */
  payments?: number | string;
  /** 1 שקל, 2 דולר */
  currency?: number | string;
  userName?: string;
  terminal?: string;
  password?: string;
}

/**
 * מעבר לסליקת אשראי בתוך השיחה.
 *
 * סדר הערכים קבוע ואינו מתועד בשמות, ולכן הוא נכתב כאן פעם אחת:
 * סולק, סכום, מספר חנות, תשלומים, מטבע, סוג פלאקארד, שם משתמש,
 * טרמינל, סיסמה, תשובה מלאה, שידור טלפון, הקלטת שם, דילוג על אישור,
 * יצירת טוקן, והתנהגות בכוכבית.
 *
 * GoBack בסוף אינו קישוט: בלעדיו מתקשר שמקיש כוכבית באמצע הסליקה
 * נלכד בלולאה שמחזירה אותו לגבייה שוב ושוב. איתו, השרת מקבל בחזרה
 * CreditCard_CODE=GoBack ויכול להחליט מה להציע לו.
 *
 * אחרי סליקה מוצלחת ימות קוראת שוב לשרת עם כל הפרמטרים הקודמים
 * ובתוספת CreditCard_CODE, ולכן המשך השיחה נכתב כאן ולא בימות.
 */
export function creditCard(plan: PaymentPlan): string {
  const values = [
    plan.provider,
    plan.amount ?? '',
    plan.shop ?? '',
    plan.payments ?? '',
    plan.currency ?? 1,
    '',
    plan.userName ?? '',
    plan.terminal ?? '',
    plan.password ?? '',
    '',
    '',
    '',
    '',
    '',
    'GoBack',
  ];
  return `credit_card=${values.join(',')}`;
}

/** מעבר לשלוחה אחרת. */
export function goToFolder(path: string): string {
  return `go_to_folder=${path}`;
}

/** סיום השיחה. */
export const hangup = () => goToFolder('hangup');

/** חזרה לשלוחת הבסיס. */
export const goHome = () => goToFolder('/');

/** הערה ליומן, בלי השפעה על השיחה. משמשת כתשובה תקינה שאינה עושה דבר. */
export const noop = (note = 'ok') => `noop=${speakable(note)}`;

/** האם הפנייה הזו היא הודעה על ניתוק, ולא שלב בשיחה. */
export function isHangup(params: Record<string, string>): boolean {
  return String(params.hangup || '').toLowerCase() === 'yes';
}

/**
 * איחוד פקודות לתשובה אחת.
 *
 * שתי התאמות לפרוטוקול נעשות כאן, כדי שהקוד הקורא יוכל לכתוב שורות
 * נפרדות וקריאות:
 *
 *   הודעות רצופות מתאחדות לפקודה אחת. שתי פקודות id_list_message
 *   נפרדות אינן חוקיות, והשנייה הייתה מבטלת את הראשונה.
 *
 *   הודעה שלפני בקשת קלט נבלעת לתוכה. זה בדיוק המבנה של read: החלק
 *   הראשון שלה הוא ההודעה. כך ההודעה נשמעת ומיד אחריה השאלה, בלי
 *   פקודה מיותרת ובלי סיכון שההודעה תלך לאיבוד.
 *
 * פקודה שאחרי read מושמטת. המערכת שולחת את הקלט לשרת ומחכה לתשובה
 * חדשה, ולכן מעבר שלוחה שנרשם באותה תשובה לא היה מתבצע לעולם — ובמקרה
 * הרע היה מוציא את המתקשר מהשלוחה במקום לשאול אותו.
 */
export function respond(...commands: (string | undefined | null)[]): Response {
  const out: string[] = [];
  let stop = false;

  for (const raw of commands) {
    const command = String(raw || '').trim();
    if (!command || stop) continue;

    if (command.startsWith('id_list_message=')) {
      const body = command.slice('id_list_message='.length);
      const last = out[out.length - 1];
      if (last && last.startsWith('id_list_message=')) {
        out[out.length - 1] = `${last}.${body}`;
      } else {
        out.push(command);
      }
      continue;
    }

    if (command.startsWith('read=')) {
      const last = out[out.length - 1];
      if (last && last.startsWith('id_list_message=')) {
        const message = last.slice('id_list_message='.length);
        out[out.length - 1] = `read=${message}.${command.slice('read='.length)}`;
      } else {
        out.push(command);
      }
      stop = true;
      continue;
    }

    out.push(command);
  }

  return new Response(out.join('&'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** קריאת הפרמטרים של ימות מהבקשה, בין אם GET ובין אם POST. */
export async function yemotParams(request: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => { params[key] = value; });

  if (request.method === 'POST') {
    const type = request.headers.get('content-type') || '';
    try {
      if (type.includes('application/json')) {
        Object.assign(params, await request.json());
      } else {
        const form = await request.formData();
        form.forEach((value, key) => { params[key] = String(value); });
      }
    } catch {
      // גוף ריק או לא תקין: ממשיכים עם פרמטרי ה-URL
    }
  }
  return params;
}

/* ============================================================
   2. לקוח ה-API של ימות המשיח
   ============================================================ */

const YEMOT_BASE = process.env.YEMOT_BASE || 'https://www.call2all.co.il/ym/api';

export interface YemotConfig {
  system: string;
  apiKey?: string;
  password?: string;
  rootExt: string;
}

/** קריאת הגדרות החיבור מהמסד, בהרשאות של הלקוח שנמסר. */
export async function yemotConfig(client: SupabaseClient): Promise<YemotConfig | null> {
  const { data } = await client.from('igud_settings').select('value').eq('key', 'yemot').maybeSingle();
  const value = (data?.value || {}) as Record<string, string>;
  if (!value.system) return null;
  return {
    system: value.system,
    apiKey: value.apiKey || undefined,
    password: value.password || undefined,
    rootExt: value.rootExt || '1',
  };
}

function token(config: YemotConfig): string {
  const secret = config.apiKey || config.password;
  if (!secret) throw new Error('חסר מפתח API או סיסמה למערכת הקולית');
  return `${config.system}:${secret}`;
}

/**
 * שומר הסף: כל כתיבה חייבת לשבת בתוך שלוחת הבסיס.
 * זו ההגנה שמונעת פגיעה בשלוחות אחרות במערכת של הלקוח.
 */
export function assertInRoot(path: string, rootExt: string): string {
  if (!new RegExp(`^ivr2:/${rootExt}(/|$)`).test(path)) {
    throw new Error(`חסימת בטיחות: ניסיון לכתוב אל ${path} מחוץ לשלוחה ${rootExt}`);
  }
  if (path.includes('..')) throw new Error(`חסימת בטיחות: נתיב לא תקין ${path}`);
  return path;
}

async function callYemot(
  config: YemotConfig, action: string, fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new FormData();
  body.append('token', token(config));
  for (const [key, value] of Object.entries(fields)) body.append(key, value);

  const res = await fetch(`${YEMOT_BASE}/${action}`, { method: 'POST', body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${action}: HTTP ${res.status} ${text.slice(0, 160)}`);

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${action}: תשובה לא צפויה מהמערכת הקולית`);
  }
  const status = json.responseStatus as string | undefined;
  if (status && status !== 'OK') {
    throw new Error(`${action}: ${status}`);
  }
  return json;
}

export const getSession = (config: YemotConfig) => callYemot(config, 'GetSession', {});

export function uploadTextFile(config: YemotConfig, path: string, contents: string) {
  assertInRoot(path, config.rootExt);
  return callYemot(config, 'UploadTextFile', { what: path, contents });
}

export function listDir(config: YemotConfig, path: string) {
  assertInRoot(path, config.rootExt);
  return callYemot(config, 'GetIVR2Dir', { path });
}

/* ============================================================
   3. תבניות השלוחות
   ============================================================ */

export interface ExtensionPlan {
  ext: string;
  title: string;
  apiPath: string;
}

/**
 * שש השלוחות של האיגוד, לפי הסדר.
 *
 * החיפוש בדיבור חופשי אינו שלוחה בפני עצמה: הוא דרך הכניסה של שלוחה 1,
 * כי אדם שמחפש שיעור יודע לומר מה הוא רוצה הרבה לפני שהוא יודע באיזה
 * ענף של תפריט זה יושב. כך 5 ו-6 מתפנות למה שאין לו מקום אחר.
 */
export const EXTENSIONS: ExtensionPlan[] = [
  { ext: '1', title: 'חיפוש שיעור', apiPath: '/api/yemot/search' },
  { ext: '2', title: 'הוספה ועדכון של שיעור', apiPath: '/api/yemot/update' },
  { ext: '3', title: 'הצטרפות למגידי השיעורים', apiPath: '/api/yemot/maggid' },
  { ext: '4', title: 'הקמת שיעור חדש', apiPath: '/api/yemot/host' },
  { ext: '5', title: 'שותפות בזיכוי הרבים', apiPath: '/api/yemot/partner' },
  { ext: '6', title: 'מענה אנושי', apiPath: '/api/yemot/contact' },
  { ext: '7', title: 'אזור אישי', apiPath: '/api/yemot/personal' },
  { ext: '8', title: 'פורטל מגידי השיעורים', apiPath: '/api/yemot/portal' },
];

/**
 * שורות תפריט הבסיס, לפי סדר ההשמעה.
 *
 * הן נבנות מהנוסחים ולא מרשימת השלוחות, כי מי שעורך את הקו רוצה
 * לשנות מילה בתפריט בלי לגעת בקוד. הפונקציה מקבלת את קורא הנוסחים
 * ולכן היא עובדת גם עם ברירות המחדל וגם עם מה שנערך בניהול.
 */
export function rootMenuLines(c: (key: string) => string): string[] {
  const keys = [
    'root.welcome.1', 'root.welcome.2',
    'root.ext.1', 'root.ext.2', 'root.ext.3', 'root.ext.4',
    'root.ext.5', 'root.ext.6', 'root.ext.7', 'root.ext.8',
    'root.footer.1',
  ];
  return keys.map((key) => c(key)).filter(Boolean);
}

/**
 * תוכן ext.ini של תפריט הבסיס.
 *
 * הנקודה מפרידה בין הודעה להודעה, ולכן כל שורה כאן היא הודעה בפני
 * עצמה ולא סימן פיסוק. כך גם נשמעת נשימה בין הברכה לתפריט.
 *
 * timeout ארוך יחסית בכוונה: התפריט הזה בן אחת עשרה הודעות, ומתקשר
 * ששומע אותו בפעם הראשונה צריך זמן להחליט אחרי שהוא נגמר.
 */
export function rootMenuIni(c: (key: string) => string): string {
  const lines = rootMenuLines(c).map((line) => `t-${speakable(line)}`);
  return [
    'type=menu',
    'timeout=12',
    `enter_id_list_message=${lines.join('.')}`,
    'first_time_playing=yes',
  ].join('\n');
}

/**
 * תוכן ext.ini של שלוחת API.
 *
 * api_link הוא השם שבתיעוד הרשמי. api_url מופיע בדוגמאות רבות ברשת,
 * ושתי הגרסאות נכתבות כאן כי שדה שאינו מוכר פשוט נעלם, ואילו שדה חסר
 * מפיל את השלוחה כולה בהודעה "לא מוגדר לינק".
 *
 * השליחה ב-POST ולא ב-GET, כי המתקשר מדבר ולא מקיש: משפט מתומלל בעברית
 * בשורת כתובת נחתך באורך ומתעוות בקידוד.
 *
 * הודעת הניתוק מופעלת בכוונה. חיפוש שננטש באמצע הוא בדיוק המידע ששווה
 * לאסוף, והשרת יודע להבחין בה ולרשום אותה בלי להמשיך את השיחה.
 */
export function apiExtensionIni(origin: string, plan: ExtensionPlan): string {
  const url = `${origin}${plan.apiPath}`;
  return [
    'type=api',
    `api_link=${url}`,
    `api_url=${url}`,
    'api_url_post=yes',
    'api_hangup_send=yes',
    'api_wait_answer_music_on_hold=yes',
    'api_max_call_length=600',
  ].join('\n');
}
