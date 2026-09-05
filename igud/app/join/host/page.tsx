import Link from 'next/link';
import type { Metadata } from 'next';
import { loadTaxonomy } from '@/lib/load-taxonomy';
import JoinHostForm from '@/components/JoinHostForm';
import { IconArrowLeft, IconBuilding } from '@/components/Icons';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'מעוניינים לפתוח שיעור תורה',
  description: 'בית כנסת או קבוצת לומדים שמחפשים מגיד שיעור. מילוי טופס והתאמה על ידי צוות האיגוד.',
};

export default async function JoinHostPage() {
  const taxonomy = await loadTaxonomy();
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <Link
        href="/join"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-royal-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה לבחירת הטופס
      </Link>

      <header className="mb-8">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconBuilding className="h-3.5 w-3.5" />
          בקשה למגיד שיעור
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-royal-700 sm:text-4xl">
          מעוניינים לפתוח שיעור תורה
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          ארבעה שלבים קצרים. ככל שתפרטו יותר על הקהל ועל הסגנון, כך ההתאמה תהיה מדויקת יותר.
        </p>
      </header>

      <JoinHostForm taxonomy={taxonomy} />
    </div>
  );
}
