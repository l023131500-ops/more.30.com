import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'פרטיות ותנאי שימוש',
  description: 'איזה מידע נאסף באיגוד השיעורים, מה מתפרסם ומה נשמר פנימי.',
};

const SECTIONS = [
  {
    title: 'איזה מידע מתפרסם באתר',
    body: [
      'שיעור שמאושר לפרסום מוצג עם שם מגיד השיעור, נושא השיעור, שם המקום והכתובת, ' +
      'ימי השיעור והשעות, שפת השיעור וסגנונו, וסימון אם הוא מוקלט או משודר.',
      'טלפון ליצירת קשר מוצג רק אם נמסר לצורך פרסום. כתובת דוא"ל אינה מוצגת באתר לעולם, ' +
      'ומשמשת את צוות האיגוד לעדכונים בלבד.',
    ],
  },
  {
    title: 'טפסי ההצטרפות',
    body: [
      'הפרטים בטופס פתיחת שיעור ובטופס רישום מגיד שיעור אינם מתפרסמים. ' +
      'הם נשמרים במאגר סגור, ומשמשים את צוות האיגוד לצורך ההתאמה בלבד.',
      'ממליצים שנמסרו בטופס מגיד שיעור נשמרים לצורך בירור, ואינם מוצגים לציבור.',
    ],
  },
  {
    title: 'אישור לפני פרסום',
    body: [
      'כל שיעור שנשלח מהאתר, מהמערכת הקולית או מעמדות נדרים פלוס נכנס לתור אישור. ' +
      'הוא מתפרסם רק לאחר בדיקה של צוות האיגוד, ואפשר להסיר אותו בכל עת.',
    ],
  },
  {
    title: 'עדכון והסרה',
    body: [
      `לעדכון פרטים או להסרת שיעור מהמאגר אפשר לפנות במערכת הקולית ${SITE.voiceLine} ` +
      `או בדוא"ל ${SITE.email}. פנייה כזו מטופלת בהקדם.`,
      'מגיד שיעור או מרכז תורני שקיבלו חשבון לאזור האישי יכולים לעדכן ולהסתיר את ' +
      'השיעורים שלהם בעצמם, בכל עת.',
    ],
  },
  {
    title: 'אחריות על התוכן',
    body: [
      'זמני השיעורים נמסרים על ידי מגידי השיעור והמקומות עצמם. האיגוד עושה כמיטב יכולתו ' +
      'לוודא שהמידע נכון, אך מומלץ לוודא מול המקום לפני הגעה, בעיקר בערבי חג ובימים מיוחדים.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-wine-700">פרטיות ותנאי שימוש</h1>
      <p className="mt-2 text-sm text-ink-500">איגוד השיעורים, מאגר זמני שיעורי התורה</p>
      <div className="rule-gold mt-6" />

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl font-bold text-wine-700">{section.title}</h2>
            <div className="mt-2 space-y-2 text-[0.95rem] leading-relaxed text-ink-700">
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
