import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase';
import { NedarimError, fetchFormRecords } from '@/lib/nedarim-api';
import {
  FORM_IDS, fieldsFor, layoutOf, parseRecords, type FormId, type FormLayout,
} from '@/lib/nedarim-forms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * משיכת רשומות הטפסים מנדרים פלוס.
 *
 * זו הדרך הרשמית לקבל את מה שמולא בעמדות: פנייה אל
 * Forms/Manage.aspx עם Action=GetJson, מספר המוסד ומפתח ה-API.
 * הפנייה מתקדמת בעזרת סמן LastId — בכל סנכרון נמשכות רק רשומות
 * חדשות, והסמן נשמר בהגדרות.
 *
 * ה-callback ממשיך לעבוד במקביל, ושתי הדרכים מתלכדות: המזהה של
 * הרשומה בנדרים פלוס משמש מפתח ייחודי, ולכן רשומה שכבר נקלטה
 * מתעדכנת ואינה נכפלת.
 */

interface FormConfig {
  kind?: string;
  label?: string;
  lastId?: string;
  fieldBase?: string | number;
  enabled?: string | boolean;
  lastSyncAt?: string;
  lastCount?: number;
}

interface NedarimSettings {
  mosadId?: string;
  apiPassword?: string;
  apiKey?: string;
  forms?: Record<string, FormConfig>;
}

interface FormOutcome {
  form: FormId;
  label: string;
  fetched: number;
  lastId: string;
  result?: Record<string, unknown>;
  error?: string;
}

const enabled = (value: unknown) => value !== false && value !== 'false';

/** קליטת הרשומות המנותחות אל המסד, לפי סוג הטופס. */
async function ingest(
  client: SupabaseClient, layout: FormLayout, items: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  if (!items.length) return { added: 0, updated: 0, skipped: 0 };

  if (layout.kind === 'lesson') {
    const { data, error } = await client.rpc('igud_import_lessons', {
      payload: items,
      p_publish: false,
    });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  if (layout.kind === 'subscriber') {
    const { data, error } = await client.rpc('igud_import_subscribers', { payload: items });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  const kind = layout.kind === 'host' ? 'open_lesson' : 'maggid';
  const { data, error } = await client.rpc('igud_import_requests', {
    p_kind: kind,
    payload: items,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function POST(request: Request) {
  let client: SupabaseClient;
  try {
    client = await requireAdmin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'הפעולה מותרת למנהלים בלבד' },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { /* גוף ריק — לוקחים מהכתובת */ }

    const only = String(body.form || url.searchParams.get('form') || '').trim();
    const reset = body.reset === true || url.searchParams.get('reset') === '1';
    const maxRecords = Math.min(
      Number(body.max || url.searchParams.get('max') || 2000), 5000,
    );

    const { data: settingRow } = await client
      .from('igud_settings').select('value').eq('key', 'nedarim').maybeSingle();
    const settings = (settingRow?.value || {}) as NedarimSettings;

    const credentials = {
      mosadId: String(settings.mosadId || ''),
      // apiKey נשמר לתאימות לאחור עם הגדרות ישנות
      apiPassword: String(settings.apiPassword || settings.apiKey || ''),
    };
    if (!credentials.mosadId || !credentials.apiPassword) {
      return NextResponse.json(
        {
          error: 'לא הוגדרו פרטי החיבור לנדרים פלוס. '
            + 'יש למלא מספר מוסד ומפתח API (ApiPassword, מתחיל ב-npk_) במסך ההגדרות.',
        },
        { status: 400 },
      );
    }

    const forms = { ...(settings.forms || {}) };
    const targets: FormId[] = only
      ? (FORM_IDS.includes(only as FormId) ? [only as FormId] : [])
      : FORM_IDS.filter((id) => enabled(forms[id]?.enabled));

    if (!targets.length) {
      return NextResponse.json(
        { error: only ? `מספר טופס לא מוכר: ${only}` : 'אין טפסים פעילים לסנכרון' },
        { status: 400 },
      );
    }

    const outcomes: FormOutcome[] = [];

    for (const formId of targets) {
      const layout = layoutOf(formId)!;
      const config = forms[formId] || {};
      const fieldBase = Number(config.fieldBase) || 1;
      const lastId = reset ? '0' : String(config.lastId || '0');

      try {
        const { records, lastId: nextId } = await fetchFormRecords(credentials, {
          tofesId: formId,
          lastId,
          maxId: 500,
          maxRecords,
          fields: fieldsFor(layout, fieldBase),
        });

        const items = parseRecords(records, layout, fieldBase);
        const result = await ingest(client, layout, items);

        forms[formId] = {
          ...config,
          lastId: nextId,
          lastSyncAt: new Date().toISOString(),
          lastCount: records.length,
        };

        outcomes.push({
          form: formId, label: layout.label, fetched: records.length, lastId: nextId, result,
        });
      } catch (error) {
        outcomes.push({
          form: formId,
          label: layout.label,
          fetched: 0,
          lastId,
          error: error instanceof NedarimError || error instanceof Error
            ? error.message : 'המשיכה נכשלה',
        });
      }
    }

    // שמירת הסמנים: מיזוג לתוך ההגדרות הקיימות, בלי לדרוס שדות אחרים
    const { error: saveError } = await client.from('igud_settings').upsert({
      key: 'nedarim',
      value: { ...settings, forms },
      secret: true,
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw new Error(`שמירת סמן הסנכרון נכשלה: ${saveError.message}`);

    await client.from('igud_audit').insert({
      action: 'nedarim_pull',
      entity: 'igud_lessons',
      meta: { outcomes },
    });

    const failed = outcomes.filter((o) => o.error);
    return NextResponse.json(
      {
        ok: failed.length === 0,
        fetched: outcomes.reduce((sum, o) => sum + o.fetched, 0),
        forms: outcomes,
      },
      { status: failed.length === outcomes.length ? 502 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'המשיכה מנדרים פלוס נכשלה' },
      { status: 500 },
    );
  }
}
