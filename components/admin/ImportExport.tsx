'use client';

import { useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase';
// מודול xlsx במימוש עצמאי, נטען כ-JavaScript
import { readXlsx, downloadXlsx } from '@/lib/xlsx.js';
import {
  detectForm, parse4018, parse4063, parse4320, parse4357,
} from '@/lib/nedarim.js';
import { IconDownload, IconImage } from '../Icons';
import { Panel, Toast } from './ui';

const FORM_NAMES: Record<string, string> = {
  4320: 'עדכון שיעור לפרסום',
  4063: 'בקשה למגיד שיעור',
  4018: 'רישום כמגיד שיעור',
  4357: 'חיפוש שיעור והרשמה לעדכונים',
};

interface Preview {
  form: string;
  count: number;
  publishable: number;
  rows: unknown[];
  fileName: string;
}

export default function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pick = async (file: File) => {
    setError('');
    setMessage('');
    setPreview(null);
    setBusy(true);
    try {
      const sheets = await readXlsx(file);
      const rows = sheets?.[0]?.rows || [];
      const form = detectForm(rows);
      if (!form || !FORM_NAMES[form]) {
        throw new Error('לא זוהה מספר טופס בכותרת הגיליון. נדרש ייצוא של טופס 4320, 4063, 4018 או 4357.');
      }

      let parsed: unknown[] = [];
      if (form === '4320') parsed = parse4320(rows);
      else if (form === '4063') parsed = parse4063(rows);
      else if (form === '4018') parsed = parse4018(rows);
      else if (form === '4357') parsed = parse4357(rows);

      setPreview({
        form,
        count: parsed.length,
        publishable: parsed.filter((r) => (r as { publishable?: boolean }).publishable).length,
        rows: parsed,
        fileName: file.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'קריאת הקובץ נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const client = browserClient();
      let result: Record<string, number> = {};

      if (preview.form === '4320') {
        const { data, error: rpcError } = await client.rpc('igud_import_lessons', {
          payload: preview.rows, p_publish: publish,
        });
        if (rpcError) throw new Error(rpcError.message);
        result = data as Record<string, number>;
        setMessage(
          `נוספו ${result.added} שיעורים, עודכנו ${result.updated}, דולגו ${result.skipped}.` +
          (publish ? '' : ' כל השיעורים ממתינים לאישור.'),
        );
      } else if (preview.form === '4357') {
        const { data, error: rpcError } = await client.rpc('igud_import_subscribers', {
          payload: preview.rows,
        });
        if (rpcError) throw new Error(rpcError.message);
        result = data as Record<string, number>;
        setMessage(`נוספו ${result.added} נרשמים, דולגו ${result.skipped}.`);
      } else {
        const kind = preview.form === '4063' ? 'open_lesson' : 'maggid';
        const { data, error: rpcError } = await client.rpc('igud_import_requests', {
          p_kind: kind, payload: preview.rows,
        });
        if (rpcError) throw new Error(rpcError.message);
        result = data as Record<string, number>;
        setMessage(`נוספו ${result.added} פניות, דולגו ${result.skipped}.`);
      }

      await client.from('igud_imports').insert({
        filename: preview.fileName,
        form_code: preview.form,
        rows_total: preview.count,
        rows_ok: result.added || 0,
        rows_skip: result.skipped || 0,
        report: result,
      });

      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הייבוא נכשל');
    } finally {
      setBusy(false);
    }
  };

  const exportLessons = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_lessons')
        .select('*, occurrences:igud_occurrences(day_label, time_of_day, specific_date, time_slot)')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (qError) throw new Error(qError.message);

      const header = [
        'מזהה', 'מספר', 'סטטוס', 'כותרת', 'נושא ראשי', 'נושאים', 'שם הרב', 'ארגון',
        'שם המקום', 'עיר', 'שכונה', 'רחוב', 'מספר בית', 'מיקום מדויק',
        'סוג לוח זמנים', 'מועדים', 'קהל', 'סגנון קהל', 'שפה', 'סגנון השיעור',
        'שידור', 'איש קשר', 'טלפון', 'דוא"ל', 'מקור', 'נוצר בתאריך',
      ];

      const rows = (data || []).map((raw) => {
        const l = raw as Record<string, unknown>;
        const occ = (l.occurrences as Record<string, string>[] | null) || [];
        return [
          l.id, l.public_no, l.status, l.title, l.topic,
          (l.topics as string[] | null)?.join(', '),
          l.teacher_name, l.organization, l.venue_name, l.city, l.neighborhood,
          l.street, l.house_no, l.location_exact, l.schedule_kind,
          occ.map((o) => `${o.day_label || o.specific_date || ''} ${(o.time_of_day || '').slice(0, 5) || o.time_slot || ''}`.trim()).join(' | '),
          l.audience_gender,
          (l.audience_styles as string[] | null)?.join(', '),
          l.language, l.lesson_style, l.broadcast,
          l.contact_name, l.contact_phone, l.contact_email, l.source,
          String(l.created_at || '').slice(0, 10),
        ].map((v) => (v === null || v === undefined ? '' : String(v)));
      });

      downloadXlsx(
        [{ name: 'שיעורים', rows: [header, ...rows] }],
        `איגוד השיעורים - שיעורים ${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      setMessage(`יוצאו ${rows.length} שיעורים.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הייצוא נכשל');
    } finally {
      setBusy(false);
    }
  };

  const exportRequests = async (kind: 'open_lesson' | 'maggid') => {
    setBusy(true);
    setError('');
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_requests')
        .select('*')
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (qError) throw new Error(qError.message);

      const keys = new Set<string>();
      for (const row of data || []) {
        for (const key of Object.keys((row.payload as Record<string, unknown>) || {})) keys.add(key);
      }
      const extra = [...keys];
      const header = ['מזהה', 'תאריך', 'סטטוס', 'שם', 'טלפון', 'דוא"ל', 'עיר', ...extra];

      const rows = (data || []).map((raw) => {
        const r = raw as Record<string, unknown>;
        const payload = (r.payload as Record<string, unknown>) || {};
        return [
          r.id, String(r.created_at || '').slice(0, 10), r.status,
          r.contact_name, r.phone, r.email, r.city,
          ...extra.map((k) => {
            const v = payload[k];
            return Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ') : v;
          }),
        ].map((v) => (v === null || v === undefined ? '' : String(v)));
      });

      downloadXlsx(
        [{ name: kind === 'open_lesson' ? 'בקשות לשיעור' : 'מגידי שיעור', rows: [header, ...rows] }],
        `איגוד השיעורים - ${kind === 'open_lesson' ? 'בקשות' : 'מגידי שיעור'} ${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      setMessage(`יוצאו ${rows.length} רשומות.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הייצוא נכשל');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel
        title="ייבוא מקובץ אקסל"
        description="קליטת ייצוא של טפסי נדרים פלוס. המערכת מזהה את מספר הטופס לבד."
      >
        <div className="space-y-4">
          {message && <Toast message={message} />}
          {error && <Toast message={error} tone="error" />}

          <div className="rounded-xl border border-dashed border-parch-300 bg-white/60 p-6 text-center">
            <IconImage className="mx-auto h-7 w-7 text-gold-600" />
            <p className="mt-2 text-sm text-ink-700">
              בוחרים קובץ xlsx שיוצא ממערכת נדרים פלוס
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-500">
              נתמכים: טופס 4320 (שיעורים), 4063 (בקשות), 4018 (מגידי שיעור), 4357 (נרשמים)
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn btn-primary mt-4"
            >
              {busy ? 'קורא...' : 'בחירת קובץ'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file);
                e.target.value = '';
              }}
            />
          </div>

          {preview && (
            <div className="rounded-xl border border-gold-400 bg-gold-50 p-5">
              <h3 className="font-display text-base font-bold text-wine-700">
                טופס {preview.form} · {FORM_NAMES[preview.form]}
              </h3>
              <p className="mt-1 text-sm text-ink-700">
                נמצאו {preview.count} רשומות בקובץ {preview.fileName}
                {preview.form === '4320' && (
                  <> · {preview.publishable} מהן עברו את בדיקת האיכות</>
                )}
              </p>

              {preview.form === '4320' && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(e) => setPublish(e.target.checked)}
                    className="h-4 w-4 accent-[#4A1818]"
                  />
                  לפרסם מיד רשומות שעברו את בדיקת האיכות
                </label>
              )}

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={runImport} disabled={busy} className="btn btn-primary">
                  {busy ? 'מייבא...' : 'ייבוא למסד'}
                </button>
                <button type="button" onClick={() => setPreview(null)} className="btn btn-quiet">
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="ייצוא לאקסל" description="הורדת הנתונים לקובץ xlsx לצורך גיבוי או עבודה חיצונית.">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportLessons} disabled={busy} className="btn btn-quiet">
            <IconDownload className="h-4 w-4" />
            כל השיעורים
          </button>
          <button type="button" onClick={() => exportRequests('open_lesson')} disabled={busy} className="btn btn-quiet">
            <IconDownload className="h-4 w-4" />
            בקשות לפתיחת שיעור
          </button>
          <button type="button" onClick={() => exportRequests('maggid')} disabled={busy} className="btn btn-quiet">
            <IconDownload className="h-4 w-4" />
            רישום מגידי שיעור
          </button>
        </div>
      </Panel>
    </div>
  );
}
