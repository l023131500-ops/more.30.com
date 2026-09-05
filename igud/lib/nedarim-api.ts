/**
 * לקוח ה-API של נדרים פלוס, לפי התיעוד הרשמי.
 *
 * כללי הבסיס שמנחים את הקובץ הזה:
 *   • כל הפניות ב-POST עם גוף form, בקידוד UTF-8.
 *   • פרמטר המוסד בפעולות ה-Reports והטפסים הוא MosadId (ולא Mosad).
 *   • פרמטר האימות הוא ApiPassword — המפתח שמתחיל ב-npk_.
 *     ApiValid שייך לדף התשלום בלבד, ואינו בשימוש כאן.
 *   • רוב הפעולות מחזירות JSON, אבל שגיאה עלולה לחזור כטקסט חשוף.
 *     לכן מנסים לפרסר, ואם נכשל מתייחסים לתשובה כטקסט שגיאה.
 *   • תאריכים בפורמט dd/MM/yyyy.
 */

export const FORMS_ENDPOINT = process.env.NEDARIM_FORMS_ENDPOINT
  || 'https://matara.pro/nedarimplus/Forms/Manage.aspx';

export const REPORTS_ENDPOINT = process.env.NEDARIM_REPORTS_ENDPOINT
  || 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';

export interface NedarimCredentials {
  mosadId: string;
  apiPassword: string;
}

/** רשומה שחוזרת מהטופס. כל הערכים חוזרים כמחרוזות. */
export type NedarimRecord = Record<string, string>;

export class NedarimError extends Error {
  constructor(message: string, readonly raw?: string) {
    super(message);
    this.name = 'NedarimError';
  }
}

function credentialsOf(credentials: NedarimCredentials): Record<string, string> {
  const mosadId = String(credentials.mosadId || '').trim();
  const apiPassword = String(credentials.apiPassword || '').trim();
  if (!mosadId) throw new NedarimError('חסר מספר מוסד בהגדרות נדרים פלוס');
  if (!apiPassword) {
    throw new NedarimError('חסר מפתח API (ApiPassword) בהגדרות נדרים פלוס. המפתח מתחיל ב-npk_');
  }
  return { MosadId: mosadId, ApiPassword: apiPassword };
}

/**
 * פנייה בודדת לנדרים פלוס.
 * מחזירה את הגוף המפורסר, או זורקת NedarimError עם ההודעה שהתקבלה.
 */
export async function nedarimCall(
  endpoint: string,
  fields: Record<string, string>,
  timeoutMs = 30000,
): Promise<unknown> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let text: string;
  let ok: boolean;
  let status: number;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      signal: controller.signal,
    });
    ok = res.ok;
    status = res.status;
    text = await res.text();
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? 'הפנייה לנדרים פלוס עברה את זמן ההמתנה'
      : `הפנייה לנדרים פלוס נכשלה: ${error instanceof Error ? error.message : 'שגיאת רשת'}`;
    throw new NedarimError(reason);
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // התיעוד: לעיתים שגיאה חוזרת כטקסט חשוף גם בפעולה שמוגדרת JSON
    throw new NedarimError(
      text.trim().slice(0, 300) || `נדרים פלוס החזירו תשובה ריקה (HTTP ${status})`,
      text,
    );
  }

  if (!ok) {
    throw new NedarimError(`נדרים פלוס החזירו שגיאה ${status}`, text);
  }

  // מעטפת השגיאה: Result/Message ברוב הפעולות, Status/Message בטפסים ובאייפרם
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const flag = String(obj.Result ?? obj.Status ?? '').trim();
    if (flag && flag.toLowerCase() !== 'ok') {
      throw new NedarimError(String(obj.Message || flag), text);
    }
  }

  return parsed;
}

export interface FetchFormOptions {
  /** מספר הטופס בנדרים פלוס */
  tofesId: string;
  /** מאיזה מזהה להמשיך, לא כולל. 0 = מההתחלה */
  lastId?: string | number;
  /** כמות רשומות בקריאה, עד 500 */
  maxId?: number;
  /** Desc = מהחדש לישן. ברירת המחדל: מהישן לחדש */
  order?: 'Asc' | 'Desc';
  /** שמות העמודות לבקשה. ברירת מחדל: Field1..Field80 ועמודות המערכת */
  fields?: string[];
}

/** בונה את GetJsonParam: המפתח בתשובה = שם העמודה בטופס. */
export function jsonParam(fields: string[]): string {
  const map: Record<string, string> = {};
  for (const field of fields) map[field] = field;
  return JSON.stringify(map);
}

/** רשימת השדות הסטנדרטית: Field1..count, בתוספת עמודות המערכת. */
export function defaultFields(count = 80): string[] {
  const fields: string[] = [];
  for (let i = 1; i <= count; i += 1) fields.push(`Field${i}`);
  fields.push('UpdateDate', 'MasofName');
  return fields;
}

/**
 * משיכת דף אחד של רשומות טופס.
 * ID, CreatedDate, MasofId ו-TransactionId חוזרים תמיד, גם בלי לבקש אותם.
 */
export async function fetchFormPage(
  credentials: NedarimCredentials,
  options: FetchFormOptions,
): Promise<NedarimRecord[]> {
  const maxId = Math.min(Math.max(Number(options.maxId) || 500, 1), 500);
  const fields = options.fields?.length ? options.fields : defaultFields();

  const params: Record<string, string> = {
    ...credentialsOf(credentials),
    Action: 'GetJson',
    TofesId: String(options.tofesId),
    MaxId: String(maxId),
    LastId: String(options.lastId ?? '0'),
    GetJsonParam: jsonParam(fields),
  };
  if (options.order === 'Desc') params.Order = 'Desc';

  const parsed = await nedarimCall(FORMS_ENDPOINT, params);

  if (!Array.isArray(parsed)) {
    // התיעוד: בשגיאה חוזר אובייקט עם Status/Message במקום המערך
    const obj = (parsed || {}) as Record<string, unknown>;
    throw new NedarimError(
      String(obj.Message || 'נדרים פלוס לא החזירו רשימת רשומות'),
    );
  }

  return parsed as NedarimRecord[];
}

/**
 * משיכת כל הרשומות החדשות, בלולאה לפי הנחיות התיעוד:
 * שומרים את ה-ID האחרון ושולחים אותו כ-LastId בקריאה הבאה,
 * עד שחוזר מערך ריק.
 */
export async function fetchFormRecords(
  credentials: NedarimCredentials,
  options: FetchFormOptions & { maxRecords?: number },
): Promise<{ records: NedarimRecord[]; lastId: string; pages: number }> {
  const cap = Math.max(Number(options.maxRecords) || 2000, 1);
  const pageSize = Math.min(Number(options.maxId) || 500, 500);

  const records: NedarimRecord[] = [];
  let lastId = String(options.lastId ?? '0');
  let pages = 0;

  while (records.length < cap) {
    const page = await fetchFormPage(credentials, {
      ...options,
      lastId,
      maxId: Math.min(pageSize, cap - records.length),
      order: 'Asc',
    });
    pages += 1;
    if (!page.length) break;

    records.push(...page);

    const nextId = page.reduce((max, row) => {
      const value = Number(row.ID);
      return Number.isFinite(value) && value > max ? value : max;
    }, Number(lastId) || 0);

    // הגנה מפני לולאה אינסופית אם השרת לא מקדם את המזהה
    if (String(nextId) === lastId) break;
    lastId = String(nextId);

    if (page.length < pageSize) break;
  }

  return { records, lastId, pages };
}
