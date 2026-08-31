import Link from 'next/link';
import Image from 'next/image';
import type { Venue } from '@/lib/types';
import { FALLBACK_LOGO } from '@/lib/site';
import { mediaUrl } from '@/lib/supabase';
import { IconBuilding, IconClock, IconPin } from './Icons';

export interface VenueTile {
  venue: Venue;
  lessons: { id: string; title: string; teacher: string; when: string }[];
  total: number;
}

function Tile({ item }: { item: VenueTile }) {
  const { venue } = item;
  const logo = mediaUrl(venue.logo_url) || FALLBACK_LOGO;
  const address = [venue.neighborhood, venue.city].filter(Boolean).join(', ');

  return (
    <Link
      href={`/venue/${venue.id}`}
      className="card-surface mx-2 flex w-[19rem] shrink-0 flex-col rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
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
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-wine-700">{venue.name}</h3>
          <p className="flex items-center gap-1 truncate text-[0.75rem] text-ink-500">
            <IconPin className="h-3 w-3 shrink-0 text-gold-500" />
            {address || venue.kind}
          </p>
        </div>
      </div>

      <ul className="mt-3 flex-1 space-y-1.5 border-t border-parch-200 pt-3">
        {item.lessons.slice(0, 3).map((l) => (
          <li key={l.id} className="flex items-start gap-1.5 text-[0.78rem] leading-snug">
            <IconClock className="mt-0.5 h-3 w-3 shrink-0 text-gold-600" />
            <span className="min-w-0">
              <span className="font-bold text-ink-700">{l.title}</span>
              <span className="text-ink-500"> · {l.when}</span>
            </span>
          </li>
        ))}
        {item.lessons.length === 0 && (
          <li className="text-[0.78rem] text-ink-500">הזמנים יעודכנו בקרוב</li>
        )}
      </ul>

      <span className="mt-3 inline-flex items-center gap-1 self-start rounded-full bg-gold-100
                       px-2.5 py-1 text-[0.7rem] font-bold text-gold-700">
        <IconBuilding className="h-3 w-3" />
        {item.total} שיעורים במקום
      </span>
    </Link>
  );
}

export default function VenueMarquee({ items }: { items: VenueTile[] }) {
  if (!items.length) return null;

  const duration = Math.max(45, items.length * 9);

  return (
    <section className="mt-16">
      <div className="mx-auto mb-5 max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-wine-700">שיעורים ממרכזי תורה</h2>
            <p className="mt-1 text-sm text-ink-500">
              בתי כנסת, בתי מדרש וכוללים. לחיצה על מקום מציגה את כל השיעורים שנמסרים בו.
            </p>
          </div>
          <Link href="/centers" className="btn btn-quiet shrink-0 !py-2 !text-[0.82rem]">
            לכל המרכזים
          </Link>
        </div>
      </div>

      <div className="marquee-viewport relative overflow-hidden py-2">
        <div
          className="marquee-track"
          style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
        >
          {items.map((item) => (
            <Tile key={item.venue.id} item={item} />
          ))}
          {items.map((item) => (
            <Tile key={`dup-${item.venue.id}`} item={item} />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-parch-100 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-parch-100 to-transparent" />
      </div>
    </section>
  );
}
