import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';
import { IconPhone, IconMail } from './Icons';

const COLUMNS = [
  {
    title: 'המאגר',
    links: [
      { href: '/search', label: 'חיפוש שיעור' },
      { href: '/centers', label: 'מרכזי תורה ובתי כנסת' },
      { href: '/rabbis', label: 'מגידי שיעור' },
      { href: '/add', label: 'הוספת שיעור למאגר' },
    ],
  },
  {
    title: 'הצטרפות',
    links: [
      { href: '/join/host', label: 'מעוניינים לפתוח שיעור תורה' },
      { href: '/join/maggid', label: 'הצטרפות כמגיד שיעור' },
      { href: '/portal', label: 'אזור אישי לרבנים ולמרכזים' },
    ],
  },
  {
    title: 'מידע',
    links: [
      { href: '/about', label: 'אודות האיגוד' },
      { href: '/privacy', label: 'פרטיות ותנאי שימוש' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-20 no-print">
      <div className="rule-gold" />
      <div className="bg-gradient-to-b from-royal-700 to-royal-800 text-gold-100">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/brand/mark-96.webp"
                alt=""
                width={96}
                height={96}
                className="h-14 w-14 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
              />
              <div>
                <div className="font-display text-xl font-bold">{SITE.name}</div>
                <div className="text-xs text-gold-300">{SITE.tagline}</div>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-gold-200/85">
              מאגר ארצי של זמני שיעורי תורה. כל שיעור שמתפרסם עובר אישור, וכל מגיד שיעור
              ומרכז תורני יכולים לעדכן את הזמנים שלהם בעצמם, באתר, בעמדות נדרים פלוס
              או במערכת הקולית.
            </p>

            <div className="mt-6 flex flex-col gap-2 text-sm">
              <a href={`tel:${SITE.voiceLine}`} className="inline-flex items-center gap-2 hover:text-white">
                <IconPhone className="h-4 w-4 text-gold-400" />
                מערכת קולית {SITE.voiceLine}
              </a>
              <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-2 hover:text-white">
                <IconMail className="h-4 w-4 text-gold-400" />
                {SITE.email}
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-base font-bold text-gold-300">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-gold-200/85 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-5 text-xs text-gold-200/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© איגוד השיעורים · כל הזכויות שמורות</span>
            <span className="flex items-center gap-4">
              <Link href="/admin" className="transition hover:text-white">כניסת מנהל</Link>
              <Link href="/portal" className="transition hover:text-white">אזור אישי</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
