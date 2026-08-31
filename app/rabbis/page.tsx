import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import type { Teacher } from '@/lib/types';
import { rabbiName } from '@/lib/format';
import { FALLBACK_LOGO } from '@/lib/site';
import { IconPin, IconUser } from '@/components/Icons';
import { TEACHER_PUBLIC_COLUMNS } from '@/lib/queries';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'מגידי שיעור',
  description: 'רבנים ומגידי שיעור שמפרסמים את זמני שיעוריהם במאגר איגוד השיעורים.',
};

export default async function RabbisPage() {
  if (!supabaseConfigured) {
    return <div className="py-16 text-center text-ink-500">המאגר אינו מחובר כרגע.</div>;
  }

  const client = publicClient();
  const [{ data: teachers }, { data: lessons }] = await Promise.all([
    client.from('igud_teachers').select(TEACHER_PUBLIC_COLUMNS).eq('status', 'published').order('full_name').limit(500)
      .then((r) => r, () => ({ data: [] as Teacher[] })),
    client.from('igud_lesson_cards').select('teacher_id').limit(4000)
      .then((r) => r, () => ({ data: [] as { teacher_id: string | null }[] })),
  ]);

  const counts = new Map<string, number>();
  for (const row of lessons || []) {
    const key = row.teacher_id as string | null;
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const list = ((teachers || []) as unknown as Teacher[])
    .map((teacher) => ({ teacher, count: counts.get(teacher.id) || 0 }))
    .sort((a, b) => b.count - a.count || a.teacher.full_name.localeCompare(b.teacher.full_name, 'he'));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconUser className="h-3.5 w-3.5" />
          מגידי שיעור
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          הרבנים שמוסרים שיעורים
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          {list.length.toLocaleString('he-IL')} מגידי שיעור במאגר. כניסה לרב מציגה
          את כל שיעוריו, בכל המקומות ובכל הזמנים.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ teacher, count }, i) => {
          const photo = mediaUrl(teacher.photo_url) || mediaUrl(teacher.logo_url) || FALLBACK_LOGO;
          return (
            <Link
              key={teacher.id}
              href={`/rabbi/${teacher.id}`}
              className="card-surface card-edge animate-rise relative flex items-center gap-3 rounded-xl p-4 pr-5"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg
                               border border-parch-300 bg-white/70 p-1">
                <Image
                  src={photo}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                  unoptimized={photo.startsWith('http')}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[1.02rem] font-bold text-wine-700">
                  {rabbiName(teacher.full_name, teacher.honorific || 'הרב')}
                </span>
                <span className="flex items-center gap-2 truncate text-[0.76rem] text-ink-500">
                  {teacher.city && (
                    <span className="flex items-center gap-1">
                      <IconPin className="h-3 w-3 shrink-0 text-gold-500" />
                      {teacher.city}
                    </span>
                  )}
                  {teacher.organization && <span className="truncate">{teacher.organization}</span>}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-gold-100 px-2.5 py-1 text-[0.7rem] font-bold text-gold-700">
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
