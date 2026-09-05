'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { SITE } from '@/lib/site';
import { IconCheck, IconCopy } from '../Icons';

/**
 * חשבון התרומות של בית הכנסת, במסך שלו עצמו.
 *
 * הגוף ממלא כאן את פרטי נדרים פלוס שלו, והכסף נכנס ישירות לחשבונו.
 * מה שאי אפשר לעשות מכאן הוא להפעיל את החשבון — זה נשאר בידי הניהול,
 * והמסד אוכף את זה ולא רק המסך.
 *
 * נקודה שחשוב שתהיה גלויה למשתמש ולא רק נכונה בקוד: שינוי מספר המוסד
 * או מפתח דף התשלום מחזיר את החשבון להמתנה. האישור ניתן לצירוף של גוף
 * ויעד, ולכן החלפת היעד מבטלת אותו. כתוב כאן במפורש כדי שאיש לא יופתע.
 */

interface Account {
  id: string;
  venue_id: string | null;
  slug: string | null;
  org_name: string;
  title: string | null;
  description: string | null;
  mosad_id: string;
  api_valid: string | null;
  goal_amount: number | null;
  min_amount: number | null;
  currency: string;
  allow_recurring: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
}

const STATUS_NOTE: Record<string, { style: string; label: string; note: string }> = {
  pending: {
    style: 'border-gold-400 bg-gold-50 text-gold-700',
    label: 'ממתין לאישור',
    note: 'הפרטים נשמרו. החשבון יופיע באתר אחרי שהנהלת האיגוד תאשר אותו.',
  },
  approved: {
    style: 'border-green-600/40 bg-green-50 text-green-800',
    label: 'פעיל',
    note: 'דף התרומה שלכם חי ומקבל תרומות.',
  },
  disabled: {
    style: 'border-parch-300 bg-parch-200 text-ink-500',
    label: 'מושבת',
    note: 'החשבון הושבת. לפרטים נא לפנות להנהלת האיגוד.',
  },
  rejected: {
    style: 'border-royal-400 bg-royal-50 text-royal-700',
    label: 'נדחה',
    note: 'הבקשה נדחתה. אפשר לתקן את הפרטים ולשמור שוב לבדיקה חוזרת.',
  },
};

const EMPTY = {
  org_name: '', title: '', description: '', mosad_id: '', api_valid: '',
  goal_amount: '', min_amount: '', contact_name: '', contact_phone: '', contact_email: '',
  allow_recurring: true,
};

export default function DonationCard({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const load = useCallback(async () => {
    const { data, error: qError } = await browserClient()
      .from('igud_donation_accounts')
      .select('*')
      .eq('venue_id', venueId)
      .maybeSingle();
    if (qError) { setError(qError.message); return; }
    const row = (data || null) as Account | null;
    setAccount(row);
    if (row) {
      setForm({
        org_name: row.org_name || '',
        title: row.title || '',
        description: row.description || '',
        mosad_id: row.mosad_id || '',
        api_valid: row.api_valid || '',
        goal_amount: row.goal_amount ? String(row.goal_amount) : '',
        min_amount: row.min_amount ? String(row.min_amount) : '',
        contact_name: row.contact_name || '',
        contact_phone: row.contact_phone || '',
        contact_email: row.contact_email || '',
        allow_recurring: row.allow_recurring,
      });
    } else {
      setForm({ ...EMPTY, org_name: venueName });
    }
  }, [venueId, venueName]);

  useEffect(() => { void load(); }, [load]);

  /** האם השמירה תחזיר את החשבון להמתנה */
  const willRepend = Boolean(
    account
    && account.status === 'approved'
    && (form.mosad_id.trim() !== (account.mosad_id || '')
      || form.api_valid.trim() !== (account.api_valid || '')),
  );

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      if (!form.org_name.trim()) throw new Error('חסר שם הגוף');
      if (!form.mosad_id.trim()) throw new Error('חסר מספר המוסד בנדרים פלוס');

      const payload = {
        venue_id: venueId,
        org_name: form.org_name.trim(),
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        mosad_id: form.mosad_id.trim(),
        api_valid: form.api_valid.trim() || null,
        goal_amount: form.goal_amount ? Number(form.goal_amount) : null,
        min_amount: form.min_amount ? Number(form.min_amount) : null,
        allow_recurring: form.allow_recurring,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
      };

      const client = browserClient();
      const { error: wError } = account
        ? await client.from('igud_donation_accounts').update(payload).eq('id', account.id)
        : await client.from('igud_donation_accounts').insert(payload);
      if (wError) throw new Error(wError.message);

      setSaved(true);
      setOpenForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const donateUrl = account?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : SITE.url}/donate/${account.slug}`
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(donateUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* מתעלמים */ }
  };

  const state = account ? (STATUS_NOTE[account.status] || STATUS_NOTE.pending) : null;

  const field = (
    key: keyof typeof EMPTY, label: string,
    opts: { type?: string; hint?: string; area?: boolean } = {},
  ) => (
    <label className="block">
      <span className="mb-1 block text-[0.8rem] font-semibold text-ink-700">{label}</span>
      {opts.area ? (
        <textarea
          rows={3}
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-lg border border-parch-300 bg-white px-3 py-2 text-[0.86rem]"
        />
      ) : (
        <input
          type={opts.type || 'text'}
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-lg border border-parch-300 bg-white px-3 py-2 text-[0.86rem]"
          dir={opts.type === 'number' || key === 'mosad_id' || key === 'api_valid' ? 'ltr' : undefined}
        />
      )}
      {opts.hint && <span className="mt-1 block text-[0.72rem] text-ink-500">{opts.hint}</span>}
    </label>
  );

  return (
    <div className="card-surface rounded-xl p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-royal-700">קבלת תרומות</h3>
          <p className="text-[0.76rem] text-ink-500">{venueName}</p>
        </div>
        {state && (
          <span className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-bold ${state.style}`}>
            {state.label}
          </span>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[0.82rem] text-red-800">{error}</p>}
      {saved && !error && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-[0.82rem] text-green-800">נשמר.</p>
      )}

      {state && <p className="mb-3 text-[0.82rem] leading-relaxed text-ink-600">{state.note}</p>}

      {!account && !openForm && (
        <>
          <p className="mb-3 text-[0.84rem] leading-relaxed text-ink-600">
            אפשר לקבל תרומות דרך נדרים פלוס, ישירות לחשבון של בית הכנסת.
            הכסף אינו עובר דרך האיגוד — הוא נכנס לחשבון שלכם. נדרשים מספר
            המוסד ומפתח דף התשלום שלכם מנדרים פלוס.
          </p>
          <button type="button" onClick={() => setOpenForm(true)} className="btn btn-primary !py-2 !text-[0.82rem]">
            פתיחת חשבון תרומות
          </button>
        </>
      )}

      {account?.status === 'approved' && donateUrl && !openForm && (
        <div className="mb-3">
          <p className="mb-1 text-[0.78rem] font-semibold text-ink-700">הקישור לתרומה</p>
          <p dir="ltr" className="truncate rounded-lg bg-parch-200 px-3 py-2 text-[0.75rem] text-ink-700">
            {donateUrl}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy} className="btn btn-quiet !py-1.5 !text-[0.78rem]">
              {copied
                ? <><IconCheck className="h-3.5 w-3.5 text-green-700" /> הועתק</>
                : <><IconCopy className="h-3.5 w-3.5" /> העתקה</>}
            </button>
            <a href={donateUrl} target="_blank" rel="noopener noreferrer" className="btn btn-quiet !py-1.5 !text-[0.78rem]">
              תצוגה
            </a>
          </div>
        </div>
      )}

      {account && !openForm && (
        <button type="button" onClick={() => setOpenForm(true)} className="btn btn-quiet !py-2 !text-[0.82rem]">
          עריכת הפרטים
        </button>
      )}

      {openForm && (
        <div className="space-y-3">
          {field('org_name', 'שם הגוף כפי שיוצג')}
          {field('title', 'כותרת הקמפיין', { hint: 'לדוגמה: החזקת בית המדרש' })}
          {field('description', 'תיאור קצר', { area: true })}

          <div className="rounded-lg border border-gold-400 bg-gold-50 p-3">
            <p className="mb-2 text-[0.78rem] font-bold text-gold-700">פרטי נדרים פלוס שלכם</p>
            <div className="space-y-3">
              {field('mosad_id', 'מספר מוסד', { hint: 'מופיע בממשק נדרים פלוס' })}
              {field('api_valid', 'מפתח דף התשלום', { hint: 'ApiValid — מהגדרות דף התשלום בנדרים פלוס' })}
            </div>
            {willRepend && (
              <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[0.76rem] leading-relaxed text-royal-700">
                שינוי מספר המוסד או מפתח התשלום יחזיר את החשבון להמתנה לאישור,
                ודף התרומה יושהה עד לאישור מחדש. זה מכוון: האישור ניתן ליעד
                הקודם, ולא ליעד החדש.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {field('goal_amount', 'יעד בשקלים', { type: 'number' })}
            {field('min_amount', 'סכום מזערי', { type: 'number' })}
          </div>

          <label className="flex items-center gap-2 text-[0.84rem] text-ink-700">
            <input
              type="checkbox"
              checked={form.allow_recurring}
              onChange={(e) => setForm({ ...form, allow_recurring: e.target.checked })}
            />
            לאפשר הוראת קבע
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            {field('contact_name', 'איש קשר')}
            {field('contact_phone', 'טלפון', { type: 'tel' })}
            {field('contact_email', 'דואר אלקטרוני', { type: 'email' })}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={busy}
              className="btn btn-primary !py-2 !text-[0.82rem]">
              {busy ? 'שומר...' : 'שמירה'}
            </button>
            <button type="button" onClick={() => { setOpenForm(false); void load(); }} disabled={busy}
              className="btn btn-quiet !py-2 !text-[0.82rem]">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
