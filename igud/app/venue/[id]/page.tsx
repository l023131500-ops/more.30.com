import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchActiveCities, fetchLessons, fetchTaxonomy } from '@/lib/queries';
import type { Venue } from '@/lib/types';
import { telHref } from '@/lib/format';
import { FALLBACK_LOGO } from '@/lib/site';
import LessonBoard from '@/components/LessonBoard';
import { IconArrowLeft, IconBuilding, IconPhone, IconPin } from '@/components/Icons';

export const revalidate = 120;

async function load(id: string) {
  if (!supabaseConfigured) return null;
  const client = publicClient();
  const { data } = await client.from('igud_venues').select('*').eq('id', id).maybeSingle();
  if (!data) return null;

  const [board, taxonomy, cities] = await Promise.all([
    fetchLessons(client, { venue: id }, 0, 24),
    fetchTaxonomy(client),
    fetchActiveCities(client),
  ]);
  return { venue: data as Venue, board, taxonomy, cities };
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'המקום לא נמצא' };
  return {
    title: `שיעורים ב${data.venue.name}`,
    description: `כל השיעורים המתקיימים ב${data.venue.name}${data.venue.city ? `, ${data.venue.city}` : ''}`,
  };
}

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const { venue, board, taxonomy, cities } = data;
  const logo = mediaUrl(venue.logo_url) || mediaUrl(venue.photo_url) || FALLBACK_LOGO;
  const address = [
    [venue.street, venue.house_no].filter(Boolean).join(' '),
    venue.neighborhood,
    venue.city,
  ].filter(Boolean).join(', ');
  const phoneHref = telHref(venue.phone);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <Link
        href="/centers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        לכל מרכזי התורה
      </Link>

      <header className="card-surface mb-8 flex flex-wrap items-center gap-5 rounded-2xl p-6 sm:p-8">
        <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl
                         border border-parch-300 bg-white/80 p-2">
          <Image
            src={logo}
            alt=""
            width={192}
            height={192}
            className="h-full w-full object-contain"
            unoptimized={logo.startsWith('http')}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
            <IconBuilding className="h-3.5 w-3.5" />
            {venue.kind}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-wine-700">{venue.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            {address && (
              <span className="flex items-center gap-1">
                <IconPin className="h-3.5 w-3.5 text-gold-600" />
                {address}
              </span>
            )}
            {venue.nusach && <span>נוסח {venue.nusach}</span>}
            {venue.gabbai_name && <span>גבאי: {venue.gabbai_name}</span>}
            {phoneHref && (
              <a href={phoneHref} className="flex items-center gap-1 font-bold text-wine-600">
                <IconPhone className="h-3.5 w-3.5" />
                {venue.phone}
              </a>
            )}
          </div>
          {venue.about && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">{venue.about}</p>
          )}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${address}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[0.82rem] font-bold text-wine-600 underline underline-offset-2"
            >
              פתיחה במפה
            </a>
          )}
        </div>
      </header>

      <LessonBoard
        initialRows={board.rows}
        initialTotal={board.total}
        taxonomy={taxonomy}
        cities={cities}
        lockedFilters={{ venue: id }}
        columns={2}
        showFilters={false}
        heading={`השיעורים ב${venue.name}`}
      />
    </div>
  );
}
