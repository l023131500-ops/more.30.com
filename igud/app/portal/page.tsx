'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { browserClient } from '@/lib/supabase';
import { useIgudSession } from '@/lib/auth';
import { loadTaxonomyClient } from '@/lib/taxonomy-client';
import type { Taxonomy } from '@/lib/types';
import { SITE } from '@/lib/site';
import LoginCard from '@/components/auth/LoginCard';
import LessonEditor, { type EditableLesson } from '@/components/LessonEditor';
import DonationCard from '@/components/portal/DonationCard';
import {
  IconArrowLeft, IconCheck, IconCopy, IconLink, IconPlus, IconClock, IconPin,
} from '@/components/Icons';

interface MyLink { kind: string; id: string; name: string; token: string }

const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין לאישור',
  published: 'מפורסם',
  rejected: 'נדחה',
  archived: 'בארכיון',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-gold-400 bg-gold-50 text-gold-700',
  published: 'border-green-600/40 bg-green-50 text-green-800',
  rejected: 'border-royal-400 bg-royal-50 text-royal-700',
  archived: 'border-parch-300 bg-parch-200 text-ink-500',
};

export default function PortalPage() {
  const { session, me, loading, signIn, signOut } = useIgudSession();
  const [lessons, setLessons] = useState<EditableLesson[]>([]);
  const [links, setLinks] = useState<MyLink[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [editing, setEditing] = useState<EditableLesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  const ids = useMemo(() => {
    const teacherIds = (me?.accounts || []).map((a) => a.teacher_id).filter(Boolean) as string[];
    const venueIds = (me?.accounts || []).map((a) => a.venue_id).filter(Boolean) as string[];
    return { teacherIds, venueIds };
  }, [me]);

  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const client = browserClient();
      const filters: string[] = [];
      if (ids.teacherIds.length) filters.push(`teacher_id.in.(${ids.teacherIds.join(',')})`);
      if (ids.venueIds.length) filters.push(`venue_id.in.(${ids.venueIds.join(',')})`);

      let query = client
        .from('igud_lessons')
        .select('*, occurrences:igud_occurrences(weekday, day_label, time_of_day, specific_date, time_slot)')
        .order('updated_at', { ascending: false });
      if (filters.length) query = query.or(filters.join(','));
      else if (!me?.is_admin) query = query.eq('id', '00000000-0000-0000-0000-000000000000');

      const [{ data: rows, error: rowsError }, { data: linkData }, tax] = await Promise.all([
        query,
        client.rpc('igud_my_links'),
        loadTaxonomyClient(),
      ]);
      if (rowsError) throw new Error(rowsError.message);

      setLessons((rows || []) as EditableLesson[]);
      setLinks((linkData as MyLink[]) || []);
      setTaxonomy(tax);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'טעינת הנתונים נכשלה');
    } finally {
      setBusy(false);
    }
  }, [session, ids, me]);

  useEffect(() => { void load(); }, [load]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 2200);
    } catch {
      setError('לא ניתן להעתיק בדפדפן הזה');
    }
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-ink-500">טוען...</div>;
  }

  if (!session) {
    return (
      <LoginCard
        title="אזור אישי"
        subtitle="לרבנים, לבתי כנסת ולמרכזים תורניים. כניסה עם שם המשתמש שקיבלתם מהאיגוד."
        onSubmit={signIn}
        footer={
          <>
            אין לכם עדיין חשבון?{' '}
            <a href={`tel:${SITE.voiceLine}`} className="font-bold text-royal-600">
              מתקשרים ל-{SITE.voiceLine}
            </a>
          </>
        }
      />
    );
  }

  const hasAccounts = (me?.accounts || []).length > 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src={SITE.logoSmall} alt="" width={220} height={242} className="h-14 w-auto" />
          <div>
            <h1 className="font-display text-2xl font-bold text-royal-700">האזור האישי</h1>
            <p className="text-[0.8rem] text-ink-500">
              {me?.accounts?.[0]?.display_name || session.user.email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-quiet !py-2 !text-[0.82rem]">
            <IconArrowLeft className="h-3.5 w-3.5" />
            לאתר
          </Link>
          {me?.is_admin && (
            <Link href="/admin" className="btn btn-quiet !py-2 !text-[0.82rem]">מסך ניהול</Link>
          )}
          <button type="button" onClick={signOut} className="btn btn-quiet !py-2 !text-[0.82rem]">
            יציאה
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-5 rounded-lg border border-royal-300 bg-royal-50 px-4 py-3 text-sm font-bold text-royal-700">
          {error}
        </p>
      )}

      {/* ---------- קישורים אישיים ---------- */}
      {links.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold text-royal-700">הקישורים שלכם</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((link) => {
              const url = `${typeof window !== 'undefined' ? window.location.origin : SITE.url}/p/${link.token}`;
              return (
                <div key={link.token} className="card-surface rounded-xl p-4">
                  <p className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-gold-700">
                    <IconLink className="h-3.5 w-3.5" />
                    {link.kind === 'teacher' ? 'דף מגיד השיעור' : 'דף המרכז'}
                  </p>
                  <p className="mt-1 font-display text-base font-bold text-royal-700">{link.name}</p>
                  <p className="mt-2 truncate rounded-lg bg-parch-200 px-3 py-2 text-[0.75rem] text-ink-700" dir="ltr">
                    {url}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copy(url, link.token)}
                      className="btn btn-quiet !py-1.5 !text-[0.78rem]"
                    >
                      {copied === link.token ? <IconCheck className="h-3.5 w-3.5 text-green-700" /> : <IconCopy className="h-3.5 w-3.5" />}
                      {copied === link.token ? 'הועתק' : 'העתקת הקישור'}
                    </button>
                    <a
                      href={`/p/${link.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-quiet !py-1.5 !text-[0.78rem]"
                    >
                      תצוגה
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- תרומות ---------- */}
      {links.some((l) => l.kind === 'venue') && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold text-royal-700">תרומות</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {links
              .filter((l) => l.kind === 'venue')
              .map((l) => (
                <DonationCard key={l.id} venueId={l.id} venueName={l.name} />
              ))}
          </div>
        </section>
      )}

      {/* ---------- השיעורים שלי ---------- */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-royal-700">השיעורים שלכם</h2>
          <Link href="/add" className="btn btn-primary !py-2 !text-[0.82rem]">
            <IconPlus className="h-3.5 w-3.5" />
            הוספת שיעור
          </Link>
        </div>

        {busy && <p className="text-sm text-ink-500">טוען...</p>}

        {!busy && lessons.length === 0 && (
          <div className="rounded-2xl border border-dashed border-parch-300 bg-white/50 p-10 text-center">
            <p className="font-display text-lg font-bold text-royal-700">אין עדיין שיעורים</p>
            <p className="mt-1 text-sm text-ink-500">
              {hasAccounts
                ? 'אפשר להוסיף שיעור חדש, והוא יופיע כאן מיד לאחר האישור.'
                : 'החשבון עדיין לא שויך למגיד שיעור או למרכז. נא לפנות לצוות האיגוד.'}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="card-surface flex flex-wrap items-center gap-4 rounded-xl p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold text-royal-700">
                    {lesson.title || lesson.topic || 'שיעור תורה'}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.66rem] font-bold ${
                      STATUS_STYLE[lesson.status] || STATUS_STYLE.pending
                    }`}
                  >
                    {STATUS_LABEL[lesson.status] || lesson.status}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-ink-500">
                  <span className="flex items-center gap-1">
                    <IconPin className="h-3 w-3 text-gold-600" />
                    {[lesson.venue_name, lesson.city].filter(Boolean).join(', ') || 'ללא מיקום'}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconClock className="h-3 w-3 text-gold-600" />
                    {(lesson.occurrences || [])
                      .map((o) => `${(o.day_label || '').replace('יום ', '')} ${(o.time_of_day || '').slice(0, 5)}`.trim())
                      .filter(Boolean)
                      .join(' · ') || 'ללא מועד'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                {lesson.status === 'published' && (
                  <Link href={`/lesson/${lesson.id}`} className="btn btn-quiet !py-1.5 !text-[0.78rem]">
                    צפייה
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(lesson)}
                  className="btn btn-primary !py-1.5 !text-[0.78rem]"
                >
                  עריכה
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <LessonEditor
          lesson={editing}
          taxonomy={taxonomy}
          isAdmin={me?.is_admin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}
