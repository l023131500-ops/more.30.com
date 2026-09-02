'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { SITE } from '@/lib/site';
import { IconCheck, IconCopy, IconLink } from '../Icons';
import { Panel, Toast } from './ui';
import NedarimPanel from './NedarimPanel';
import YemotFiles from './YemotFiles';
import IvrCopyAdmin from './IvrCopyAdmin';

type Group = Record<string, unknown>;
type Settings = Record<string, Group>;

const DEFAULTS: Settings = {
  yemot: { system: '', apiKey: '', password: '', rootExt: '1', enabled: 'false' },
  nedarim: { mosadId: '', apiPassword: '', apiValid: '', callbackSecret: '', forms: {} },
  ai: { apiKey: '', model: 'claude-opus-5' },
  yemotPay: {
    enabled: 'false', provider: '', shop: '', terminal: '',
    userName: '', password: '', currency: '1', maxPayments: '', minAmount: '10',
  },
};

/** קריאת שדה טקסט מתוך קבוצת הגדרות, בלי להניח על הטיפוס. */
const text = (group: Group, field: string) => String(group?.[field] ?? '');

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
          ...(row.value as Group),
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
      const { data: sessionData } = await browserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('פג תוקף ההתחברות. נא להיכנס מחדש.');

      const res = await fetch('/api/yemot/build', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
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
            value={text(settings.yemot, 'system')}
            onChange={(v) => set('yemot', 'system', v)}
            hint="מספר הקו בימות המשיח, לדוגמה 0773137770"
          />
          <Row
            label="מפתח API"
            value={text(settings.yemot, 'apiKey')}
            onChange={(v) => set('yemot', 'apiKey', v)}
            secret
            hint="מפתח ה-API מהגדרות המערכת. אם אין מפתח, אפשר למלא סיסמה בשדה הבא."
          />
          <Row
            label="סיסמת המערכת"
            value={text(settings.yemot, 'password')}
            onChange={(v) => set('yemot', 'password', v)}
            secret
            hint="בשימוש רק אם לא הוגדר מפתח API"
          />
          <Row
            label="שלוחת הבסיס"
            value={text(settings.yemot, 'rootExt')}
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

      <IvrCopyAdmin />

      <YemotFiles rootExt={text(settings.yemot, 'rootExt') || '1'} />

      <NedarimPanel
        settings={settings.nedarim as Record<string, string>}
        forms={(settings.nedarim.forms || {}) as Record<string, Record<string, string>>}
        origin={origin}
        busy={busy}
        onChange={(field, value) => set('nedarim', field, value)}
        onFormChange={(form, field, value) =>
          setSettings((prev) => {
            const forms = (prev.nedarim.forms || {}) as Record<string, Record<string, string>>;
            return {
              ...prev,
              nedarim: {
                ...prev.nedarim,
                forms: { ...forms, [form]: { ...(forms[form] || {}), [field]: value } },
              },
            };
          })}
        onSave={() => void save('nedarim', true)}
        notify={(msg, tone) => {
          if (tone === 'error') { setError(msg); window.setTimeout(() => setError(''), 6000); }
          else { setMessage(msg); window.setTimeout(() => setMessage(''), 4000); }
        }}
      />

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
          <Row label="מפתח API" value={text(settings.ai, 'apiKey')} onChange={(v) => set('ai', 'apiKey', v)} secret />
          <Row label="דגם" value={text(settings.ai, 'model')} onChange={(v) => set('ai', 'model', v)} />
        </div>
      </Panel>

      <Panel
        title="סליקה טלפונית בשלוחה 5"
        description="הערכים נמסרים לימות המשיח, והיא מדברת עם הסולק. הם אינם בקוד, ולכן אפשר להחליף בלי פריסה."
        actions={
          <button type="button" onClick={() => save('yemotPay', true)} disabled={busy} className="btn btn-primary !py-2 !text-[0.82rem]">
            שמירה
          </button>
        }
      >
        <p className="mb-4 rounded-xl border border-royal-300 bg-royal-50 px-4 py-3 text-[0.82rem] leading-relaxed text-royal-700">
          כל עוד <strong>הפעלה</strong> אינה true, שלוחה 5 אומרת שהתרומה בטלפון אינה זמינה
          ומציעה להשאיר פרטים או לשמוע מספר טלפון. זה מכוון: פרמטר שגוי בסליקה אינו תקלה
          שמתגלה בבדיקה אלא תרומה שנכשלת, או כזו שנגבית ואינה מגיעה ליעדה.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row
            label="הפעלה"
            value={text(settings.yemotPay, 'enabled')}
            onChange={(v) => set('yemotPay', 'enabled', v)}
            hint="true להפעלה. כל ערך אחר משאיר את השלוחה במצב הבטוח"
          />
          <Row
            label="שם הסולק"
            value={text(settings.yemotPay, 'provider')}
            onChange={(v) => set('yemotPay', 'provider', v)}
            hint="כפי שימות מכירה אותו, למשל nedarim או tranzila. הערך המדויק נמצא במסך הסליקה של ימות"
          />
          <Row
            label="מספר חנות או פרויקט"
            value={text(settings.yemotPay, 'shop')}
            onChange={(v) => set('yemotPay', 'shop', v)}
            hint="אצל חלק מהסולקים זהו שדה חובה"
          />
          <Row
            label="מספר טרמינל"
            value={text(settings.yemotPay, 'terminal')}
            onChange={(v) => set('yemotPay', 'terminal', v)}
          />
          <Row
            label="שם משתמש אצל הסולק"
            value={text(settings.yemotPay, 'userName')}
            onChange={(v) => set('yemotPay', 'userName', v)}
          />
          <Row
            label="סיסמה אצל הסולק"
            value={text(settings.yemotPay, 'password')}
            onChange={(v) => set('yemotPay', 'password', v)}
            secret
          />
          <Row
            label="מטבע"
            value={text(settings.yemotPay, 'currency')}
            onChange={(v) => set('yemotPay', 'currency', v)}
            hint="1 שקל, 2 דולר"
          />
          <Row
            label="מספר תשלומים"
            value={text(settings.yemotPay, 'maxPayments')}
            onChange={(v) => set('yemotPay', 'maxPayments', v)}
            hint="ריק פירושו שהתורם בוחר בעצמו"
          />
          <Row
            label="סכום מזערי"
            value={text(settings.yemotPay, 'minAmount')}
            onChange={(v) => set('yemotPay', 'minAmount', v)}
            hint="סכום נמוך ממנו נדחה לפני שהשיחה מגיעה לסולק"
          />
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
