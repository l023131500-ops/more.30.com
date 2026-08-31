import { FORM_PARSERS } from './nedarim.js';
import type { NedarimRecord } from './nedarim-api';

/**
 * הגשר בין רשומת ה-API של נדרים פלוס לבין מנתחי הטפסים הקיימים.
 *
 * ה-API מחזיר רשומה עם עמודות בשם FieldN, בעוד שהמנתחים בקובץ nedarim.js
 * עובדים על שורת גיליון לפי אותיות עמודה. סדר העמודות בייצוא לאקסל זהה
 * לסדר השדות בטופס, ולכן די בשחזור השורה: עמודות המערכת במקומן, ואחריהן
 * שדות הטופס לפי הסדר. כך אותה לוגיקת מיפוי משרתת גם את הייבוא מקובץ,
 * גם את ה-callback וגם את המשיכה מה-API — ואין שכפול של כללי הפירוש.
 *
 * fieldBase הוא מספר ה-Field של השדה הראשון בטופס. ברירת המחדל 1.
 * אם יתברר במסך "בדיקת השדות" שהמספור אצל נדרים פלוס מוסט, משנים אותו
 * בהגדרות בלי לגעת בקוד.
 */

export type FormId = '4320' | '4063' | '4018' | '4357';
export type FormKind = 'lesson' | 'host' | 'maggid' | 'subscriber';

export interface FormLayout {
  form: FormId;
  kind: FormKind;
  label: string;
  /** מיקום עמודות המערכת בייצוא */
  system: Partial<Record<'ID' | 'CreatedDate' | 'UpdateDate' | 'MasofId' | 'MasofName' | 'TransactionId', number>>;
  /** אינדקס העמודה של שדה הטופס הראשון */
  firstField: number;
  /** התוויות של שדות הטופס, לפי הסדר. משמשות את מסך בדיקת השדות */
  fieldLabels: string[];
}

const L4320 = [
  'type', 'נושא השיעור', 'פרט', 'נושאים ללימוד / נושא',
  'LessonStorage1', 'LessonStorage2', 'LessonStorage3', 'LessonStorage4', 'LessonStorage5',
  'למי מיועד השיעור', 'קהל יעד של השיעור', 'למי מיועד השיעור',
  'באיזה שפה אתם מעוניינים / שפה', 'אופי השיעורים', 'מיקום מדויק',
  'שם הרב', 'עיר', 'שכונה', 'רחוב', 'מספר', 'מה תרצו לעדכן',
  'תאריך (שיעור חד פעמי)', 'שעה (שיעור חד פעמי)',
  'שעה — יום ראשון', 'שעה — יום שני', 'שעה — יום שלישי', 'שעה — יום רביעי',
  'שעה — יום חמישי', 'שעה — יום שישי', 'שעה — ליל שבת', 'שעה — שבת', 'שעה — מוצאי שבת',
  'זמנים לשינוי (הימים שסומנו)', 'באיזה צורה השיעור מועבר', 'פרט',
  'פרטים לעדכון על שינוי שיעור לפרסום',
  'שם הרב / איש קשר', 'טלפון / נייד', 'מייל / אימייל', 'שם הארגון שהקים את השיעור',
];

const L4063 = [
  'type', 'עבור מי אתם מעוניינים לקבוע שיעור?', 'איש קשר / שם מלא', 'טלפון / נייד',
  'מייל / אימייל', 'מיקום מדויק', 'תאריך', 'שעה', 'סגנון השיעור', 'עיר', 'שכונה', 'רחוב',
  'האם אתם צריכים עזרה בשירותי דת למשפחה?', 'שם בית הכנסת', 'שם הגבאי / רב בית הכנסת',
  'נוסח בית הכנסת', 'כמות מתפללים בבית הכנסת', 'מה רמת הפעילות ביום בבית הכנסת?',
  'אם סומן פעילות חלקית פרט', 'האם מתקיימים ביום שיעורים בבית הכנסת?',
  'האם יש לכם צורך בעוד שירותי דת לבית הכנסת?', 'פירוט שירותי דת',
  'האם תרצה למלאות את השאלון עכשיו?', 'סגנון המשפחה', 'למי מיועד השיעור',
  'באיזה שפה אתם מעוניינים / שפה', 'פרט', 'סגנון הלומדים', 'פרט',
  'נושאים ללימוד / נושא', 'פרט', 'רקע מגיד שיעור', 'פרט', 'אופי השיעורים', 'פרט',
  'סגנון דיבור', 'פרט', 'מיקום השיעור', 'קביעות השיעור שאתם מעוניינים?',
  'ימים מועדפים', 'פרט', 'שעות מועדפות', 'כמה אתם מעוניינים לשלם לרב מגיד השיעור?',
  'אמצעי תשלום', 'סכום לחיוב', 'מספר תשלומים', 'מספר בנק', 'מספר סניף',
  'מספר חשבון', 'יום לחיוב בחודש',
];

const L4018 = [
  'type', 'שם הרב / שם מלא / איש קשר', 'טלפון / נייד', 'עיר', 'מייל / אימייל',
  'ת. לידה', 'מצב אישי', 'האם תרצה למלאות את השאלון עכשיו?', 'מקום לימודים בעבר',
  'רקע', 'עיסוק - תפקיד', 'פרט', 'פרט', 'נושאים',
  'האם יש לך הכשרה מקצועית תורנית?', 'האם יש לך ניסיון לדבר בציבור?',
  'למי מתאים לכם למסור שיעור', 'באיזה שפה אתם מעוניינים למסור שיעור', 'פרט',
  'סגנון קהל יעד', 'פרט', 'אופי השיעורים', 'פרט', 'סגנון דיבור', 'פרט',
  'מקומות מסירה', 'פרט', 'פרט', 'ניסיון נוסף', 'ימים מועדפים', 'שעות מועדפות',
  'שעות', 'היכן אתה מעוניין למסור את השיעורים?', 'איך אתה רגיל להתנייד ממקום למקום?',
  'מה התגמול שהיית מצפה לקבל?', 'ממליץ א — שם', 'ממליץ א — תפקיד', 'ממליץ א — טלפון',
  'ממליץ ב — שם', 'ממליץ ב — תפקיד', 'ממליץ ב — טלפון',
  'אמצעי תשלום', 'סכום לחיוב', 'מספר תשלומים', 'מספר בנק', 'מספר סניף',
  'מספר חשבון', 'יום לחיוב בחודש',
];

const L4357 = [
  'type', 'חיפוש שיעור מתוך המאגר', 'מעוניינים לקבל את פרטי השיעור למייל / טלפון',
  'שם פרטי', 'מספר זהות', 'טלפון נייד', 'מייל', 'מעוניינים להיות שותפים להפצת התורה',
  'אמצעי תשלום', 'סכום לחיוב', 'מספר תשלומים', 'מספר בנק', 'מספר סניף',
  'מספר חשבון', 'יום לחיוב בחודש',
];

export const FORM_LAYOUTS: Record<FormId, FormLayout> = {
  4320: {
    form: '4320',
    kind: 'lesson',
    label: 'עדכון שיעור קיים לפרסום',
    system: { ID: 0, CreatedDate: 1, UpdateDate: 2, MasofId: 3, MasofName: 4 },
    firstField: 5,
    fieldLabels: L4320,
  },
  4063: {
    form: '4063',
    kind: 'host',
    label: 'בקשה למגיד שיעור',
    system: { ID: 0, CreatedDate: 1, MasofId: 2, MasofName: 3 },
    firstField: 4,
    fieldLabels: L4063,
  },
  4018: {
    form: '4018',
    kind: 'maggid',
    label: 'רישום כמגיד שיעור',
    system: { ID: 0, CreatedDate: 1, MasofId: 2, MasofName: 3, TransactionId: 4 },
    firstField: 5,
    fieldLabels: L4018,
  },
  4357: {
    form: '4357',
    kind: 'subscriber',
    label: 'חיפוש שיעור והרשמה לעדכונים',
    system: { ID: 0, CreatedDate: 1, MasofId: 2, MasofName: 3, TransactionId: 4 },
    firstField: 5,
    fieldLabels: L4357,
  },
};

export const FORM_IDS = Object.keys(FORM_LAYOUTS) as FormId[];

export function layoutOf(form: string): FormLayout | null {
  return FORM_LAYOUTS[form as FormId] || null;
}

/** מספר שדות הטופס שיש לבקש מנדרים פלוס. */
export function fieldCount(layout: FormLayout): number {
  return layout.fieldLabels.length;
}

/** רשימת השדות לבקשה: Field<base>..Field<base+n-1> ועמודות המערכת. */
export function fieldsFor(layout: FormLayout, fieldBase = 1): string[] {
  const fields: string[] = [];
  for (let i = 0; i < fieldCount(layout); i += 1) fields.push(`Field${i + fieldBase}`);
  if (layout.system.UpdateDate !== undefined) fields.push('UpdateDate');
  if (layout.system.MasofName !== undefined) fields.push('MasofName');
  return fields;
}

/** שחזור שורת הגיליון מתוך רשומת ה-API. */
export function recordToRow(
  record: NedarimRecord, layout: FormLayout, fieldBase = 1,
): string[] {
  const total = layout.firstField + fieldCount(layout);
  const row: string[] = new Array(total).fill('');

  for (const [name, index] of Object.entries(layout.system)) {
    if (index === undefined) continue;
    row[index] = String(record[name] ?? '').trim();
  }
  for (let i = 0; i < fieldCount(layout); i += 1) {
    row[layout.firstField + i] = String(record[`Field${i + fieldBase}`] ?? '').trim();
  }
  return row;
}

/**
 * המרת רשומות ה-API לרשומות מנורמלות, דרך מנתח הטופס הקיים.
 * שלוש השורות הריקות בראש הן שורות הכותרת שהמנתחים מדלגים עליהן.
 */
export function parseRecords(
  records: NedarimRecord[], layout: FormLayout, fieldBase = 1,
): Record<string, unknown>[] {
  const parser = FORM_PARSERS[layout.form as unknown as keyof typeof FORM_PARSERS];
  if (!parser) throw new Error(`אין מנתח לטופס ${layout.form}`);

  const rows = [[], [], [], ...records.map((r) => recordToRow(r, layout, fieldBase))];
  return parser(rows) as Record<string, unknown>[];
}

/** תצוגת בדיקה: תווית השדה, שם העמודה והערך שהתקבל. */
export interface ProbeField {
  field: string;
  label: string;
  value: string;
}

export function probeRecord(
  record: NedarimRecord, layout: FormLayout, fieldBase = 1,
): { id: string; created: string; fields: ProbeField[] } {
  const fields: ProbeField[] = layout.fieldLabels.map((label, i) => ({
    field: `Field${i + fieldBase}`,
    label,
    value: String(record[`Field${i + fieldBase}`] ?? ''),
  }));
  return {
    id: String(record.ID ?? ''),
    created: String(record.CreatedDate ?? ''),
    fields,
  };
}
