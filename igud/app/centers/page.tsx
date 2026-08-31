import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import type { Venue } from '@/lib/types';
import { FALLBACK_LOGO } from '@/lib/site';
import { IconBuilding, IconPin } from '@/components/Icons';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'מרכזי תורה ובתי כנסת',
  description: 'בתי כנסת, בתי מדרש, כוללים ומרכזים תורניים שמפרסמים את שיעוריהם באיגוד השיעורים.',
};

export default async function CentersPage() {
  if (!supabaseConfigured) {
    return <div className="py-16 text-center text-ink-500">המאגר אינו מחובר כרגע.</div>;
  }

  const client = publicClient();
  const [{ data: venues }, { data: lessons }] = await Promise.all([
    client.from('igud_venues').select('*').eq('status', 'published').order('name').limit(400)
      .then((r) => r, () => ({ data: [] as Venue[] })),
    client.from('igud_lesson_cards').select('venue_id').limit(4000)
      .then((r) => r, () => ({ data: [] as { venue_id: string | null }[] })),
  ]);

  const counts = new Map<string, number>();
  for (const row of lessons || []) {
    const key = row.venue_id as string | null;
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const list = ((venues || []) as Venue[])
    .map((venue) => ({ venue, count: counts.get(venue.id) || 0 }))
    .sort((a, b) => b.count - a.count || a.venue.name.localeCompare(b.venue.name, 'he'));

  const byCity = new Map<string, typeof list>();
  for (const item of list) {
    const city = item.venue.city || 'ללא עיר';
    byCity.set(city, [...(byCity.get(city) || []), item]);
  }
  const cities = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconBuilding className="h-3.5 w-3.5" />
          מרכזי תורה
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          בתי כנסת, בתי מדרש וכוללים
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 sm:text-base">
          {list.length.toLocaleString('he-IL')} מקומות במאגר. כניסה למקום מציגה את כל
          השיעורים שנמסרים בו, לפי סדר המועדים.
        </p>
      </header>

      {cities.map(([city, items]) => (
        <section key={city} className="mb-10">
          <h2 className="mb-3 flex items-baseline gap-2 font-display text-xl font-bold text-wine-700">
            <span className="crest-title">{city}</span>
            <span className="text-sm font-normal text-ink-500">{items.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ venue, count }, i) => {
              const logo = mediaUrl(venue.logo_url) || FALLBACK_LOGO;
              const address = [
                [venue.street, venue.house_no].filter(Boolean).join(' '),
                venue.neighborhood,
              ].filter(Boolean).join(', ');

              return (
                <Link
                  key={venue.id}
                  href={`/venue/${venue.id}`}
                  className="card-surface card-edge animate-rise relative flex items-center gap-3 rounded-xl p-4 pr-5"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg
                                   border border-parch-300 bg-white/70 p-1">
                    <Image
                      src={logo}
                      alt=""
                      width={96}
                      height={96}
                      className="h-full w-full object-contain"
                      unoptimized={logo.startsWith('http')}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[1.02rem] font-bold text-wine-700">
                      {venue.name}
                    </span>
                    {address && (
                      <span className="flex items-center gap-1 truncate text-[0.76rem] text-ink-500">
                        <IconPin className="h-3 w-3 shrink-0 text-gold-500" />
                        {address}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-gold-100 px-2.5 py-1 text-[0.7rem] font-bold text-gold-700">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
