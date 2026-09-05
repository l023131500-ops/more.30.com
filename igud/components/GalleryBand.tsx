import Link from 'next/link';
import PhotoWindow from './PhotoWindow';
import Reveal from './Reveal';
import { IconArrowLeft } from './Icons';
import type { WindowKey } from '@/lib/imagery';

/**
 * שלושה שערים אל האתר, כרשת סימטרית.
 *
 * הרצועה הזאת אינה גלריה: היא שלושת המקומות שאדם רוצה להגיע אליהם
 * מיד, בצורת תמונה במקום בצורת קישור. שלושה, ולא ארבעה או חמישה,
 * כי שלושה נכנסים בשורה אחת בכל מסך רחב ובשתי שורות שוות בטאבלט,
 * ולעולם אינם משאירים איבר בודד בשורה אחרונה.
 *
 * כל שלושת החלונות באותו יחס צדדים ובאותה מסגרת, וכל שלוש הכותרות
 * באותו גובה — גם כשהטקסט באחת מהן ארוך יותר. זאת הסימטריה שהעין
 * קוראת כאיכות.
 */

interface Gate {
  href: string;
  window: WindowKey;
  title: string;
  body: string;
}

const GATES: Gate[] = [
  {
    href: '/centers',
    window: 'beitMidrash',
    title: 'מרכזי תורה ובתי כנסת',
    body: 'בתי מדרש, כוללים וקהילות. כניסה למקום מציגה את כל השיעורים שנמסרים בו.',
  },
  {
    href: '/rabbis',
    window: 'shiur',
    title: 'מגידי שיעור',
    body: 'הרבנים שמוסרים שיעורים במאגר, וכל השיעורים של כל אחד מהם במקום אחד.',
  },
  {
    href: '/join',
    window: 'aronKodesh',
    title: 'הצטרפות לאיגוד',
    body: 'מקום שמחפש מגיד שיעור, ומגיד שיעור שמחפש מקום. האיגוד מחבר ביניהם.',
  },
];

export default function GalleryBand() {
  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-4 sm:px-6">
      <h2 className="section-mark font-display text-2xl font-bold text-royal-700">
        שערי האיגוד
      </h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GATES.map((gate, i) => (
          <Reveal key={gate.href} index={i}>
            <Link
              href={gate.href}
              className="card-surface group flex h-full flex-col overflow-hidden rounded-2xl p-4"
            >
              <PhotoWindow name={gate.window} ratio="aspect-[16/10]" />

              <h3 className="mt-4 font-display text-xl font-bold text-royal-700">{gate.title}</h3>
              {/* גובה קבוע לשתי שורות, כדי שכל שלוש הכותרות ייגמרו באותו קו */}
              <p className="mt-2 min-h-[3.4rem] text-[0.92rem] leading-relaxed text-ink-700">
                {gate.body}
              </p>

              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-gold-700">
                כניסה
                <IconArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
