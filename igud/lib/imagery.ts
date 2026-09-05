/**
 * שכבת התמונות של האתר.
 *
 * באתר יש שני סוגי תמונה, ולכל אחד כאן שם משלו. "תפאורה" היא רקע
 * שנפרס לרוחב אזור שלם ויושב מאחורי טקסט. "חלון" הוא מלבן ממוסגר
 * בגודל קבוע, שיושב בתוך רשת לצד חלונות אחרים באותו גודל בדיוק.
 *
 * שני הסוגים עובדים באותו אופן: אם הוגדרה כאן תמונה למשבצת, היא
 * מוצגת; ואם לא, מוצג במקומה מילוי מעוצב שנושא את שם המשבצת. כך
 * העמוד שלם גם לפני שהגיעה תמונה אחת, וברגע שיגיעו התמונות משתנה
 * הקובץ הזה בלבד ולא אף עמוד.
 *
 * אין כאן כתובת שלא נבדקה. כתובת של תמונה שאינה קיימת אינה שגיאה
 * שנראית בבנייה, אלא ריבוע ריק אצל המבקר.
 */

/** רקע רחב מאחורי טקסט */
export type SceneKey = 'hero' | 'cta' | 'join' | 'centers' | 'rabbis' | 'search';

/** מלבן ממוסגר בתוך רשת */
export type WindowKey =
  | 'beitMidrash'
  | 'shiur'
  | 'aronKodesh'
  | 'sfarim'
  | 'kehila'
  | 'kotel';

export type SlotKey = SceneKey | WindowKey;

export interface Photo {
  /** קובץ מקומי תחת public, או כתובת מלאה שהמארח שלה מופיע ב-next.config */
  src: string;
  /** תיאור לקורא מסך. רקע עיטורי בלבד — להשאיר ריק */
  alt: string;
  /** צלם ומקור, לתיעוד */
  credit?: string;
  /** מוקד החיתוך כשהנושא אינו במרכז, למשל '50% 30%' */
  focus?: string;
}

/**
 * המשבצות המלאות. ריק פירושו: הצג את המילוי המעוצב.
 *
 * דוגמה למילוי:
 *   beitMidrash: { src: '/photos/beit-midrash.webp', alt: '', focus: '50% 40%' },
 */
export const PHOTOS: Partial<Record<SlotKey, Photo>> = {};

export function photoOf(name: SlotKey): Photo | null {
  return PHOTOS[name] ?? null;
}

/**
 * שמות החלונות בעברית.
 *
 * השם אינו לקישוט: הוא מופיע על המילוי הריק, וכך מי שמסתכל על האתר
 * יודע בדיוק איזו תמונה חסרה ואיזה שם לתת לקובץ שישלח.
 */
export const WINDOWS: Record<WindowKey, { title: string; note: string }> = {
  beitMidrash: { title: 'בית מדרש', note: 'ספסלים, שטנדרים, ארון ספרים' },
  shiur: { title: 'מסירת שיעור', note: 'רב מוסר שיעור לפני ציבור' },
  aronKodesh: { title: 'ארון קודש', note: 'פרוכת ועמודים' },
  sfarim: { title: 'ארון ספרים', note: 'כרכים על מדף, מקרוב' },
  kehila: { title: 'ציבור לומדים', note: 'שולחנות חברותא' },
  kotel: { title: 'מקום מרכזי', note: 'מוקד תורני מוכר' },
};
