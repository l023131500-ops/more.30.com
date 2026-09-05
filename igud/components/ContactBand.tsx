import { SITE } from '@/lib/site';
import { IconPhone, IconMail, IconBuilding } from './Icons';

/**
 * דרכי הפנייה, בשלוש משבצות שוות.
 *
 * פרטי קשר שמופיעים כשורת טקסט קטנה בתחתית נקראים כהערת שוליים. כאן
 * הם מקבלים את אותו משקל של כל אזור אחר באתר: כותרת, ערך גדול וקריא,
 * ומשפט אחד שמסביר מתי משתמשים בו. מספר הטלפון גדול במיוחד, כי הוא
 * הערוץ הראשי של האיגוד ולא ערוץ משני.
 *
 * כל שלוש המשבצות באותו גובה ובאותה מסגרת, וכל אחת כולה שטח לחיץ.
 */

const NEDARIM_STANDS = 'https://www.matara.pro/nedarimplus/online/?mosad=7017792';

export default function ContactBand() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        <a
          href={`tel:${SITE.voiceLine}`}
          className="group flex h-full flex-col rounded-2xl border border-gold-400/45
                     bg-gradient-to-br from-royal-700 to-royal-800 p-6 text-gold-100
                     transition duration-200 hover:-translate-y-1 hover:border-gold-300"
        >
          <span className="flex items-center gap-2 text-[0.78rem] font-bold text-gold-300">
            <IconPhone className="h-4 w-4" />
            המערכת הקולית
          </span>
          <span className="mt-3 font-display text-3xl font-bold tabular tracking-wide text-parch-50">
            {SITE.voiceLine}
          </span>
          <span className="mt-2 text-[0.86rem] leading-relaxed text-royal-100/85">
            חיפוש שיעור, עדכון זמנים והצטרפות לאיגוד, מכל טלפון ובכל שעה.
          </span>
        </a>

        <a
          href={`mailto:${SITE.email}`}
          className="card-surface group flex h-full flex-col rounded-2xl p-6"
        >
          <span className="flex items-center gap-2 text-[0.78rem] font-bold text-gold-700">
            <IconMail className="h-4 w-4" />
            דואר אלקטרוני
          </span>
          <span className="mt-3 break-all font-display text-lg font-bold text-royal-700">
            {SITE.email.toLowerCase()}
          </span>
          <span className="mt-2 text-[0.86rem] leading-relaxed text-ink-700">
            לפניות שדורשות צירוף מסמך, ולכל דבר שאינו דחוף.
          </span>
        </a>

        <a
          href={NEDARIM_STANDS}
          target="_blank"
          rel="noreferrer"
          className="card-surface group flex h-full flex-col rounded-2xl p-6"
        >
          <span className="flex items-center gap-2 text-[0.78rem] font-bold text-gold-700">
            <IconBuilding className="h-4 w-4" />
            עמדות נדרים פלוס
          </span>
          <span className="mt-3 font-display text-lg font-bold text-royal-700">
            מוסד 7017792
          </span>
          <span className="mt-2 text-[0.86rem] leading-relaxed text-ink-700">
            הוספת שיעור ותרומה לאיגוד מכל עמדה, ובקו הנוסף {SITE.updatesLine}.
          </span>
        </a>
      </div>
    </section>
  );
}
