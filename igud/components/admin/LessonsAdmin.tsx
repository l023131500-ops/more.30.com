'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase';
import type { Taxonomy } from '@/lib/types';
import LessonEditor, { type EditableLesson } from '../LessonEditor';
import { IconSearch } from '../Icons';
import { ConfirmButton, EmptyState, Panel, StatusBadge, Toast } from './ui';

const PAGE = 40;

export default function LessonsAdmin({
  mode, taxonomy, onChanged,
}: {
  mode: 'pending' | 'all';
  taxonomy: Taxonomy;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<EditableLesson[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<string>(mode === 'pending' ? 'pending' : '');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<EditableLesson | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = 0) => {
    setBusy(true);
    setError('');
    try {
      let query = browserClient()
        .from('igud_lessons')
        .select(
          '*, occurrences:igud_occurrences(weekday, day_label, time_of_day, specific_date, time_slot)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(nextPage * PAGE, nextPage * PAGE + PAGE - 1);

      if (status) query = query.eq('status', status);
      if (term.trim()) query = query.ilike('search_text', `%${term.trim().toLowerCase()}%`);

      const { data, error: qError, count } = await query;
      if (qError) throw new Error(qError.message);
      setRows((data || []) as EditableLesson[]);
      setTotal(count ?? 0);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'טעינת השיעורים נכשלה');
    } finally {
      setBusy(false);
    }
  }, [status, term]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(0); }, term ? 320 : 0);
    return () => window.clearTimeout(t);
  }, [load, term]);

  const setLessonStatus = async (id: string, next: string) => {
    setError('');
    const patch: Record<string, unknown> = { status: next };
    if (next === 'published') patch.published_at = new Date().toISOString();
    const { error: upError } = await browserClient().from('igud_lessons').update(patch).eq('id', id);
    if (upError) { setError(upError.message); return; }
    setMessage(next === 'published' ? 'השיעור פורסם' : 'הסטטוס עודכן');
    window.setTimeout(() => setMessage(''), 2500);
    await load(page);
    onChanged?.();
  };

  const remove = async (id: string) => {
    const { error: delError } = await browserClient().from('igud_lessons').delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    setMessage('השיעור נמחק');
    window.setTimeout(() => setMessage(''), 2500);
    await load(page);
    onChanged?.();
  };

  const summary = (lesson: EditableLesson) =>
    (lesson.occurrences || [])
      .map((o) => {
        const day = (o.day_label || '').replace('יום ', '');
        const time = (o.time_of_day || '').slice(0, 5) || o.time_slot || '';
        return `${day || o.specific_date || ''} ${time}`.trim();
      })
      .filter(Boolean)
      .join(' · ') || 'ללא מועד';

  return (
    <Panel
      title={mode === 'pending' ? 'שיעורים הממתינים לאישור' : 'כל השיעורים'}
      description={
        mode === 'pending'
          ? 'כל שיעור שנשלח מהאתר, מהמערכת הקולית או מנדרים פלוס ממתין כאן לאישור.'
          : `${total.toLocaleString('he-IL')} שיעורים במאגר`
      }
      actions={
        <>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="חיפוש"
              className="field !w-56 !py-2 !pr-9 !text-[0.82rem]"
            />
          </div>
          {mode === 'all' && (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="field !w-auto !py-2 !text-[0.82rem]"
            >
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין לאישור</option>
              <option value="published">מפורסם</option>
              <option value="rejected">נדחה</option>
              <option value="archived">בארכיון</option>
            </select>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {message && <Toast message={message} />}
        {error && <Toast message={error} tone="error" />}

        {busy && <p className="text-sm text-ink-500">טוען...</p>}

        {!busy && rows.length === 0 && (
          <EmptyState
            text={mode === 'pending' ? 'אין כרגע שיעורים הממתינים לאישור.' : 'לא נמצאו שיעורים.'}
          />
        )}

        {rows.map((lesson) => (
          <article
            key={lesson.id}
            className="rounded-xl border border-parch-300 bg-white/70 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold text-royal-700">
                    {lesson.title || lesson.topic || lesson.topic_other || 'שיעור תורה'}
                  </h3>
                  <StatusBadge status={lesson.status} />
                </div>
                <p className="mt-1 text-[0.82rem] text-ink-700">
                  <span className="font-bold">{lesson.teacher_name || 'ללא שם'}</span>
                  {lesson.venue_name && <> · {lesson.venue_name}</>}
                  {lesson.city && <> · {lesson.city}</>}
                </p>
                <p className="mt-0.5 text-[0.78rem] text-ink-500">{summary(lesson)}</p>
                {lesson.contact_phone && (
                  <p className="mt-0.5 text-[0.78rem] text-ink-500" dir="ltr">
                    {lesson.contact_phone}
                    {lesson.contact_email ? ` · ${lesson.contact_email}` : ''}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {lesson.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => setLessonStatus(lesson.id, 'published')}
                    className="btn btn-primary !py-1.5 !text-[0.76rem]"
                  >
                    אישור ופרסום
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(lesson)}
                  className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                >
                  עריכה
                </button>
                {lesson.status === 'published' && (
                  <Link
                    href={`/lesson/${lesson.id}`}
                    target="_blank"
                    className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                  >
                    צפייה
                  </Link>
                )}
                {lesson.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setLessonStatus(lesson.id, 'rejected')}
                    className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                  >
                    לא להציג
                  </button>
                )}
                <ConfirmButton
                  label="מחיקה"
                  confirmLabel="למחוק לגמרי"
                  onConfirm={() => remove(lesson.id)}
                />
              </div>
            </div>
          </article>
        ))}

        {total > PAGE && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => void load(page - 1)}
              className="btn btn-quiet !py-1.5 !text-[0.78rem]"
            >
              הקודם
            </button>
            <span className="text-[0.78rem] text-ink-500 tabular-nums">
              {page * PAGE + 1} עד {Math.min((page + 1) * PAGE, total)} מתוך {total}
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE >= total || busy}
              onClick={() => void load(page + 1)}
              className="btn btn-quiet !py-1.5 !text-[0.78rem]"
            >
              הבא
            </button>
          </div>
        )}
      </div>

      {editing && (
        <LessonEditor
          lesson={editing}
          taxonomy={taxonomy}
          isAdmin
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(page); onChanged?.(); }}
        />
      )}
    </Panel>
  );
}
