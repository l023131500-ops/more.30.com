import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * שכבת החיבור למערכת הקולית של ימות המשיח.
 *
 * שני חלקים:
 *   1. בניית תשובות לשלוחת API (YemotML) — מה שהמערכת משמיעה למתקשר.
 *   2. לקוח ה-API של ימות, לבניית השלוחות והעלאת קבצי ext.ini.
 *
 * הפרמטרים של הפקודה read שונים מעט בין גרסאות. ברירות המחדל כאן
 * מתאימות לגרסה הנפוצה, וניתן לשנות אותן דרך האובייקט ReadOptions.
 */

/* ============================================================
   1. בניית תשובות לשלוחת API
   ============================================================ */

/** ניקוי טקסט להקראה: התווים = ו-& הם מפרידים בפרוטוקול. */
export function speakable(text: string): string {
  return String(text || '')
    .replace(/[=&]/g, ' ')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** הודעה מוקראת. */
export function say(...parts: string[]): string {
  return `id_list_message=t-${speakable(parts.filter(Boolean).join('. '))}`;
}

export interface ReadOptions {
  /** מספר ניסיונות לפני מעבר לשגיאה */
  attempts?: number;
  /** מספר ספרות מזערי */
  min?: number;
  /** מספר ספרות מרבי */
  max?: number;
  /** שניות המתנה */
  wait?: number;
  /** number לספרות, voice להקלטה, record להקלטת קול */
  mode?: 'number' | 'voice' | 'record';
  /** האם לאפשר ריק */
  allowEmpty?: boolean;
}

/**
 * בקשת קלט מהמתקשר. הערך חוזר בקריאה הבאה כפרמטר בשם varName.
 *
 * סדר הפרמטרים: attempts, min, max, wait, mode, confirm, blockAsterisk,
 * blockZero, replaceChar, digitsAllowed, allowEmpty
 */
export function read(text: string, varName: string, options: ReadOptions = {}): string {
  const {
    attempts = 3, min = 1, max = 10, wait = 7, mode = 'number', allowEmpty = false,
  } = options;
  const params = [attempts, min, max, wait, mode, 'no', 'no', 'no', '', '', allowEmpty ? 'yes' : 'no'];
  return `read=t-${speakable(text)}=${varName},${params.join(',')}`;
}

/** מעבר לשלוחה אחרת. */
export function goToFolder(path: string): string {
  return `go_to_folder=${path}`;
}

/** סיום השיחה. */
export const hangup = () => goToFolder('hangup');

/** חזרה לשלוחת הבסיס. */
export const goHome = () => goToFolder('/');

/** איחוד פקודות לתשובה אחת. */
export function respond(...commands: string[]): Response {
  return new Response(commands.filter(Boolean).join('&'), {
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

/** ארבע השלוחות של האיגוד, לפי הסדר. */
export const EXTENSIONS: ExtensionPlan[] = [
  { ext: '1', title: 'חיפוש שיעור', apiPath: '/api/yemot/search' },
  { ext: '2', title: 'עדכון שיעור קיים', apiPath: '/api/yemot/update' },
  { ext: '3', title: 'הצטרפות כמגיד שיעור', apiPath: '/api/yemot/maggid' },
  { ext: '4', title: 'פתיחת שיעור תורה חדש', apiPath: '/api/yemot/host' },
  { ext: '5', title: 'חיפוש בדיבור חופשי', apiPath: '/api/yemot/agent' },
];

/** תוכן ext.ini של תפריט הבסיס. */
export function rootMenuIni(): string {
  const options = EXTENSIONS
    .map((e) => `לשלוחת ${e.title} הקישו ${e.ext}`)
    .join('. ');
  return [
    'type=menu',
    'timeout=10',
    `enter_id_list_message=t-ברוכים הבאים לאיגוד השיעורים, מחברים בין לומדים ומלמדים. ${options}.`,
    'first_time_playing=yes',
  ].join('\n');
}

/** תוכן ext.ini של שלוחת API. */
export function apiExtensionIni(origin: string, plan: ExtensionPlan): string {
  return [
    'type=api',
    `api_url=${origin}${plan.apiPath}`,
    'api_url_post_data=ApiCallId,ApiPhone,ApiExtension,ApiDID,ApiEnterID',
    'api_max_call_length=600',
  ].join('\n');
}
