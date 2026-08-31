'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { SITE } from '@/lib/site';
import { IconCheck, IconCopy, IconLink } from '../Icons';
import { Panel, Toast } from './ui';

type Settings = Record<string, Record<string, string>>;

const DEFAULTS: Settings = {
  yemot: { system: '', apiKey: '', password: '', rootExt: '1', enabled: 'false' },
  nedarim: { mosadId: '', apiValid: '', apiKey: '', callbackSecret: '', formIds: '4320,4063,4018,4357' },
  ai: { apiKey: '', model: 'claude-opus-5' },
};

function Row({
  label, value, onChange, hint, secret, dir = 'ltr',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  secret?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        dir={dir}
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

export default function SettingsAdmin() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState(SITE.url);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error: qError } = await browserClient().from('igud_settings').select('key, value');
      if (qError) throw new Error(qError.message);
      const next = { ...DEFAULTS };
      for (const row of data || []) {
        next[row.key as string] = {
          ...(DEFAULTS[row.key as string] || {}),
          ...(row.value as Record<string, string>),
        };
      }
      setSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'טעינת ההגדרות נכשלה');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const set = (group: string, field: string, value: string) =>
    setSettings((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }));

  const save = async (group: string, secret: boolean) => {
    setBusy(true);
    setError('');
    try {
      const { error: upError } = await browserClient().from('igud_settings').upsert({
        key: group,
        value: settings[group],
        secret,
        updated_at: new Date().toISOString(),
      });
      if (upError) throw new Error(upError.message);
      setMessage('ההגדרות נשמרו');
      window.setTimeout(() => setMessage(''), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const buildIvr = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/yemot/build', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'בניית השלוחות נכשלה');
      setMessage(
        `נבנו ${body.created} שלוחות תחת שלוחה ${body.root}: ` +
        '1 חיפוש שיעור, 2 עדכון שיעור, 3 הצטרפות כמגיד שיעור, 4 פתיחת שיעור חדש.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'בניית השלוחות נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {message && <Toast message={message} />}
      {error && <Toast message={error} tone="error" />}

      <Panel
        title="ימות המשיח — המערכת הקולית"
        description="חיבור המאגר לקו הטלפוני. אחרי שמירת המפתח אפשר לבנות את השלוחות אוטומטית."
        actions={
          <>
            <button type="button" onClick={() => save('yemot', true)} disabled={busy} className="btn btn-primary !py-2 !text-[0.82rem]">
              שמירה
            </button>
            <button type="button" onClick={buildIvr} disabled={busy} className="btn btn-gold !py-2 !text-[0.82rem]">
              בניית השלוחות
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Row
            label="מספר המערכת"
            value={settings.yemot.system}
            onChange={(v) => set('yemot', 'system', v)}
            hint="מספר הקו בימות המשיח, לדוגמה 0773137770"
          />
          <Row
            label="מפתח API"
            value={settings.yemot.apiKey}
            onChange={(v) => set('yemot', 'apiKey', v)}
            secret
            hint="מפתח ה-API מהגדרות המערכת. אם אין מפתח, אפשר למלא סיסמה בשדה הבא."
          />
          <Row
            label="סיסמת המערכת"
            value={settings.yemot.password}
            onChange={(v) => set('yemot', 'password', v)}
            secret
            hint="בשימוש רק אם לא הוגדר מפתח API"
          />
          <Row
            label="שלוחת הבסיס"
            value={settings.yemot.rootExt}
            onChange={(v) => set('yemot', 'rootExt', v)}
            hint="השלוחה שתחתיה ייבנו התפריטים. כל כתיבה מוגבלת לשלוחה הזו בלבד."
          />
        </div>

        <div className="mt-5 space-y-3 border-t border-parch-200 pt-5">
          <CopyField
            label="כתובת ה-API לחיפוש שיעור (שלוחה 1)"
            value={`${origin}/api/yemot/search`}
            hint="מוגדרת בקובץ ext.ini של השלוחה כ-type=api"
          />
          <CopyField
            label="כתובת ה-API לעדכון שיעור (שלוחה 2)"
            value={`${origin}/api/yemot/update`}
          />
          <CopyField
            label="כתובת ה-API להצטרפות כמגיד שיעור (שלוחה 3)"
            value={`${origin}/api/yemot/maggid`}
          />
          <CopyField
            label="כתובת ה-API לפתיחת שיעור חדש (שלוחה 4)"
            value={`${origin}/api/yemot/host`}
          />
          <CopyField
            label="סוכן קולי חכם"
            value={`${origin}/api/yemot/agent`}
            hint="שלוחה שמקבלת דיבור חופשי ומחפשת או מעדכנת שיעור"
          />
        </div>
      </Panel>

      <Panel
        title="נדרים פלוס"
        description="קליטת טפסים שמולאו בעמדות, ופרסום שיעורים חזרה למערכת."
        actions={
          <button type="button" onClick={() => save('nedarim', true)} disabled={busy} className="btn btn-primary !py-2 !text-[0.82rem]">
            שמירה
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="מספר מוסד" value={settings.nedarim.mosadId} onChange={(v) => set('nedarim', 'mosadId', v)} />
          <Row label="ApiValid" value={settings.nedarim.apiValid} onChange={(v) => set('nedarim', 'apiValid', v)} secret />
          <Row label="מפתח API" value={settings.nedarim.apiKey} onChange={(v) => set('nedarim', 'apiKey', v)} secret />
          <Row
            label="סוד ה-callback"
            value={settings.nedarim.callbackSecret}
            onChange={(v) => set('nedarim', 'callbackSecret', v)}
            secret
            hint="מחרוזת שתימסר לנדרים פלוס ותיבדק בכל פנייה"
          />
          <Row
            label="מספרי הטפסים"
            value={settings.nedarim.formIds}
            onChange={(v) => set('nedarim', 'formIds', v)}
            hint="מופרדים בפסיק"
          />
        </div>

        <div className="mt-5 space-y-3 border-t border-parch-200 pt-5">
          <CopyField
            label="כתובת ה-callback למסירה לנדרים פלוס"
            value={`${origin}/api/nedarim/callback`}
            hint="נדרים פלוס שולחים לכאן כל טופס שמולא. יש לצרף את הסוד בכותרת x-igud-secret או בשדה secret."
          />
          <CopyField
            label="כתובת בדיקה"
            value={`${origin}/api/nedarim/callback?ping=1`}
            hint="פנייה לכתובת הזו מחזירה אישור חיים בלי לכתוב נתונים"
          />
        </div>
      </Panel>

      <Panel
        title="סוכן AI קולי"
        description="מאפשר חיפוש ועדכון בדיבור חופשי. ללא מפתח, החיפוש עובד בהתאמת מילים."
        actions={
          <button type="button" onClick={() => save('ai', true)} disabled={busy} className="btn btn-primary !py-2 !text-[0.82rem]">
            שמירה
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="מפתח API" value={settings.ai.apiKey} onChange={(v) => set('ai', 'apiKey', v)} secret />
          <Row label="דגם" value={settings.ai.model} onChange={(v) => set('ai', 'model', v)} />
        </div>
      </Panel>

      <Panel title="ממשק ציבורי" description="כתובות פתוחות לשילוב באתרים ובאפליקציות אחרות.">
        <div className="space-y-3">
          <CopyField label="רשימת שיעורים" value={`${origin}/api/public/lessons`} />
          <CopyField label="שיעורים קרובים" value={`${origin}/api/public/upcoming`} />
          <CopyField label="רשימות בחירה" value={`${origin}/api/public/taxonomy`} />
          <CopyField label="תיעוד מלא" value={`${origin}/api-docs`} />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[0.78rem] text-ink-500">
          <IconLink className="h-3.5 w-3.5 text-gold-600" />
          הממשק פתוח לקריאה בלבד, ומחזיר רק שיעורים שאושרו לפרסום.
        </p>
      </Panel>
    </div>
  );
}
