'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { IconChevronDown, IconMail, IconPhone } from '../Icons';
import { ConfirmButton, EmptyState, Panel, StatusBadge, Toast } from './ui';

interface RequestRow {
  id: string;
  kind: 'open_lesson' | 'maggid';
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  payload: Record<string, unknown>;
  status: string;
  admin_note: string | null;
  source: string;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  requesterType: 'עבור מי',
  neighborhood: 'שכונה',
  street: 'רחוב',
  locationExact: 'מיקום מדויק',
  synagogueName: 'שם בית הכנסת',
  gabbaiName: 'גבאי או רב',
  nusach: 'נוסח',
  congregants: 'כמות מתפללים',
  activityLevel: 'רמת פעילות',
  activityDetail: 'פירוט הפעילות',
  existingLessons: 'שיעורים קיימים',
  needsServices: 'שירותי דת נוספים',
  religiousServices: 'אילו שירותים',
  familyStyle: 'סגנון המשפחה',
  audienceGender: 'קהל',
  language: 'שפה',
  languages: 'שפות',
  languageOther: 'שפה אחרת',
  audienceStyles: 'סגנון הלומדים',
  topics: 'נושאים',
  topicOther: 'נושא אחר',
  rabbiBackground: 'רקע מגיד השיעור',
  lessonCharacter: 'אופי השיעור',
  speechStyle: 'סגנון דיבור',
  venueTypes: 'מקומות',
  frequency: 'קביעות',
  preferredDays: 'ימים מועדפים',
  preferredSlots: 'שעות מועדפות',
  availabilityNote: 'פירוט זמינות',
  date: 'תאריך',
  time: 'שעה',
  payerOffer: 'תשלום מוצע',
  payExpectation: 'ציפיית תגמול',
  travelRange: 'טווח נסיעה',
  travel: 'אופן ניידות',
  birthDate: 'תאריך לידה',
  maritalStatus: 'מצב אישי',
  pastYeshiva: 'מקום לימודים',
  background: 'רקע',
  occupation: 'עיסוק',
  occupationOther: 'עיסוק אחר',
  hasTraining: 'הכשרה תורנית',
  hasPublicSpeaking: 'ניסיון בציבור',
  extraSkills: 'כישורים נוספים',
  extraSkillsOther: 'כישורים אחרים',
  references: 'ממליצים',
  notes: 'הערות',
};

function renderValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object') {
      return value
        .map((v) => Object.values(v as Record<string, unknown>).filter(Boolean).join(' · '))
        .join(' | ');
    }
    return value.join(', ');
  }
  return String(value ?? '');
}

export default function RequestsAdmin({ kind }: { kind: 'open_lesson' | 'maggid' }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      let query = browserClient()
        .from('igud_requests')
        .select('*')
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(300);
      if (status) query = query.eq('status', status);

      const { data, error: qError } = await query;
      if (qError) throw new Error(qError.message);
      setRows((data || []) as RequestRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, [kind, status]);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, patch: Partial<RequestRow>) => {
    const { error: upError } = await browserClient().from('igud_requests').update(patch).eq('id', id);
    if (upError) { setError(upError.message); return; }
    setMessage('עודכן');
    window.setTimeout(() => setMessage(''), 2200);
    await load();
  };

  const remove = async (id: string) => {
    const { error: delError } = await browserClient().from('igud_requests').delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    await load();
  };

  return (
    <Panel
      title={kind === 'open_lesson' ? 'בקשות לפתיחת שיעור' : 'רישום מגידי שיעור'}
      description={
        kind === 'open_lesson'
          ? 'מקומות שמחפשים מגיד שיעור. טופס 4063.'
          : 'רבנים שמחפשים מקום למסור בו שיעור. טופס 4018.'
      }
      actions={
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="field !w-auto !py-2 !text-[0.82rem]"
        >
          <option value="">כל הפניות</option>
          <option value="new">חדשות</option>
          <option value="in_progress">בטיפול</option>
          <option value="matched">שודכו</option>
          <option value="closed">סגורות</option>
          <option value="spam">זבל</option>
        </select>
      }
    >
      <div className="space-y-3">
        {message && <Toast message={message} />}
        {error && <Toast message={error} tone="error" />}
        {busy && <p className="text-sm text-ink-500">טוען...</p>}
        {!busy && rows.length === 0 && <EmptyState text="אין פניות להצגה." />}

        {rows.map((row) => {
          const entries = Object.entries(row.payload || {})
            .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));

          return (
            <article key={row.id} className="rounded-xl border border-parch-300 bg-white/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold text-wine-700">
                      {row.contact_name || 'ללא שם'}
                    </h3>
                    <StatusBadge status={row.status} />
                    {row.source !== 'web' && (
                      <span className="rounded-full border border-parch-300 bg-parch-200 px-2 py-0.5 text-[0.64rem] text-ink-500">
                        {row.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.8rem] text-ink-500">
                    {row.phone && (
                      <a href={`tel:${row.phone}`} className="flex items-center gap-1 font-bold text-wine-600" dir="ltr">
                        <IconPhone className="h-3 w-3" />
                        {row.phone}
                      </a>
                    )}
                    {row.email && (
                      <a href={`mailto:${row.email}`} className="flex items-center gap-1" dir="ltr">
                        <IconMail className="h-3 w-3" />
                        {row.email}
                      </a>
                    )}
                    {row.city && <span>{row.city}</span>}
                    <span dir="ltr">
                      {new Date(row.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <select
                    value={row.status}
                    onChange={(e) => update(row.id, { status: e.target.value })}
                    className="field !w-auto !py-1.5 !text-[0.76rem]"
                  >
                    <option value="new">חדש</option>
                    <option value="in_progress">בטיפול</option>
                    <option value="matched">שודך</option>
                    <option value="closed">סגור</option>
                    <option value="spam">זבל</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setOpen(open === row.id ? null : row.id)}
                    className="btn btn-quiet !py-1.5 !text-[0.76rem]"
                  >
                    <IconChevronDown className={`h-3 w-3 transition-transform ${open === row.id ? 'rotate-180' : ''}`} />
                    {open === row.id ? 'סגירה' : 'כל הפרטים'}
                  </button>
                  <ConfirmButton label="מחיקה" confirmLabel="למחוק" onConfirm={() => remove(row.id)} />
                </div>
              </div>

              {open === row.id && (
                <div className="mt-4 border-t border-parch-200 pt-4">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {entries.map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-[0.82rem]">
                        <dt className="shrink-0 font-bold text-ink-500">
                          {FIELD_LABELS[key] || key}:
                        </dt>
                        <dd className="min-w-0 text-ink-900">{renderValue(value)}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4">
                    <label className="field-label" htmlFor={`note-${row.id}`}>הערת טיפול</label>
                    <textarea
                      id={`note-${row.id}`}
                      defaultValue={row.admin_note || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (row.admin_note || '')) {
                          void update(row.id, { admin_note: e.target.value });
                        }
                      }}
                      rows={2}
                      className="field"
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
