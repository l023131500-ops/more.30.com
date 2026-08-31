import Link from 'next/link';
import type { Metadata } from 'next';
import { loadTaxonomy } from '@/lib/load-taxonomy';
import JoinMaggidForm from '@/components/JoinMaggidForm';
import { IconArrowLeft, IconUser } from '@/components/Icons';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'הצטרפות כמגיד שיעור',
  description: 'רישום למאגר מגידי השיעור של האיגוד, ומציאת מקום מתאים למסירת שיעור.',
};

export default async function JoinMaggidPage() {
  const taxonomy = await loadTaxonomy();
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <Link
        href="/join"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה לבחירת הטופס
      </Link>

      <header className="mb-8">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconUser className="h-3.5 w-3.5" />
          רישום מגיד שיעור
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          הצטרפות כמגיד שיעור
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          ארבעה שלבים קצרים. הפרטים נשמרים במאגר האיגוד, וכשיימצא מקום מתאים ניצור קשר.
        </p>
      </header>

      <JoinMaggidForm taxonomy={taxonomy} />
    </div>
  );
}
