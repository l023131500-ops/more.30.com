'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { SITE } from '@/lib/site';
import { IconCheck, IconCopy, IconLink, IconSearch } from '../Icons';
import { ConfirmButton, EmptyState, Panel, StatusBadge, Toast } from './ui';

type Kind = 'teacher' | 'venue';

interface Row {
  id: string;
  name: string;
  city: string | null;
  status: string;
  token: string | null;
  extra: string | null;
}

const TABLE = { teacher: 'igud_teachers', venue: 'igud_venues' } as const;

export default function PeopleAdmin({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [creating, setCreating] = useState<Row | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const nameCol = kind === 'teacher' ? 'full_name' : 'name';
      let query = browserClient()
        .from(TABLE[kind])
        .select(
          kind === 'teacher'
            ? 'id, full_name, city, status, personal_token, organization'
            : 'id, name, city, status, personal_token, kind',
        )
        .order(nameCol)
        .limit(500);
      if (term.trim()) query = query.ilike(nameCol, `%${term.trim()}%`);

      const { data, error: qError } = await query;
      if (qError) throw new Error(qError.message);

      setRows((data || []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: row.id as string,
          name: (kind === 'teacher' ? row.full_name : row.name) as string,
          city: (row.city as string) || null,
          status: row.status as string,
          token: (row.personal_token as string) || null,
          extra: ((kind === 'teacher' ? row.organization : row.kind) as string) || null,
        };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, [kind, term]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, term ? 320 : 0);
    return () => window.clearTimeout(t);
  }, [load, term]);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2600);
  };

  const setStatus = async (id: string, status: string) => {
    const { error: upError } = await browserClient().from(TABLE[kind]).update({ status }).eq('id', id);
    if (upError) { setError(upError.message); return; }
    flash('הסטטוס עודכן');
    await load();
  };

  const remove = async (id: string) => {
    const { error: delError } = await browserClient().from(TABLE[kind]).delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    flash('הרשומה נמחקה');
    await load();
  };

  const rotate = async (id: string) => {
    const { error: rpcError } = await browserClient().rpc('igud_rotate_link', { p_kind: kind, p_id: id });
    if (rpcError) { setError(rpcError.message); return; }
    flash('נוצר קישור חדש. הקישור הקודם אינו פעיל יותר.');
    await load();
  };

  const copyLink = async (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : SITE.url;
    try {
      await navigator.clipboard.writeText(`${origin}/p/${token}`);
      setCopied(token);
      window.setTimeout(() => setCopied(''), 2200);
    } catch {
      setError('לא ניתן להעתיק בדפדפן הזה');
    }
  };

  const createUser = async () => {
    if (!creating) return;
    setError('');
    const { error: rpcError } = await browserClient().rpc('igud_create_portal_user', {
      p_login: login,
      p_password: password,
      p_role: kind === 'teacher' ? 'teacher' : 'venue',
      p_teacher_id: kind === 'teacher' ? creating.id : null,
      p_venue_id: kind === 'venue' ? creating.id : null,
      p_display: creating.name,
    });
    if (rpcError) { setError(rpcError.message); return; }
    flash(`נוצר חשבון כניסה עבור ${creating.name}`);
    setCreating(null);
    setLogin('');
    setPassword('');
  };

  return (
    <Panel
      title={kind === 'teacher' ? 'מגידי שיעור' : 'מרכזי תורה ובתי כנסת'}
      description="ניהול הרשומות, יצירת קישור אישי ופתיחת חשבון לאזור האישי."
      actions={
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
      }
    >
      <div className="space-y-3">
        {message && <Toast message={message} />}
        {error && <Toast message={error} tone="error" />}
        {busy && <p className="text-sm text-ink-500">טוען...</p>}
        {!busy && rows.length === 0 && <EmptyState text="לא נמצאו רשומות." />}

        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-parch-300 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold text-wine-700">{row.name}</span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-[0.78rem] text-ink-500">
                  {[row.city, row.extra].filter(Boolean).join(' · ') || 'ללא פרטים'}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {row.token && (
                  <button
                    type="button"
                    onClick={() => copyLink(row.token!)}
                    className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                  >
                    {copied === row.token
                      ? <IconCheck className="h-3 w-3 text-green-700" />
                      : <IconLink className="h-3 w-3" />}
                    {copied === row.token ? 'הועתק' : 'העתקת קישור'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setCreating(row); setLogin(''); setPassword(''); }}
                  className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                >
                  חשבון כניסה
                </button>
                {row.status !== 'published' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(row.id, 'published')}
                    className="btn btn-primary !py-1.5 !text-[0.76rem]"
                  >
                    אישור
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(row.id, 'hidden')}
                    className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                  >
                    הסתרה
                  </button>
                )}
                <ConfirmButton label="קישור חדש" confirmLabel="ליצור" onConfirm={() => rotate(row.id)} />
                <ConfirmButton label="מחיקה" confirmLabel="למחוק" onConfirm={() => remove(row.id)} />
              </div>
            </div>

            {creating?.id === row.id && (
              <div className="mt-4 rounded-lg border border-gold-400 bg-gold-50 p-4">
                <p className="text-[0.82rem] font-bold text-wine-700">
                  פתיחת חשבון לאזור האישי עבור {row.name}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="דוא״ל או טלפון"
                    className="field !py-2 !text-[0.82rem]"
                    dir="ltr"
                  />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="סיסמה"
                    className="field !py-2 !text-[0.82rem]"
                    dir="ltr"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={createUser} className="btn btn-primary !py-2 !text-[0.8rem]">
                      יצירה
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(null)}
                      className="btn btn-quiet !py-2 !text-[0.8rem]"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[0.72rem] text-ink-500">
                  מספר טלפון הופך אוטומטית לשם משתמש. יש למסור את הפרטים לבעל החשבון.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
