'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { Panel } from './ui';

/**
 * תיבת הפניות מנדרים פלוס.
 *
 * כל פנייה נשמרת גולמית לפני שנעשה בה משהו, ולכן המסך הזה הוא גם
 * יומן וגם רשת ביטחון: אם פירוק כלשהו נכשל, הנתונים עדיין כאן
 * ואפשר לראות בדיוק מה נשלח.
 */

interface Submission {
  id: string;
  type: string | null;
  status: string;
  error: string | null;
  entity: string | null;
  entity_id: string | null;
  raw_data: Record<string, unknown>;
  parsed: unknown;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  received: 'התקבלה',
  stored: 'נקלטה',
  unhandled: 'סוג לא מוכר',
  error: 'שגיאה',
};

const TYPE_LABEL: Record<string, string> = {
  lesson_update: 'עדכון שיעור',
  lesson: 'שיעור חדש',
  seeker_request: 'מחפשים שיעור',
  teacher_request: 'מגיד שיעור',
  subscriber: 'הרשמה לעדכונים',
};

function StatusChip({ status }: { status: string }) {
  const tone = status === 'stored'
    ? 'bg-green-50 text-green-800 border-green-200'
    : status === 'error'
      ? 'bg-red-50 text-red-800 border-red-200'
      : 'bg-parch-100 text-ink-600 border-parch-300';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${tone}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function NedarimInbox() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_nedarim_submissions')
        .select('id, type, status, error, entity, entity_id, raw_data, parsed, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (qError) throw new Error(qError.message);
      setRows((data || []) as Submission[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** התוויות שנדרים פלוס שלחו, כפי שהתקבלו. */
  const labelsOf = (raw: Record<string, unknown>) => {
    const out: [string, string][] = [];
    for (const [key, value] of Object.entries(raw)) {
      const named = /^Field(\d+)_Name$/.exec(key);
      if (!named) continue;
      const val = raw[`Field${named[1]}`];
      out.push([String(value), val === undefined || val === null ? '' : String(val)]);
    }
    return out;
  };

  return (
    <Panel
      title="פניות מנדרים פלוס"
      description="מאה הפניות האחרונות שהתקבלו בכתובת ה-webhook, כולל הגוף המלא כפי שנשלח."
      actions={
        <button type="button" onClick={() => void load()} disabled={busy}
          className="btn btn-quiet !py-2 !text-[0.82rem]">
          רענון
        </button>
      }
    >
      {error && <p className="mb-3 text-[0.85rem] text-red-700">{error}</p>}

      {!rows.length && !busy && (
        <p className="py-6 text-center text-[0.88rem] text-ink-500">
          עדיין לא התקבלו פניות. אחרי שנדרים פלוס יתחילו לשלוח, הן יופיעו כאן.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => {
          const labels = labelsOf(row.raw_data || {});
          const isOpen = open === row.id;
          return (
            <div key={row.id} className="rounded-xl border border-parch-200 bg-parch-50">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : row.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-right"
              >
                <span className="min-w-0">
                  <span className="block text-[0.88rem] font-semibold text-ink-800">
                    {TYPE_LABEL[row.type || ''] || row.type || 'ללא סוג'}
                  </span>
                  <span className="block text-[0.74rem] text-ink-500">
                    {new Date(row.created_at).toLocaleString('he-IL')}
                    {row.error ? ` · ${row.error}` : ''}
                  </span>
                </span>
                <StatusChip status={row.status} />
              </button>

              {isOpen && (
                <div className="border-t border-parch-200 p-3">
                  {labels.length > 0 && (
                    <table className="mb-3 w-full text-right text-[0.78rem]">
                      <thead className="text-ink-500">
                        <tr>
                          <th className="pb-1 font-medium">התווית שנשלחה</th>
                          <th className="pb-1 font-medium">הערך</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-parch-200">
                        {labels.map(([label, value], i) => (
                          <tr key={`${label}-${i}`}>
                            <td className="py-1 text-ink-600">{label}</td>
                            <td className="py-1 text-ink-800">{value || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <details>
                    <summary className="cursor-pointer text-[0.78rem] text-ink-500">
                      הגוף המלא כפי שהתקבל
                    </summary>
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 text-[0.72rem] leading-relaxed"
                    >
                      {JSON.stringify(row.raw_data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
