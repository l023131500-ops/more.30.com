'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
// מודול xlsx במימוש עצמאי, נטען כ-JavaScript
import { downloadXlsx } from '@/lib/xlsx.js';
import { IconDownload, IconMail, IconPhone } from '../Icons';
import { Badge, ConfirmButton, EmptyState, Panel, Toast } from './ui';

interface SubRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  wants: string[] | null;
  partner: boolean;
  filters: Record<string, unknown>;
  source: string;
  created_at: string;
}

export default function SubscribersAdmin() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_subscribers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (qError) throw new Error(qError.message);
      setRows((data || []) as SubRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    const { error: delError } = await browserClient().from('igud_subscribers').delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    await load();
  };

  const exportAll = () => {
    const header = ['תאריך', 'שם', 'טלפון', 'דוא"ל', 'מעוניין ב', 'שותף להפצה', 'חיפוש', 'מקור'];
    const body = rows.map((r) => [
      r.created_at.slice(0, 10), r.full_name || '', r.phone || '', r.email || '',
      (r.wants || []).join(', '), r.partner ? 'כן' : 'לא',
      String((r.filters as { query?: string })?.query || ''), r.source,
    ]);
    downloadXlsx(
      [{ name: 'נרשמים', rows: [header, ...body] }],
      `איגוד השיעורים - נרשמים ${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <Panel
      title="נרשמים לעדכונים"
      description="אנשים שביקשו לקבל פרטי שיעורים, מהאתר, מהמערכת הקולית או מטופס 4357."
      actions={
        <button type="button" onClick={exportAll} disabled={!rows.length} className="btn btn-quiet !py-2 !text-[0.82rem]">
          <IconDownload className="h-4 w-4" />
          ייצוא לאקסל
        </button>
      }
    >
      <div className="space-y-2">
        {error && <Toast message={error} tone="error" />}
        {busy && <p className="text-sm text-ink-500">טוען...</p>}
        {!busy && rows.length === 0 && <EmptyState text="אין עדיין נרשמים." />}

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-parch-300 bg-white/70 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink-900">{row.full_name || 'ללא שם'}</span>
                {row.partner && <Badge tone="gold">שותף להפצת התורה</Badge>}
                {row.source !== 'web' && <Badge>{row.source}</Badge>}
              </div>
              <p className="flex flex-wrap items-center gap-x-3 text-[0.78rem] text-ink-500">
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
                <span dir="ltr">{new Date(row.created_at).toLocaleDateString('he-IL')}</span>
              </p>
            </div>
            <ConfirmButton label="מחיקה" confirmLabel="למחוק" onConfirm={() => remove(row.id)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
