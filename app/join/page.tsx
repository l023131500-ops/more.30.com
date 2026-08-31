import Link from 'next/link';
import type { Metadata } from 'next';
import { IconArrowLeft, IconBuilding, IconUser } from '@/components/Icons';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'הצטרפות לאיגוד השיעורים',
  description:
    'מקומות שמחפשים מגיד שיעור, ומגידי שיעור שמחפשים מקום למסור בו. האיגוד מחבר ביניהם.',
};

const CARDS = [
  {
    href: '/join/host',
    title: 'מעוניינים לפתוח שיעור תורה',
    body:
      'בית כנסת, כולל, חוג בית או קבוצת לומדים שמחפשים מגיד שיעור. ' +
      'מספרים לנו על הקהל, על הנושא ועל הזמנים המועדפים, ואנחנו מחפשים את ההתאמה.',
    icon: <IconBuilding className="h-7 w-7" />,
    cta: 'למילוי הטופס',
  },
  {
    href: '/join/maggid',
    title: 'הצטרפות כמגיד שיעור',
    body:
      'רוצים למסור שיעור ומחפשים מקום. מספרים לנו על הרקע, על הנושאים שאתם מוסרים ' +
      'ועל הזמינות שלכם, ואנחנו מחפשים מקום שמתאים לכם.',
    icon: <IconUser className="h-7 w-7" />,
    cta: 'למילוי הטופס',
  },
];

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה למאגר
      </Link>

      <header className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          הצטרפות לאיגוד השיעורים
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          האיגוד מחבר בין מקומות שמחפשים מגיד שיעור לבין מגידי שיעור שמחפשים מקום.
          בוחרים את הטופס המתאים, וצוות האיגוד עושה את ההתאמה.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {CARDS.map((card, i) => (
          <Link
            key={card.href}
            href={card.href}
            className="card-surface animate-rise group flex flex-col rounded-2xl p-7 sm:p-9"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-wine-600 to-wine-800 text-gold-200">
              {card.icon}
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-wine-700">{card.title}</h2>
            <p className="mt-3 flex-1 text-[0.92rem] leading-relaxed text-ink-700">{card.body}</p>
            <span className="btn btn-gold mt-6 self-start">
              {card.cta}
              <IconArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-ink-500">
        אפשר גם למלא את הטפסים במערכת הקולית{' '}
        <a href={`tel:${SITE.voiceLine}`} className="font-bold text-wine-600">{SITE.voiceLine}</a>
        {' '}או בעמדות נדרים פלוס.
      </p>
    </div>
  );
}
