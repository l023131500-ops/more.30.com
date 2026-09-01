'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { Panel, Badge } from './ui';

/**
 * חשבונות התרומה של בתי כנסת וארגונים.
 *
 * כל גוף מזין את מספר המוסד ומפתח דף התשלום שלו בנדרים פלוס, והכסף
 * נכנס ישירות אליו. אנחנו לא מתווכים ולא מחזיקים כספים.
 *
 * המסך הזה הוא שער האישור. חשבון נולד ממתין, ורק מכאן הוא נעשה פעיל.
 * ההגבלה אינה של הממשק אלא של המסד: טריגר מחזיר בשקט כל שינוי סטטוס
 * שלא נעשה בידי מנהל, ולכן גם פנייה ישירה למסד לא תוכל לאשר חשבון.
 */

interface Account {
  id: string;
  slug: string | null;
  org_name: string;
  title: string | null;
  description: string | null;
  mosad_id: string;
  api_valid: string | null;
  goal_amount: number | null;
  currency: string;
  min_amount: number | null;
  allow_recurring: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  venue_id: string | null;
  status: string;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS: Record<string, { tone: 'gold' | 'green' | 'neutral' | 'royal'; label: string }> = {
  pending: { tone: 'gold', label: 'ממתין לאישור' },
  approved: { tone: 'green', label: 'פעיל' },
  disabled: { tone: 'neutral', label: 'מושבת' },
  rejected: { tone: 'royal', label: 'נדחה' },
};

/** מסתיר את רוב המפתח, ומאפשר חשיפה מכוונת. */
function Secret({ value }: { value: string | null }) {
  const [shown, setShown] = useState(false);
  if (!value) return <span className="text-ink-400">—</span>;
  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      dir="ltr"
      className="font-mono text-[0.72rem] text-ink-600 underline decoration-dotted"
      title={shown ? 'להסתרה' : 'להצגה'}
    >
      {shown ? value : `${value.slice(0, 3)}${'•'.repeat(Math.max(value.length - 3, 3))}`}
    </button>
  );
}

export default function DonationsAdmin() {
  const [rows, setRows] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [open, setOpen] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_donation_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (qError) throw new Error(qError.message);
      setRows((data || []) as Account[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (row: Account, status: string) => {
    setBusy(true);
    setError('');
    try {
      const patch: Record<string, unknown> = { status };
      if (noteDraft.trim() && open === row.id) patch.notes = noteDraft.trim();
      const { error: uError } = await browserClient()
        .from('igud_donation_accounts')
        .update(patch)
        .eq('id', row.id);
      if (uError) throw new Error(uError.message);
      setNoteDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'העדכון נכשל');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: rows.length };
    for (const r of rows) out[r.status] = (out[r.status] || 0) + 1;
    return out;
  }, [rows]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const TABS = [
    { id: 'pending', label: 'ממתינים' },
    { id: 'approved', label: 'פעילים' },
    { id: 'disabled', label: 'מושבתים' },
    { id: 'rejected', label: 'נדחו' },
    { id: 'all', label: 'הכול' },
  ];

  return (
    <Panel
      title="תרומות — חשבונות בתי כנסת וארגונים"
      description="כל גוף מקבל תרומות ישירות לחשבון נדרים פלוס שלו. חשבון חדש אינו פעיל עד לאישור כאן."
      actions={
        <button type="button" onClick={() => void load()} disabled={busy}
          className="btn btn-quiet !py-2 !text-[0.82rem]">
          רענון
        </button>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[0.85rem] text-red-800">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[0.8rem] font-bold transition-colors ${
              filter === t.id
                ? 'bg-royal-700 text-gold-100'
                : 'bg-parch-100 text-ink-600 hover:bg-gold-50'
            }`}
          >
            {t.label}
            {counts[t.id === 'all' ? 'all' : t.id] ? ` (${counts[t.id === 'all' ? 'all' : t.id]})` : ''}
          </button>
        ))}
      </div>

      {!shown.length && !busy && (
        <p className="py-8 text-center text-[0.88rem] text-ink-500">
          {filter === 'pending'
            ? 'אין חשבונות הממתינים לאישור.'
            : 'אין חשבונות בקטגוריה הזו.'}
        </p>
      )}

      <div className="space-y-2">
        {shown.map((row) => {
          const isOpen = open === row.id;
          const meta = STATUS[row.status] || { tone: 'neutral' as const, label: row.status };
          return (
            <div key={row.id} className="rounded-xl border border-parch-200 bg-parch-50">
              <button
                type="button"
                onClick={() => { setOpen(isOpen ? null : row.id); setNoteDraft(row.notes || ''); }}
                className="flex w-full items-center justify-between gap-3 p-3 text-right"
              >
                <span className="min-w-0">
                  <span className="block text-[0.9rem] font-semibold text-ink-800">{row.org_name}</span>
                  <span className="block text-[0.74rem] text-ink-500">
                    מוסד {row.mosad_id}
                    {row.title ? ` · ${row.title}` : ''}
                    {' · '}
                    {new Date(row.created_at).toLocaleDateString('he-IL')}
                  </span>
                </span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </button>

              {isOpen && (
                <div className="border-t border-parch-200 p-3">
                  <dl className="mb-3 grid gap-x-6 gap-y-1.5 text-[0.8rem] sm:grid-cols-2">
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">מספר מוסד</dt>
                      <dd dir="ltr" className="font-mono text-ink-800">{row.mosad_id}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">מפתח דף התשלום</dt>
                      <dd><Secret value={row.api_valid} /></dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">כתובת ציבורית</dt>
                      <dd dir="ltr" className="font-mono text-[0.72rem] text-ink-700">
                        {row.slug ? `/donate/${row.slug}` : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">יעד</dt>
                      <dd className="text-ink-800">
                        {row.goal_amount ? `${row.goal_amount.toLocaleString('he-IL')} ${row.currency}` : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">איש קשר</dt>
                      <dd className="text-ink-800">{row.contact_name || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-parch-200/70 py-1">
                      <dt className="text-ink-500">טלפון</dt>
                      <dd dir="ltr" className="text-ink-800">{row.contact_phone || '—'}</dd>
                    </div>
                  </dl>

                  {row.description && (
                    <p className="mb-3 rounded-lg bg-white p-2.5 text-[0.82rem] leading-relaxed text-ink-700">
                      {row.description}
                    </p>
                  )}

                  <label className="mb-3 block">
                    <span className="mb-1 block text-[0.78rem] font-semibold text-ink-600">
                      הערת ניהול (אינה נראית לגוף ולא לציבור)
                    </span>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-parch-300 bg-white px-2.5 py-1.5 text-[0.82rem]"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {row.status !== 'approved' && (
                      <button type="button" disabled={busy}
                        onClick={() => void setStatus(row, 'approved')}
                        className="btn btn-primary !py-2 !text-[0.8rem]">
                        אישור והפעלה
                      </button>
                    )}
                    {row.status === 'approved' && (
                      <button type="button" disabled={busy}
                        onClick={() => void setStatus(row, 'disabled')}
                        className="btn btn-quiet !py-2 !text-[0.8rem]">
                        השבתה
                      </button>
                    )}
                    {row.status !== 'rejected' && (
                      <button type="button" disabled={busy}
                        onClick={() => void setStatus(row, 'rejected')}
                        className="btn btn-quiet !py-2 !text-[0.8rem]">
                        דחייה
                      </button>
                    )}
                    {row.status !== 'pending' && (
                      <button type="button" disabled={busy}
                        onClick={() => void setStatus(row, 'pending')}
                        className="btn btn-quiet !py-2 !text-[0.8rem]">
                        החזרה להמתנה
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-[0.74rem] text-ink-500">
                    התרומות נכנסות ישירות לחשבון נדרים פלוס של הגוף. האיגוד אינו צד לעסקה
                    ואינו מחזיק כספים. אישור כאן פירושו שהגוף אומת, ולא ערבות לשימוש בכסף.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
