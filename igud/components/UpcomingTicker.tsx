'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { countdown, relativeWhen, timeLabel } from '@/lib/format';
import { IconClock, IconLive, IconMic, IconPin } from './Icons';

export interface UpcomingRow {
  lesson_id: string;
  title: string | null;
  topic: string | null;
  topic_other: string | null;
  topics: string[] | null;
  teacher_name: string | null;
  venue_name: string | null;
  location_exact: string | null;
  city: string | null;
  neighborhood: string | null;
  broadcast: string;
  next_at: string;
  day_label: string | null;
  time_of_day: string | null;
  weekday: number | null;
  specific_date: string | null;
  audience_gender: string | null;
}

function rowTitle(row: UpcomingRow) {
  return (
    row.title?.trim() ||
    row.topic_other?.trim() ||
    row.topic?.trim() ||
    row.topics?.[0] ||
    'שיעור תורה'
  );
}

function Row({ row, order }: { row: UpcomingRow; order: number }) {
  const when = relativeWhen(row.next_at);
  const left = countdown(row.next_at);
  const place = row.venue_name || row.location_exact || row.city || '';
  const recorded = row.broadcast === 'recorded' || row.broadcast === 'both';
  const live = row.broadcast === 'live' || row.broadcast === 'both';

  return (
    <Link
      href={`/lesson/${row.lesson_id}`}
      className="animate-ticker group relative flex gap-3 rounded-xl border border-transparent
                 px-3 py-3 transition-all duration-300 hover:border-gold-300 hover:bg-white/70"
      style={{ animationDelay: `${Math.min(order, 14) * 70}ms` }}
    >
      <span className="flex w-[3.4rem] shrink-0 flex-col items-center justify-center rounded-lg
                       bg-gradient-to-b from-wine-600 to-wine-800 py-1.5 text-gold-200">
        <span className="text-[0.6rem] leading-none opacity-85">{when.day}</span>
        <span className="mt-0.5 font-display text-[0.95rem] font-bold leading-none tabular-nums">
          {when.time || timeLabel({
            weekday: row.weekday, day: row.day_label, time: row.time_of_day,
            date: row.specific_date, slot: null, note: null, next_at: row.next_at,
          })}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-[0.95rem] font-bold text-wine-700">
            {rowTitle(row)}
          </span>
          {recorded && <IconMic className="h-3 w-3 shrink-0 text-gold-600" />}
          {live && <IconLive className="h-3 w-3 shrink-0 text-wine-500" />}
        </span>
        <span className="mt-0.5 block truncate text-[0.8rem] font-bold text-ink-700">
          {row.teacher_name}
        </span>
        {place && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-[0.75rem] text-ink-500">
            <IconPin className="h-3 w-3 shrink-0 text-gold-500" />
            {place}
          </span>
        )}
        {left && (
          <span className="mt-1 inline-block rounded-full bg-gold-100 px-2 py-0.5 text-[0.66rem] font-bold text-gold-700">
            {left}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function UpcomingTicker({ rows }: { rows: UpcomingRow[] }) {
  const [now, setNow] = useState(() => Date.now());

  // רענון עדין כדי שהספירה לאחור תישאר נכונה
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const live = useMemo(
    () => rows.filter((r) => new Date(r.next_at).getTime() > now - 30 * 60_000),
    [rows, now],
  );

  const scrolls = live.length > 7;
  const duration = Math.max(38, live.length * 5.5);

  if (!live.length) {
    return (
      <aside className="rounded-2xl border border-parch-300 bg-white/60 p-6 text-center">
        <IconClock className="mx-auto h-6 w-6 text-gold-500" />
        <p className="mt-2 text-sm text-ink-500">אין כרגע שיעורים קרובים במאגר</p>
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-parch-300 bg-gradient-to-b from-white/80 to-parch-100/60 shadow-[var(--shadow-card)]">
      <header className="border-b border-parch-200 bg-gradient-to-l from-wine-700 to-wine-800 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-gold-200">
          <IconClock className="h-4 w-4 text-gold-400" />
          השיעורים הקרובים
        </h2>
        <p className="mt-0.5 text-[0.7rem] text-gold-300/80">לפי סדר הזמנים, מהקרוב ביותר והלאה</p>
      </header>

      <div
        className={`ticker-viewport relative px-2 py-2 ${scrolls ? 'max-h-[64rem] overflow-hidden' : ''}`}
      >
        <div
          className={scrolls ? 'ticker-track' : ''}
          style={scrolls ? ({ '--ticker-duration': `${duration}s` } as React.CSSProperties) : undefined}
        >
          {live.map((row, i) => (
            <Row key={`${row.lesson_id}-${row.next_at}-${i}`} row={row} order={i} />
          ))}
          {scrolls &&
            live.map((row, i) => (
              <Row key={`dup-${row.lesson_id}-${row.next_at}-${i}`} row={row} order={0} />
            ))}
        </div>

        {scrolls && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/90 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-parch-100 to-transparent" />
          </>
        )}
      </div>
    </aside>
  );
}
