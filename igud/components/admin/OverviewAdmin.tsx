'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { EmptyState, Panel, Stat, Toast } from './ui';

interface Counts {
  pending: number;
  published: number;
  teachers: number;
  venues: number;
  requestsNew: number;
  subscribers: number;
  upcoming: number;
}

interface AuditRow {
  id: number;
  actor: string | null;
  action: string;
  entity: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  submit_lesson: 'שיעור נשלח מהאתר',
  import_lessons: 'ייבוא שיעורים',
  import_requests: 'ייבוא פניות',
  create_portal_user: 'נוצר חשבון אזור אישי',
  yemot_build: 'נבנו שלוחות במערכת הקולית',
  nedarim_callback: 'נקלט טופס מנדרים פלוס',
  yemot_lesson: 'שיעור נקלט מהמערכת הקולית',
  yemot_request: 'פנייה נקלטה מהמערכת הקולית',
};

export default function OverviewAdmin({ onJump }: { onJump: (section: string) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const client = browserClient();
      const head = { count: 'exact' as const, head: true };
      const [pending, published, teachers, venues, requests, subs, upcoming, log] = await Promise.all([
        client.from('igud_lessons').select('id', head).eq('status', 'pending'),
        client.from('igud_lessons').select('id', head).eq('status', 'published'),
        client.from('igud_teachers').select('id', head),
        client.from('igud_venues').select('id', head),
        client.from('igud_requests').select('id', head).eq('status', 'new'),
        client.from('igud_subscribers').select('id', head),
        client.from('igud_upcoming').select('lesson_id', head).not('next_at', 'is', null),
        client.from('igud_audit').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      setCounts({
        pending: pending.count ?? 0,
        published: published.count ?? 0,
        teachers: teachers.count ?? 0,
        venues: venues.count ?? 0,
        requestsNew: requests.count ?? 0,
        subscribers: subs.count ?? 0,
        upcoming: upcoming.count ?? 0,
      });
      setAudit((log.data || []) as AuditRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'טעינת הנתונים נכשלה');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5">
      {error && <Toast message={error} tone="error" />}

      <Panel title="מצב המאגר" description="תמונת מצב עדכנית של כל מה שיש במערכת.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button type="button" onClick={() => onJump('pending')} className="text-right">
            <Stat label="ממתינים לאישור" value={counts?.pending ?? '—'} tone={counts?.pending ? 'gold' : 'neutral'} />
          </button>
          <button type="button" onClick={() => onJump('lessons')} className="text-right">
            <Stat label="שיעורים מפורסמים" value={counts?.published ?? '—'} />
          </button>
          <Stat label="מועדים קרובים" value={counts?.upcoming ?? '—'} />
          <button type="button" onClick={() => onJump('requests')} className="text-right">
            <Stat label="פניות חדשות" value={counts?.requestsNew ?? '—'} tone={counts?.requestsNew ? 'gold' : 'neutral'} />
          </button>
          <button type="button" onClick={() => onJump('teachers')} className="text-right">
            <Stat label="מגידי שיעור" value={counts?.teachers ?? '—'} />
          </button>
          <button type="button" onClick={() => onJump('venues')} className="text-right">
            <Stat label="מרכזי תורה" value={counts?.venues ?? '—'} />
          </button>
          <Stat label="נרשמים לעדכונים" value={counts?.subscribers ?? '—'} />
        </div>
      </Panel>

      <Panel title="יומן פעולות" description="עשרים הפעולות האחרונות במערכת.">
        {audit.length === 0 ? (
          <EmptyState text="עדיין אין רישומים ביומן." />
        ) : (
          <ul className="divide-y divide-parch-200">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                <span className="text-[0.82rem] font-bold text-royal-700">
                  {ACTION_LABELS[row.action] || row.action}
                </span>
                <span className="text-[0.78rem] text-ink-500">
                  {Object.entries(row.meta || {})
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                    .join(' · ')}
                </span>
                <span className="mr-auto text-[0.72rem] text-ink-500 tabular-nums" dir="ltr">
                  {new Date(row.created_at).toLocaleString('he-IL')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
