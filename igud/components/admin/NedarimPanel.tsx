'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { FORM_LAYOUTS, FORM_IDS, type FormId } from '@/lib/nedarim-forms';
import { IconCheck, IconCopy } from '../Icons';
import { Panel } from './ui';
import NedarimInbox from './NedarimInbox';

/**
 * מסך ההתממשקות לנדרים פלוס.
 *
 * שתי דרכים מקבילות להביא רשומות, ושתיהן מתלכדות על אותו מזהה:
 *   • משיכה — האתר פונה לנדרים פלוס ומושך את מה שהצטבר. לא צריך
 *     שום הגדרה אצלם, רק מפתח API.
 *   • callback — נדרים פלוס דוחפים לכאן כל טופס בזמן אמת.
 *
 * "בדיקת השדות" מציגה רשומה אמיתית לצד התוויות הצפויות, כדי לאמת
 * את מספור העמודות לפני סנכרון מלא.
 */

type Settings = Record<string, string>;

interface ProbeField { field: string; label: string; value: string }
interface ProbeResult {
  form: string;
  label: string;
  fieldBase: number;
  empty?: boolean;
  message?: string;
  record?: { id: string; created: string; fields: ProbeField[] };
  parsed?: Record<string, unknown> | null;
}

interface FormOutcome {
  form: string;
  label: string;
  fetched: number;
  lastId: string;
  result?: { added?: number; updated?: number; skipped?: number };
  error?: string;
}

function Row({
  label, value, onChange, hint, secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  secret?: boolean;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        dir="ltr"
        autoComplete="off"
      />
      {hint && <p className="mt-1 text-[0.72rem] text-ink-500">{hint}</p>}
    </div>
  );
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex gap-2">
        <input readOnly value={value} className="field !bg-parch-200" dir="ltr" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch { /* מתעלמים */ }
          }}
          className="btn btn-quiet shrink-0 !py-2"
        >
          {copied ? <IconCheck className="h-4 w-4 text-green-700" /> : <IconCopy className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[0.72rem] text-ink-500">{hint}</p>}
    </div>
  );
}

export default function NedarimPanel({
  settings, forms, origin, busy, onChange, onFormChange, onSave, notify,
}: {
  settings: Settings;
  forms: Record<string, Record<string, string>>;
  origin: string;
  busy: boolean;
  onChange: (field: string, value: string) => void;
  onFormChange: (form: string, field: string, value: string) => void;
  onSave: () => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [working, setWorking] = useState('');
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [outcomes, setOutcomes] = useState<FormOutcome[] | null>(null);

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await browserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('פג תוקף ההתחברות. נא להיכנס מחדש.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const runProbe = async (form: FormId) => {
    setWorking(`probe:${form}`);
    setProbe(null);
    try {
      const res = await fetch('/api/nedarim/probe', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ form, fieldBase: Number(forms[form]?.fieldBase) || 1 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'בדיקת השדות נכשלה');
      setProbe(body as ProbeResult);
      if (body.empty) notify(body.message || 'אין רשומות בטופס');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'בדיקת השדות נכשלה', 'error');
    } finally {
      setWorking('');
    }
  };

  const runPull = async (form?: FormId, reset = false) => {
    setWorking(form ? `pull:${form}` : 'pull:all');
    setOutcomes(null);
    try {
      const res = await fetch('/api/nedarim/pull', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(form ? { form, reset } : { reset }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setOutcomes(body.forms as FormOutcome[]);
      const total = Number(body.fetched || 0);
      notify(
        total ? `נמשכו ${total} רשומות מנדרים פלוס` : 'אין רשומות חדשות בנדרים פלוס',
        body.ok ? 'ok' : 'error',
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : 'המשיכה נכשלה', 'error');
    } finally {
      setWorking('');
    }
  };

  return (
    <>
    <Panel
      title="נדרים פלוס"
      description="קליטת הטפסים שמולאו בעמדות ובאתר, ישירות מהמערכת של נדרים פלוס."
      actions={
        <>
          <button
            type="button" onClick={onSave} disabled={busy}
            className="btn btn-primary !py-2 !text-[0.82rem]"
          >
            שמירה
          </button>
          <button
            type="button" onClick={() => runPull()} disabled={busy || Boolean(working)}
            className="btn btn-gold !py-2 !text-[0.82rem]"
          >
            {working === 'pull:all' ? 'מושך…' : 'סנכרון כל הטפסים'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Row
          label="מספר מוסד (MosadId)"
          value={settings.mosadId || ''}
          onChange={(v) => onChange('mosadId', v)}
          hint="שבע ספרות, כפי שמופיע בממשק נדרים פלוס"
        />
        <Row
          label="מפתח API (ApiPassword)"
          value={settings.apiPassword || ''}
          onChange={(v) => onChange('apiPassword', v)}
          secret
          hint="המפתח מתחיל ב-npk_ ונוצר במסך עוד ← מפתחות API"
        />
        <Row
          label="סיסמת דף התשלום (ApiValid)"
          value={settings.apiValid || ''}
          onChange={(v) => onChange('apiValid', v)}
          secret
          hint="שייכת לדף התשלום ולאייפרם בלבד. משיכת הטפסים אינה משתמשת בה."
        />
        <Row
          label="סוד ה-callback"
          value={settings.callbackSecret || ''}
          onChange={(v) => onChange('callbackSecret', v)}
          secret
          hint="מחרוזת שתימסר לנדרים פלוס ותיבדק בכל פנייה נכנסת"
        />
      </div>

      {/* ------- הטפסים ------- */}
      <div className="mt-6 border-t border-parch-200 pt-5">
        <h4 className="mb-1 text-[0.95rem] font-semibold text-ink-800">הטפסים במאגר</h4>
        <p className="mb-4 text-[0.78rem] text-ink-500">
          כל סנכרון מביא רק את מה שנוסף מאז הפעם הקודמת. הסמן הוא מזהה הרשומה
          האחרונה שנקלטה, ואפשר לאפס אותו כדי למשוך הכול מחדש.
        </p>

        <div className="space-y-3">
          {FORM_IDS.map((form) => {
            const layout = FORM_LAYOUTS[form];
            const config = forms[form] || {};
            const isOff = config.enabled === 'false';
            return (
              <div
                key={form}
                className="rounded-xl border border-parch-200 bg-parch-50 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.9rem] font-semibold text-ink-800">
                      טופס {form} — {layout.label}
                    </p>
                    <p className="mt-0.5 text-[0.74rem] text-ink-500">
                      {layout.fieldLabels.length} שדות · סמן אחרון: {config.lastId || '0'}
                      {config.lastSyncAt
                        ? ` · סונכרן ${new Date(config.lastSyncAt).toLocaleString('he-IL')}`
                        : ' · טרם סונכרן'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 text-[0.78rem] text-ink-600">
                      <input
                        type="checkbox"
                        checked={!isOff}
                        onChange={(e) => onFormChange(form, 'enabled', e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4 accent-royal-700"
                      />
                      פעיל
                    </label>
                    <button
                      type="button"
                      onClick={() => runProbe(form)}
                      disabled={busy || Boolean(working)}
                      className="btn btn-quiet !px-3 !py-1.5 !text-[0.76rem]"
                    >
                      {working === `probe:${form}` ? 'בודק…' : 'בדיקת שדות'}
                    </button>
                    <button
                      type="button"
                      onClick={() => runPull(form)}
                      disabled={busy || Boolean(working)}
                      className="btn btn-quiet !px-3 !py-1.5 !text-[0.76rem]"
                    >
                      {working === `pull:${form}` ? 'מושך…' : 'משיכה'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`למשוך מחדש את כל רשומות טופס ${form} מההתחלה?`)) {
                          void runPull(form, true);
                        }
                      }}
                      disabled={busy || Boolean(working)}
                      className="btn btn-quiet !px-3 !py-1.5 !text-[0.76rem]"
                    >
                      איפוס ומשיכה
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="field-label !text-[0.72rem]">סמן אחרון (LastId)</label>
                    <input
                      value={config.lastId || '0'}
                      onChange={(e) => onFormChange(form, 'lastId', e.target.value)}
                      className="field !py-1.5 !text-[0.82rem]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="field-label !text-[0.72rem]">מספר השדה הראשון</label>
                    <input
                      value={config.fieldBase || '1'}
                      onChange={(e) => onFormChange(form, 'fieldBase', e.target.value)}
                      className="field !py-1.5 !text-[0.82rem]"
                      dir="ltr"
                    />
                    <p className="mt-1 text-[0.7rem] text-ink-500">
                      משנים רק אם בדיקת השדות מראה שהערכים מוסטים
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------- תוצאות המשיכה ------- */}
      {outcomes && outcomes.length > 0 && (
        <div className="mt-5 rounded-xl border border-parch-200 bg-white p-4">
          <h4 className="mb-2 text-[0.9rem] font-semibold text-ink-800">תוצאות הסנכרון</h4>
          <ul className="space-y-1.5 text-[0.82rem]">
            {outcomes.map((o) => (
              <li key={o.form} className={o.error ? 'text-red-700' : 'text-ink-700'}>
                <span className="font-semibold">טופס {o.form}</span>
                {' — '}
                {o.error
                  ? o.error
                  : `${o.fetched} רשומות התקבלו · נוספו ${o.result?.added ?? 0}, `
                    + `עודכנו ${o.result?.updated ?? 0}, דולגו ${o.result?.skipped ?? 0}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------- בדיקת השדות ------- */}
      {probe?.record && (
        <div className="mt-5 rounded-xl border border-parch-200 bg-white p-4">
          <h4 className="text-[0.9rem] font-semibold text-ink-800">
            טופס {probe.form} — הרשומה האחרונה (מזהה {probe.record.id})
          </h4>
          <p className="mt-0.5 mb-3 text-[0.76rem] text-ink-500">
            אם התוויות והערכים מתאימים זה לזה, המספור נכון וניתן לסנכרן.
            אחרת יש לשנות את "מספר השדה הראשון" ולבדוק שוב.
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-parch-200">
            <table className="w-full text-right text-[0.78rem]">
              <thead className="sticky top-0 bg-parch-100 text-ink-600">
                <tr>
                  <th className="px-2 py-1.5 font-medium">עמודה</th>
                  <th className="px-2 py-1.5 font-medium">התווית הצפויה</th>
                  <th className="px-2 py-1.5 font-medium">הערך שהתקבל</th>
                </tr>
              </thead>
              <tbody>
                {probe.record.fields.map((f) => (
                  <tr key={f.field} className="border-t border-parch-100">
                    <td className="px-2 py-1 font-mono text-[0.72rem] text-ink-500" dir="ltr">{f.field}</td>
                    <td className="px-2 py-1 text-ink-600">{f.label}</td>
                    <td className="px-2 py-1 text-ink-800">{f.value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------- הכתובת שנמסרת לנדרים פלוס ------- */}
      <div className="mt-5 space-y-3 border-t border-parch-200 pt-5">
        <h4 className="text-[0.95rem] font-semibold text-ink-800">הכתובת שמוסרים לנדרים פלוס</h4>
        <p className="text-[0.78rem] text-ink-500">
          כתובת אחת לשני הכיוונים. הסוד מוטמע בה, ולכן אין צורך בכותרות מיוחדות —
          מספיק להעתיק ולמסור כמו שהיא.
        </p>
        <CopyField
          label="כתובת ה-webhook"
          value={`${origin}/api/nedarim/webhook?key=${settings.callbackSecret || '<הסוד>'}`}
          hint="הם שולחים לכאן POST עם JSON, ומקבלים בחזרה תשובה באותה כתובת"
        />
        <CopyField
          label="כתובת בדיקת חיים"
          value={`${origin}/api/nedarim/webhook?ping=1`}
          hint="מחזירה את רשימת הסוגים הנתמכים ואת שלוש עשרה העמודות, בלי לכתוב דבר"
        />
        <p className="text-[0.76rem] text-ink-500">
          הכתובת הישנה <code dir="ltr">/api/nedarim/callback</code> ממשיכה לעבוד,
          ומפנה לאותו טיפול בדיוק.
        </p>
      </div>
    </Panel>

    <NedarimInbox />
    </>
  );
}
