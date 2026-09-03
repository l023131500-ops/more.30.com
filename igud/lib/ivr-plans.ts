import type { FormField, FormPlan } from './ivr-form';
import type { Copy } from './ivr-copy';
import { DAY_SLOTS } from './nedarim.js';

/**
 * השאלונים של השלוחות.
 *
 * כל שאלון הוא רשימת שדות, ותו לא. המנוע ב-ivr-form יודע לשאול, לשקף,
 * לאשר ולחזור אחורה; כאן נקבע רק מה שואלים ובאיזה סדר.
 *
 * שני עקרונות בבחירת השדות, ושניהם נגד הנטייה הטבעית להעתיק את הטופס
 * כמו שהוא:
 *
 *   טופס באתר יכול לשאול ארבעים שאלות, כי הממלא רואה את כולן ומדלג
 *   בעין. בטלפון כל שאלה עולה זמן, וכל שאלה מיותרת היא עוד סיכוי
 *   שהמתקשר ינתק באמצע. לכן נשאלות רק השאלות שבלעדיהן אי אפשר לפרסם,
 *   ועוד מעט מהן שמשפרות את הרשומה.
 *
 *   שאלה שאפשר לענות עליה במקומו — לא נשאלת. איש הקשר ומספר הטלפון
 *   יודעים למלא את עצמם מהמספר שממנו התקשרו, ולכן הם בסוף ואינם חובה.
 *
 * הערכים ברשימות הבחירה נשלפים מטבלת הטקסונומיה, שהיא בדיוק הרשימות
 * של הטפסים בנדרים פלוס. כך שיעור שנקלט בטלפון ושיעור שנקלט בעמדה
 * נראים אותו דבר במאגר, ואין שני אוצרות מילים לאותו שדה.
 */

/** ימי השבוע כפי שהם בטופס, כולל ליל שבת ומוצאי שבת */
const DAY_LABELS = (DAY_SLOTS as { label: string }[]).map((d) => d.label);

/** הוספת שיעור למאגר, שלוחה 2 */
export function lessonPlan(c: Copy, prefix = 'nl'): FormPlan {
  return {
    prefix,
    fields: [
      {
        key: 'teacher_name', ask: c('update.ask.teacher'), kind: 'text', required: true,
      },
      {
        key: 'topic', ask: c('update.ask.topic'), kind: 'choice', taxonomy: 'topics', required: true,
      },
      {
        key: 'city', ask: c('update.ask.city'), kind: 'text', match: 'cities', required: true,
      },
      {
        key: 'venue_name', ask: c('update.ask.venue'), kind: 'text', required: true,
      },
      { key: 'street', ask: c('update.ask.street'), kind: 'text' },
      { key: 'neighborhood', ask: c('update.ask.neighborhood'), kind: 'text' },
      {
        key: 'day',
        ask: c('update.ask.day'),
        kind: 'choice',
        required: true,
        options: DAY_LABELS,
      },
      { key: 'time', ask: c('update.ask.time'), kind: 'time', required: true },
      {
        key: 'audience_gender',
        ask: c('update.ask.audience'),
        kind: 'choice',
        taxonomy: 'audienceGender',
        required: true,
      },
      {
        key: 'language', ask: c('update.ask.language'), kind: 'choice', taxonomy: 'languages',
      },
      {
        key: 'lesson_character',
        ask: c('update.ask.character'),
        kind: 'choice',
        taxonomy: 'lessonCharacter',
      },
      { key: 'contact_name', ask: c('update.ask.contact'), kind: 'text' },
      {
        key: 'contact_phone', ask: c('update.ask.phone'), kind: 'digits', min: 9, max: 10,
      },
    ],
  };
}

/** היום שנבחר, עם מספר היום בשבוע שלו */
export function daySlotOf(label: string) {
  return (DAY_SLOTS as { label: string; weekday: number }[])
    .find((d) => d.label === label) || null;
}

/**
 * הצטרפות למערך מגידי השיעורים, שלוחה 3.
 *
 * הסדר והאפשרויות הם של טופס 4018 בנדרים פלוס. שדות שאין להם משמעות
 * בטלפון — מייל, תעודת זהות, פרטי ממליצים, אמצעי תשלום — אינם כאן:
 * הם נשאלים בטופס, שם אפשר להקליד, ובטלפון הם רק דרך לאבד מתקשר
 * באמצע. ארבעה שדות בלבד הם חובה, וכל השאר מדולגים בסולמית.
 */
export function maggidPlan(c: Copy, prefix = 'mg'): FormPlan {
  return {
    prefix,
    fields: [
      { key: 'full_name', ask: c('maggid.ask.name'), kind: 'text', required: true },
      {
        key: 'city', ask: c('maggid.ask.city'), kind: 'text', match: 'cities', required: true,
      },
      { key: 'occupation', ask: c('maggid.ask.occupation'), kind: 'choice', taxonomy: 'occupation' },
      { key: 'background', ask: c('maggid.ask.background'), kind: 'choice', taxonomy: 'rabbiBackground' },
      {
        key: 'topics', ask: c('maggid.ask.topics'), kind: 'multi', taxonomy: 'topics', required: true,
      },
      {
        key: 'audienceGender',
        ask: c('maggid.ask.audience'),
        kind: 'choice',
        taxonomy: 'audienceGender',
        required: true,
      },
      { key: 'audienceStyles', ask: c('maggid.ask.styles'), kind: 'multi', taxonomy: 'audienceStyles' },
      { key: 'language', ask: c('maggid.ask.language'), kind: 'choice', taxonomy: 'languages' },
      { key: 'lessonCharacter', ask: c('maggid.ask.character'), kind: 'multi', taxonomy: 'lessonCharacter' },
      { key: 'speechStyle', ask: c('maggid.ask.speech'), kind: 'choice', taxonomy: 'speechStyle' },
      { key: 'training', ask: c('maggid.ask.training'), kind: 'choice', taxonomy: 'trainingYesNo' },
      { key: 'days', ask: c('maggid.ask.days'), kind: 'multi', options: DAY_LABELS },
      { key: 'hours', ask: c('maggid.ask.hours'), kind: 'multi', taxonomy: 'timeSlots' },
      { key: 'travelRange', ask: c('maggid.ask.range'), kind: 'choice', taxonomy: 'travelRange' },
      { key: 'travel', ask: c('maggid.ask.travel'), kind: 'choice', taxonomy: 'travel' },
      { key: 'payExpectation', ask: c('maggid.ask.pay'), kind: 'choice', taxonomy: 'rabbiPayExpectation' },
      {
        key: 'phone', ask: c('maggid.ask.phone'), kind: 'digits', min: 9, max: 10,
      },
    ],
  };
}

/**
 * בקשה להקמת שיעור, שלוחה 4.
 *
 * לפי טופס 4063, ובאותו היגיון: מה שמאפשר לנו למצוא מגיד שיעור מתאים
 * נשאל, ומה ששייך לגבייה ולטפסים נשאר בטופס. בשונה משלוחה 3, כאן אין
 * שלב זיהוי — מי שמבקש שיעור אינו בהכרח מוכר לנו, ואין סיבה לומר לו
 * שהוא כן.
 */
export function hostPlan(c: Copy, prefix = 'hs'): FormPlan {
  return {
    prefix,
    fields: [
      {
        key: 'requesterType',
        ask: c('host.ask.for'),
        kind: 'choice',
        taxonomy: 'requesterType',
        required: true,
      },
      { key: 'contact_name', ask: c('host.ask.name'), kind: 'text', required: true },
      {
        key: 'city', ask: c('host.ask.city'), kind: 'text', match: 'cities', required: true,
      },
      { key: 'venue_name', ask: c('host.ask.venue'), kind: 'text' },
      { key: 'nusach', ask: c('host.ask.nusach'), kind: 'choice', taxonomy: 'synagogueNusach' },
      { key: 'activity', ask: c('host.ask.activity'), kind: 'choice', taxonomy: 'synagogueActivity' },
      { key: 'familyStyle', ask: c('host.ask.family'), kind: 'choice', taxonomy: 'familyStyle' },
      {
        key: 'audienceGender',
        ask: c('host.ask.audience'),
        kind: 'choice',
        taxonomy: 'audienceGender',
        required: true,
      },
      { key: 'language', ask: c('host.ask.language'), kind: 'choice', taxonomy: 'languages' },
      { key: 'audienceStyles', ask: c('host.ask.styles'), kind: 'multi', taxonomy: 'audienceStyles' },
      {
        key: 'topics', ask: c('host.ask.topics'), kind: 'multi', taxonomy: 'topics', required: true,
      },
      { key: 'background', ask: c('host.ask.background'), kind: 'choice', taxonomy: 'rabbiBackground' },
      { key: 'lessonCharacter', ask: c('host.ask.character'), kind: 'multi', taxonomy: 'lessonCharacter' },
      { key: 'speechStyle', ask: c('host.ask.speech'), kind: 'choice', taxonomy: 'speechStyle' },
      { key: 'frequency', ask: c('host.ask.frequency'), kind: 'choice', taxonomy: 'frequency' },
      { key: 'days', ask: c('host.ask.days'), kind: 'multi', options: DAY_LABELS },
      { key: 'hours', ask: c('host.ask.hours'), kind: 'multi', taxonomy: 'timeSlots' },
      { key: 'payerOffer', ask: c('host.ask.pay'), kind: 'choice', taxonomy: 'payerOffer' },
      {
        key: 'phone', ask: c('host.ask.phone'), kind: 'digits', min: 9, max: 10,
      },
    ],
  };
}

/**
 * עריכת שדה בודד בשיעור קיים, שלוחה 2 סעיף 4.4.
 *
 * כל ערך כאן הוא שאלון בן שדה אחד, ולכן הוא רץ באותו מנוע: אותו שיקוף,
 * אותו אישור, ואותה חזרה בכוכבית. יום ושעה אינם ברשימה כי יש להם כבר
 * מסלול משלהם שכותב לטבלת המועדים ולא לשיעור.
 */
export const EDIT_FIELDS: Record<string, { field: string; copy: string }> = {
  1: { field: 'teacher_name', copy: 'update.edit.ask.teacher' },
  2: { field: 'topic', copy: 'update.edit.ask.topic' },
  3: { field: 'city', copy: 'update.edit.ask.city' },
  4: { field: 'venue_name', copy: 'update.edit.ask.venue' },
  6: { field: 'audience_gender', copy: 'update.edit.ask.audience' },
  7: { field: 'contact_phone', copy: 'update.edit.ask.contact' },
};

/** שאלון בן שדה אחד, לעריכה */
export function editPlan(c: Copy, choice: string, prefix: string): FormPlan | null {
  const spec = EDIT_FIELDS[choice];
  if (!spec) return null;

  const base: Record<string, FormField> = {
    teacher_name: { key: 'value', ask: c(spec.copy), kind: 'text', required: true },
    topic: {
      key: 'value', ask: c(spec.copy), kind: 'choice', taxonomy: 'topics', required: true,
    },
    city: {
      key: 'value', ask: c(spec.copy), kind: 'text', match: 'cities', required: true,
    },
    venue_name: { key: 'value', ask: c(spec.copy), kind: 'text', required: true },
    audience_gender: {
      key: 'value', ask: c(spec.copy), kind: 'choice', taxonomy: 'audienceGender', required: true,
    },
    contact_phone: {
      key: 'value', ask: c(spec.copy), kind: 'digits', min: 9, max: 10, required: true,
    },
  };

  return { prefix, fields: [base[spec.field]] };
}
