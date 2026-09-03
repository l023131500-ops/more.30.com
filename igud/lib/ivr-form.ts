import type { SupabaseClient } from '@supabase/supabase-js';
import { read, respond, say } from './yemot';
import { pageState } from './ivr-flows';
import { matchOne } from './ivr-lesson';
import type { Copy } from './ivr-copy';

/**
 * שאלון בטלפון.
 *
 * שלוש שלוחות ממלאות טפסים — הוספת שיעור, הצטרפות למגידי השיעורים,
 * ובקשה להקמת שיעור — ולשלושתן אותו מהלך: שאלה, תשובה, שיקוף, אישור,
 * והלאה. במקום שלוש מכונות מצבים שכל אחת תשבר במקום אחר, יש כאן אחת,
 * והשלוחות מגדירות רק את רשימת השדות.
 *
 * ארבעה סוגי שדות, וכל אחד נשמע אחרת:
 *
 *   text    המתקשר מדבר, שומע מה נקלט, ומאשר. אין מסלול בלי שיקוף
 *   choice  רשימה ממוספרת בעמודים של שמונה, בדיוק כמו בטופס
 *   digits  הקשה, עם השמעה חוזרת של מה שהוקש
 *   time    ארבע ספרות, ונאמרות חזרה כשעה ולא כמספר
 *
 * ניווט אחיד: כוכבית חוזרת לשאלה הקודמת, אפס ממשיך רשימה ארוכה,
 * תשע משמיע שוב, וסולמית מדלגת על שדה שאינו חובה.
 *
 * ---
 *
 * על שמות המשתנים, וזה העיקר כאן. ימות מחזירה בכל פנייה את כל
 * המשתנים שכבר נקראו ואי אפשר למחוק אותם, ולכן "חזרה לשאלה הקודמת"
 * אינה יכולה למחוק תשובה — היא חייבת לכתוב תשובה חדשה בשם חדש.
 *
 * הפתרון הוא שכל שדה יושב במרחב שם שנגזר ממספר התשובות שנרשמו בשדה
 * שלפניו:
 *
 *   f0_0_0   שדה 0, מרחב 0, ניסיון 0
 *   f1_1_0   שדה 1, במרחב שנקבע לפי כמה תשובות היו בשדה 0
 *
 * כשחוזרים אחורה ועונים מחדש על שדה 0, מספר התשובות בו גדל, ולכן
 * מרחב השם של שדה 1 משתנה והוא נשאל שוב. השרשרת מתגלגלת קדימה מעצמה:
 * שינוי בשאלה שנייה מבטל את כל מה שנענה אחריה, וזה בדיוק מה שצריך
 * לקרות. בלי זה, "חזרה" הייתה מחזירה את המתקשר לשאלה — ואז קופצת
 * מעליה עם התשובה הישנה.
 */

export const PAGE = 8;

export type FieldKind = 'text' | 'choice' | 'multi' | 'digits' | 'time';

export interface FormField {
  /** המפתח שתחתיו התשובה נשמרת */
  key: string;
  /** השאלה שנשמעת */
  ask: string;
  kind: FieldKind;
  /** שדה חובה אינו ניתן לדילוג */
  required?: boolean;
  /** סוג בטבלת הטקסונומיה, לשדות בחירה */
  taxonomy?: string;
  /** רשימה קבועה, כשאין טקסונומיה */
  options?: string[];
  /**
   * התאמת מה שנאמר לרשימת ערכים קיימת.
   *
   * לערים יש ארבעים ותשעה ערכים. רשימה ממוספרת כזו היא שבעה עמודים,
   * ואיש אינו מקשיב לשבעה עמודים. לכן העיר נאמרת בקול ומותאמת
   * לרשימה, ומה שלא הותאם נשמר כפי שנאמר.
   */
  match?: string;
  /** ספרות: המספר המזערי והמרבי */
  min?: number;
  max?: number;
  /** הסבר קצר שנשמע לפני השאלה, פעם אחת */
  note?: string;
}

export interface FormPlan {
  /** תחילית המשתנים, כדי ששתי שלוחות בשיחה אחת לא יתנגשו */
  prefix: string;
  fields: FormField[];
}

/* ============================================================
   הערכים מהטקסונומיה
   ============================================================ */

/**
 * רשימות הבחירה, בדיוק כפי שהן בטופס בנדרים פלוס.
 *
 * נשלפות פעם אחת לשיחה ולא פעם אחת לשדה: מתקשר שממלא שאלון בן שנים
 * עשר שדות אינו צריך שנים עשר סבבי שאילתות.
 */
export async function loadOptions(
  client: SupabaseClient, plan: FormPlan,
): Promise<Record<string, string[]>> {
  const kinds = [...new Set(plan.fields
    .flatMap((f) => [f.taxonomy, f.match])
    .filter(Boolean) as string[])];
  if (!kinds.length) return {};

  const { data } = await client
    .from('igud_taxonomy')
    .select('kind, value, sort')
    .eq('active', true)
    .in('kind', kinds)
    .order('sort');

  const out: Record<string, string[]> = {};
  for (const row of (data || []) as { kind: string; value: string }[]) {
    (out[row.kind] ||= []).push(row.value);
  }
  return out;
}

/** האפשרויות של שדה, מהטקסונומיה או מהרשימה הקבועה */
function optionsOf(field: FormField, taxonomy: Record<string, string[]>): string[] {
  return field.options || taxonomy[field.taxonomy || ''] || [];
}

/* ============================================================
   התוצאה של צעד אחד בשאלון
   ============================================================ */

export type FormStep =
  /** יש לשאול, וזו התשובה שצריך להחזיר לימות */
  | { done: false; response: Response }
  /** השאלון הושלם, ואלה התשובות */
  | { done: true; answers: Record<string, string | string[]> };

interface StepOptions {
  /** מה קורה כשמקישים כוכבית בשאלה הראשונה */
  onExit: () => Response;
  /**
   * פתיחה שנשמעת פעם אחת בלבד, לפני השאלה הראשונה.
   *
   * "נשאל כמה שאלות קצרות" נכון לומר בתחילת השאלון. לומר את זה שוב
   * לפני כל שאלה, או בכל פעם שחוזרים אחורה, זה בדיוק מה שגורם לאדם
   * להפסיק להקשיב.
   */
  intro?: string[];
  /** נאמר לפני הסיכום */
  summaryHead?: string;
}

/** שעה ארבע ספרות אל שעה שאפשר לשמוע */
export function timeFromDigits(raw: string): string | null {
  const clean = String(raw || '').replace(/\D/g, '');
  if (clean.length !== 4) return null;
  const h = Number(clean.slice(0, 2));
  const m = Number(clean.slice(2, 4));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * צעד אחד בשאלון.
 *
 * מחזירה או תשובה לימות — השאלה הבאה, שיקוף, או סיכום — או את כל
 * התשובות כשהשאלון הושלם ואושר. השלוחה הקוראת אחראית רק על מה לעשות
 * עם התשובות.
 */
export function formStep(
  params: Record<string, string>,
  plan: FormPlan,
  taxonomy: Record<string, string[]>,
  c: Copy,
  opts: StepOptions,
): FormStep {
  const { prefix, fields } = plan;
  const answers: Record<string, string | string[]> = {};

  /** מרחב השם של שדה i, לפי מספר התשובות בשדה שלפניו */
  const space: number[] = [0];

  /** האם זו הפעם הראשונה בשאלון, ולא חזרה אליו */
  const fresh = pageState(params, `${prefix}f0_0_`).last === null;

  const askField = (i: number, varName: string, ...before: string[]): FormStep => {
    const field = fields[i];
    const opening = i === 0 && fresh ? (opts.intro || []) : [];
    const lead = [...opening, ...before, field.note || '', field.ask].filter(Boolean);

    if (field.kind === 'text') {
      return {
        done: false,
        response: respond(
          say(...lead),
          read(field.required ? c('form.speakNow') : c('form.speakSkip'), varName,
            { mode: 'voice', silence: 3, seconds: 20 }),
        ),
      };
    }

    /*
     * המינימום הוא ספרה אחת, גם כששואלים שעה או טלפון.
     *
     * זה נראה כמו ויתור על בדיקה והוא ההפך. מינימום ארבע ספרות אינו
     * מקבל הקשה בודדת, וכוכבית היא הקשה בודדת — כך שהמתקשר שמעדנו לו
     * "לחזרה הקישו כוכבית" היה מגלה שהמערכת פשוט ממשיכה לחכות. האורך
     * נבדק כאן בקוד, ששם אפשר גם לומר מה לא היה תקין.
     */
    if (field.kind === 'time') {
      return {
        done: false,
        response: respond(
          say(...lead),
          read(c('form.timeHow'), varName, { min: 1, max: 4, echo: 'Time', confirm: true }),
        ),
      };
    }

    if (field.kind === 'digits') {
      return {
        done: false,
        response: respond(
          say(...lead),
          read(c('form.digitsHow'), varName, {
            min: 1,
            max: field.max || 12,
            echo: 'Digits',
            confirm: true,
            allowEmpty: !field.required,
          }),
        ),
      };
    }

    // בחירה מרשימה
    const list = optionsOf(field, taxonomy);
    const st = pageState(params, `${prefix}f${i}_${space[i]}_`);
    const page = list.length > PAGE * st.page ? st.page : 0;
    const slice = list.slice(page * PAGE, page * PAGE + PAGE);

    const lines = slice.map((value, n) => c('form.option', { n: n + 1, value }));
    if (list.length > (page + 1) * PAGE) lines.push(c('search.listMore'));
    lines.push(c('search.listRepeat'));
    if (field.kind === 'multi') lines.push(c('form.multiDone'));
    else if (!field.required) lines.push(c('form.skip'));
    lines.push(c('nav.hint'));

    return {
      done: false,
      response: respond(
        say(...lead),
        read(lines.join('. '), varName, { min: 1, max: 1, allowEmpty: true }),
      ),
    };
  };

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const k = space[i];
    const st = pageState(params, `${prefix}f${i}_${k}_`);

    /* ---------- עדיין לא נשאל ---------- */
    if (st.last === null) return askField(i, st.next);

    /* ---------- חזרה לשאלה הקודמת ---------- */
    if (st.last === '*') {
      if (i === 0) return { done: false, response: opts.onExit() };
      const prev = pageState(params, `${prefix}f${i - 1}_${space[i - 1]}_`);
      return askField(i - 1, prev.next, c('nav.back'));
    }

    /* ---------- שדות בחירה ---------- */
    if (field.kind === 'choice' || field.kind === 'multi') {
      const list = optionsOf(field, taxonomy);

      // כל ההקשות בשדה הזה, כדי לאסוף בחירה מרובה ולזהות עמוד
      const chosen: string[] = [];
      let page = 0;
      for (let n = 0; n < st.n; n += 1) {
        const value = String(params[`${prefix}f${i}_${k}_${n}`] ?? '').trim();
        if (value === '0') {
          page += 1;
          // בסוף הרשימה חוזרים לתחילתה, בדיוק כמו במסך עצמו
          if (page * PAGE >= list.length) page = 0;
          continue;
        }
        if (value === '9' || value === '') continue;
        const picked = list[page * PAGE + Number(value) - 1];
        if (picked && !chosen.includes(picked)) chosen.push(picked);
      }

      if (field.kind === 'multi') {
        // סולמית מסיימת את הבחירה. בלי בחירה אחת לפחות בשדה חובה
        if (st.last === '') {
          if (chosen.length) { answers[field.key] = chosen; space[i + 1] = st.n; continue; }
          if (!field.required) { space[i + 1] = st.n; continue; }
          return askField(i, st.next, c('form.needOne'));
        }
        if (st.last === '0' || st.last === '9') return askField(i, st.next);

        /*
         * אחרי בחירה אומרים מה נבחר, ולא מקריאים את הרשימה שוב.
         *
         * זה היה הכשל הגלוי ביותר בשיחה אמיתית: המתקשר בחר נושא, שמע
         * את אותה שאלה מההתחלה, הניח שההקשה לא נקלטה, בחר שוב — ולא
         * התקדם לעולם. עכשיו הוא שומע "נבחר גמרא" ואת שתי האפשרויות
         * שנותרו, וזה כל ההבדל בין מנגנון שעובד למנגנון שנראה תקוע.
         */
        const picked = chosen[chosen.length - 1];
        if (!picked) return askField(i, st.next, c('nav.notFound'));
        return {
          done: false,
          response: respond(
            say(c('form.multiPicked', { value: picked })),
            read(c('form.multiSoFar'), st.next, { min: 1, max: 1, allowEmpty: true }),
          ),
        };
      }

      if (st.last === '0' || st.last === '9') return askField(i, st.next);
      if (st.last === '') {
        if (field.required) return askField(i, st.next, c('form.needAnswer'));
        space[i + 1] = st.n;
        continue;
      }
      if (!chosen.length) return askField(i, st.next, c('nav.notFound'));

      answers[field.key] = chosen[chosen.length - 1];
      space[i + 1] = st.n;
      continue;
    }

    /* ---------- שעה וספרות ---------- */
    if (field.kind === 'time' || field.kind === 'digits') {
      if (st.last === '') {
        if (field.required) return askField(i, st.next, c('form.needAnswer'));
        space[i + 1] = st.n;
        continue;
      }
      if (field.kind === 'time') {
        const time = timeFromDigits(st.last);
        if (!time) return askField(i, st.next, c('form.timeBad'));
        answers[field.key] = time;
      } else {
        const clean = String(st.last).replace(/\D/g, '');
        if (field.min && clean.length < field.min) {
          return askField(i, st.next, c('form.digitsShort'));
        }
        answers[field.key] = clean;
      }
      space[i + 1] = st.n;
      continue;
    }

    /* ---------- טקסט: שיקוף ואישור ---------- */
    const spoken = String(st.last).trim();
    if (!spoken) {
      if (field.required) return askField(i, st.next, c('search.notHeard'));
      space[i + 1] = st.n;
      continue;
    }

    // מרחב האישור כולל את מספר הניסיון, כדי שהקלטה מחדש תשאל מחדש
    const cf = pageState(params, `${prefix}c${i}_${k}_${st.n}_`);
    const confirmScreen = (...before: string[]): FormStep => ({
      done: false,
      response: respond(
        say(...before, c('search.heard', { text: spoken })),
        read(c('search.confirm'), cf.next, { min: 1, max: 1 }),
      ),
    });

    if (cf.last === null || cf.last === '3') return confirmScreen();
    if (cf.last === '2') return askField(i, st.next);
    if (cf.last === '4' || cf.last === '*') {
      if (i === 0) return { done: false, response: opts.onExit() };
      const prev = pageState(params, `${prefix}f${i - 1}_${space[i - 1]}_`);
      return askField(i - 1, prev.next, c('nav.back'));
    }
    if (cf.last !== '1') return confirmScreen(c('nav.notFound'));

    // התאמה לרשימה קיימת, כשיש כזו
    const known = field.match ? matchOne(taxonomy[field.match] || [], spoken) : null;
    answers[field.key] = known || spoken;
    space[i + 1] = st.n;
  }

  /* ============================================================
     סיכום ואישור לפני השליחה
     ============================================================ */

  const last = space[fields.length];
  const fin = pageState(params, `${prefix}ok_${last}_`);

  const summary = fields
    .map((field) => {
      const value = answers[field.key];
      if (!value) return '';
      const text = Array.isArray(value) ? value.join(', ') : value;
      return c('form.summaryLine', { label: field.ask, value: text });
    })
    .filter(Boolean);

  const summaryScreen = (...before: string[]): FormStep => ({
    done: false,
    response: respond(
      say(...before, opts.summaryHead || c('form.summaryHead')),
      say(...summary),
      read(c('form.summaryMenu'), fin.next, { min: 1, max: 1 }),
    ),
  });

  if (fin.last === null || fin.last === '9') return summaryScreen();

  if (fin.last === '2' || fin.last === '*') {
    const prev = pageState(params, `${prefix}f${fields.length - 1}_${space[fields.length - 1]}_`);
    return askField(fields.length - 1, prev.next, c('nav.back'));
  }

  if (fin.last !== '1') return summaryScreen(c('nav.notFound'));

  return { done: true, answers };
}
