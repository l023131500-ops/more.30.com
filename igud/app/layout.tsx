import type { Metadata, Viewport } from 'next';
import { Frank_Ruhl_Libre, Assistant } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import FloatingCta from '@/components/FloatingCta';
import { SITE } from '@/lib/site';

const display = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-frank',
  display: 'swap',
});

/*
 * אסיסטנט במקום אלף.
 *
 * אלף הוא פונט תקין וחסר אופי: משקל אחד וחצי, צורות אחידות, ובגדלים
 * קטנים הוא נראה כמו טקסט של טופס. אסיסטנט תוכנן לעברית עם שישה
 * משקלים, ולכן אפשר סוף סוף להבדיל בין כותרת משנה, טקסט רגיל והערה
 * — וזה מה שעושה עמוד שנראה ערוך ולא מוקלד.
 */
const body = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'איגוד השיעורים · מאגר שיעורי התורה של ארץ ישראל',
    template: '%s · איגוד השיעורים',
  },
  description:
    'מאגר ארצי של זמני שיעורי תורה. חיפוש לפי רב, נושא, עיר ובית כנסת, פרסום שיעור חדש והתאמה בין מגידי שיעור למקומות שמחפשים.',
  keywords: [
    'שיעורי תורה', 'זמני שיעורים', 'מגיד שיעור', 'דף יומי',
    'בית כנסת', 'שיעור גמרא', 'הלכה', 'איגוד השיעורים',
  ],
  openGraph: {
    title: 'איגוד השיעורים',
    description: 'מחברים בין לומדים ומלמדים. מאגר ארצי של זמני שיעורי תורה.',
    url: SITE.url,
    siteName: 'איגוד השיעורים',
    locale: 'he_IL',
    type: 'website',
    images: [{ url: '/brand/logo-640.webp', width: 640, height: 705, alt: 'איגוד השיעורים' }],
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/mark-256.webp', sizes: '256x256', type: 'image/webp' },
    ],
    apple: '/brand/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#17353D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[100]
                     focus:rounded-lg focus:bg-royal-700 focus:px-4 focus:py-2 focus:text-gold-100"
        >
          דילוג לתוכן
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
        <FloatingCta />
      </body>
    </html>
  );
}
