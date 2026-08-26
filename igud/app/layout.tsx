import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://more30.com/shiurim';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'איגוד השיעורים — מחברים בין לומדים ומלמדים',
    template: '%s · איגוד השיעורים',
  },
  description:
    'המאגר הארצי של שיעורי התורה: מוצאים שיעור לידכם, מוצאים מגיד שיעור לבית הכנסת, ומעדכנים שיעור קיים.',
  applicationName: 'איגוד השיעורים',
  icons: { icon: '/logo-igud-180.png', apple: '/logo-igud-180.png' },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    siteName: 'איגוד השיעורים',
    images: ['/logo-igud-640.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#5A1E1E',
  width: 'device-width',
  initialScale: 1,
};

const NAV = [
  { href: '/', label: 'שיעורים' },
  { href: '/rabbis', label: 'מגידי שיעור' },
  { href: '/venues', label: 'מקומות' },
  { href: '/centers', label: 'מרכזי תורה' },
  { href: '/join', label: 'הצטרפות' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;600;700&family=Heebo:wght@300;400;500;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-50 focus:card focus:px-4 focus:py-2">
          דילוג לתוכן
        </a>

        <header className="sticky top-0 z-40 border-b border-gold-200/70 bg-parchment-50/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <Image
                src="/logo-igud-180.png"
                alt=""
                width={36}
                height={42}
                priority
                className="h-9 w-auto"
              />
              <span className="hidden text-lg font-semibold text-wine-800 sm:block" style={{ fontFamily: 'var(--font-display)' }}>
                איגוד השיעורים
              </span>
            </Link>

            <nav aria-label="ניווט ראשי" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-gold-50 hover:text-wine-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link href="/lessons/new" className="btn btn-primary shrink-0 max-sm:px-3 max-sm:text-sm">
              הוספת שיעור
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-gold-200/70 bg-wine-900 text-parchment-200">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-sm">
                <p className="text-lg text-gold-200" style={{ fontFamily: 'var(--font-display)' }}>
                  איגוד השיעורים
                </p>
                <p className="mt-1 text-sm text-parchment-300/80">מחברים בין לומדים ומלמדים.</p>
              </div>
              <nav aria-label="ניווט תחתון" className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-10">
                {[...NAV, { href: '/about', label: 'אודות' }, { href: '/api-docs', label: 'ממשק למפתחים' }].map(
                  (item) => (
                    <Link key={item.href} href={item.href} className="text-parchment-300/80 hover:text-gold-200">
                      {item.label}
                    </Link>
                  ),
                )}
              </nav>
            </div>
            <div className="rule-gold my-6 opacity-40" />
            <p className="text-xs text-parchment-300/60">
              המידע נאסף מהציבור ומתעדכן כל העת. מצאתם טעות בשיעור? יש כפתור דיווח בכל עמוד שיעור.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
