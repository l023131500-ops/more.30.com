import Link from 'next/link';
import type { Metadata } from 'next';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchTaxonomy } from '@/lib/queries';
import AddLessonForm from '@/components/AddLessonForm';
import { SITE } from '@/lib/site';
import { IconArrowLeft, IconPhone, IconSparkle } from '@/components/Icons';
import taxonomyFallback from '@/data/taxonomy.json';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'הוספת שיעור למאגר',
  description: 'פרסום שיעור תורה חדש במאגר איגוד השיעורים. מילוי טופס קצר, והשיעור מתפרסם לאחר אישור.',
};

export default async function AddPage() {
  let taxonomy = taxonomyFallback as unknown as Record<string, string[]>;
  if (supabaseConfigured) {
    const fetched = await fetchTaxonomy(publicClient()).catch(() => null);
    if (fetched && Object.keys(fetched).length) taxonomy = fetched;
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה למאגר
      </Link>

      <header className="mb-8">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconSparkle className="h-3.5 w-3.5" />
          מעוניינים להפיץ תורה?
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          הוספת שיעור למאגר
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          שישה שלבים קצרים, ואלפי לומדים ימצאו את השיעור שלכם. כל שיעור עובר אישור
          לפני שהוא מתפרסם. אפשר גם לעדכן במערכת הקולית{' '}
          <a href={`tel:${SITE.voiceLine}`} className="font-bold text-wine-600">{SITE.voiceLine}</a>
          {' '}או בעמדות נדרים פלוס.
        </p>
      </header>

      <AddLessonForm taxonomy={taxonomy} />

      <aside className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-parch-300 bg-white/60 px-5 py-4">
        <IconPhone className="h-5 w-5 text-gold-600" />
        <p className="text-[0.85rem] text-ink-700">
          זקוקים לעזרה במילוי? מתקשרים למערכת הקולית{' '}
          <a href={`tel:${SITE.voiceLine}`} className="font-bold text-wine-600">{SITE.voiceLine}</a>
          {' '}או שולחים דוא"ל אל{' '}
          <a href={`mailto:${SITE.email}`} className="font-bold text-wine-600">{SITE.email}</a>
        </p>
      </aside>
    </div>
  );
}
