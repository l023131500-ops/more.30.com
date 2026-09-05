'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LessonCard as Lesson, LessonFilters, Taxonomy } from '@/lib/types';
import { publicClient } from '@/lib/supabase';
import { fetchLessons, PAGE_SIZE } from '@/lib/queries';
import LessonCardTile from './LessonCard';
import { IconChevronDown, IconClose, IconFilter, IconSearch } from './Icons';

interface Props {
  initialRows: Lesson[];
  initialTotal: number;
  taxonomy: Taxonomy;
  cities: string[];
  lockedFilters?: LessonFilters;
  columns?: 1 | 2 | 3;
  heading?: string;
  showFilters?: boolean;
}

type FilterKey = keyof LessonFilters;

const BROADCAST_OPTIONS = [
  { value: 'any', label: 'מוקלט או משודר' },
  { value: 'live', label: 'שידור חי' },
  { value: 'recorded', label: 'מוקלט' },
];

function Select({
  label, value, options, onChange, allLabel,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
  allLabel: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`field appearance-none !py-2 !pl-8 !pr-3 !text-[0.82rem] font-bold ${
          value ? 'border-royal-500 !bg-royal-50 text-royal-700' : 'text-ink-700'
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
    </label>
  );
}

export default function LessonBoard({
  initialRows, initialTotal, taxonomy, cities,
  lockedFilters = {}, columns = 2, heading, showFilters = true,
}: Props) {
  const [filters, setFilters] = useState<LessonFilters>({});
  const [rows, setRows] = useState<Lesson[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState('');
  const [openFilters, setOpenFilters] = useState(false);

  const client = useMemo(() => publicClient(), []);
  const firstRender = useRef(true);
  const requestId = useRef(0);

  const active = useMemo(
    () => ({ ...lockedFilters, ...filters }),
    [lockedFilters, filters],
  );

  const activeCount = Object.values(filters).filter(Boolean).length;

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const id = ++requestId.current;
      setBusy(true);
      try {
        const { rows: fetched, total: count } = await fetchLessons(client, active, nextPage);
        if (id !== requestId.current) return;
        setRows((prev) => (replace ? fetched : [...prev, ...fetched]));
        setTotal(count);
        setPage(nextPage);
      } catch {
        if (id === requestId.current && replace) setRows([]);
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [client, active],
  );

  // חיפוש מושהה, כדי לא לפנות לשרת על כל תו
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => (f.q === (term || undefined) ? f : { ...f, q: term || undefined }));
    }, 320);
    return () => window.clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(active)]);

  const set = (key: FilterKey) => (value: string | undefined) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearAll = () => {
    setTerm('');
    setFilters({});
  };

  const gridClass =
    columns === 1 ? 'grid-cols-1'
      : columns === 3 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2';

  const hasMore = rows.length < total;

  return (
    <section>
      {showFilters && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[15rem] flex-1">
              <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="חיפוש לפי רב, נושא, בית כנסת או עיר"
                className="field !py-2.5 !pr-10 !text-[0.9rem]"
                aria-label="חיפוש שיעור"
              />
            </div>

            <button
              type="button"
              onClick={() => setOpenFilters((v) => !v)}
              className={`btn !py-2.5 lg:hidden ${activeCount ? 'btn-primary' : 'btn-quiet'}`}
              aria-expanded={openFilters}
            >
              <IconFilter className="h-4 w-4" />
              סינון
              {activeCount > 0 && (
                <span className="rounded-full bg-gold-300 px-1.5 text-[0.7rem] text-royal-800">
                  {activeCount}
                </span>
              )}
            </button>

            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="btn btn-quiet !py-2.5">
                <IconClose className="h-3.5 w-3.5" />
                ניקוי
              </button>
            )}
          </div>

          <div
            className={`mt-3 gap-2 ${openFilters ? 'grid' : 'hidden'} lg:!grid
                        grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`}
          >
            <Select label="עיר" allLabel="כל הערים" value={filters.city}
              options={cities.length ? cities : taxonomy.cities || []} onChange={set('city')} />
            <Select label="נושא" allLabel="כל הנושאים" value={filters.topic}
              options={taxonomy.topics || []} onChange={set('topic')} />
            <Select label="קהל" allLabel="לכל הקהלים" value={filters.gender}
              options={taxonomy.audienceGender || []} onChange={set('gender')} />
            <Select label="יום" allLabel="כל הימים" value={filters.day}
              options={taxonomy.days || []} onChange={set('day')} />
            <Select label="שפה" allLabel="כל השפות" value={filters.language}
              options={taxonomy.languages || []} onChange={set('language')} />
            <label className="relative block">
              <span className="sr-only">שידור</span>
              <select
                value={filters.broadcast || ''}
                onChange={(e) => set('broadcast')(e.target.value || undefined)}
                className={`field appearance-none !py-2 !pl-8 !pr-3 !text-[0.82rem] font-bold ${
                  filters.broadcast ? 'border-royal-500 !bg-royal-50 text-royal-700' : 'text-ink-700'
                }`}
              >
                <option value="">שידור והקלטה</option>
                {BROADCAST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <IconChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            </label>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-royal-700">
          {heading || 'שיעורים במאגר'}
        </h2>
        <span className="text-sm text-ink-500 tabular-nums">
          {total.toLocaleString('he-IL')} שיעורים
        </span>
      </div>

      {rows.length === 0 && !busy && (
        <div className="rounded-2xl border border-dashed border-parch-300 bg-white/50 p-12 text-center">
          <p className="font-display text-lg font-bold text-royal-700">לא נמצאו שיעורים</p>
          <p className="mt-1 text-sm text-ink-500">
            אפשר לנסות חיפוש אחר, או להסיר חלק מהסינונים.
          </p>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="btn btn-quiet mt-4">
              ניקוי הסינונים
            </button>
          )}
        </div>
      )}

      <div className={`grid gap-4 ${gridClass}`}>
        {rows.map((lesson, i) => (
          <LessonCardTile key={lesson.id} lesson={lesson} index={i % PAGE_SIZE} />
        ))}
        {busy &&
          Array.from({ length: rows.length ? 2 : 6 }).map((_, i) => (
            <div key={`sk-${i}`} className="skeleton h-44 rounded-2xl" />
          ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void load(page + 1, false)}
            disabled={busy}
            className="btn btn-gold !px-10 !py-3 !text-base"
          >
            {busy ? 'טוען...' : 'עוד'}
            <IconChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
