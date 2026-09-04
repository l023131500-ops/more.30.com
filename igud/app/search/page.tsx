import type { Metadata } from 'next';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchActiveCities, fetchLessons, fetchTaxonomy } from '@/lib/queries';
import LessonBoard from '@/components/LessonBoard';
import { IconSearch } from '@/components/Icons';
import Scene from '@/components/Scene';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'חיפוש שיעור',
  description: 'חיפוש שיעורי תורה לפי רב, נושא, עיר, בית כנסת, יום, שפה וסגנון.',
};

export default async function SearchPage() {
  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6">
        <p className="text-ink-500">המאגר אינו מחובר כרגע.</p>
      </div>
    );
  }

  const client = publicClient();
  const [board, taxonomy, cities] = await Promise.all([
    fetchLessons(client, {}, 0, 24).catch(() => ({ rows: [], total: 0 })),
    fetchTaxonomy(client).catch(() => ({})),
    fetchActiveCities(client).catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <header className="relative isolate mb-8">
        {/* קשתות דקות מאחורי הכותרת, אותה שפה של הפתיח */}
        <Scene name="search" className="-z-10 opacity-[0.22]" />
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconSearch className="h-3.5 w-3.5" />
          חיפוש חכם
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-royal-700 sm:text-4xl">
          מציאת שיעור תורה
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          אפשר לחפש בשדה החופשי לפי שם הרב, נושא, בית כנסת או עיר,
          ולצמצם עם הסינונים. התוצאות מסודרות לפי המועד הקרוב ביותר.
        </p>
      </header>

      <LessonBoard
        initialRows={board.rows}
        initialTotal={board.total}
        taxonomy={taxonomy}
        cities={cities}
        columns={3}
        heading="תוצאות"
      />
    </div>
  );
}
