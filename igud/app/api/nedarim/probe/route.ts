import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase';
import { fetchFormPage } from '@/lib/nedarim-api';
import { fieldsFor, layoutOf, parseRecords, probeRecord, type FormId } from '@/lib/nedarim-forms';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * בדיקת שדות הטופס.
 *
 * נדרים פלוס מחזירים את שדות הטופס בשמות Field1, Field2 וכן הלאה,
 * וההתאמה בין המספר לבין המשמעות נקבעת לפי סדר השדות בטופס.
 * המסלול הזה מושך רשומה אחת אחרונה ומציג לצד כל מספר שדה את התווית
 * הצפויה ואת הערך שהתקבל, כדי שאפשר יהיה לוודא את ההתאמה בעין
 * לפני סנכרון מלא. אם המספור מוסט, משנים את fieldBase בהגדרות.
 *
 * הפעולה קוראת בלבד ואינה כותבת דבר למסד.
 */
export async function POST(request: Request) {
  try {
    const client = await requireAdmin(request);

    const url = new URL(request.url);
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { /* גוף ריק */ }

    const formId = String(body.form || url.searchParams.get('form') || '4320').trim();
    const layout = layoutOf(formId);
    if (!layout) {
      return NextResponse.json({ error: `מספר טופס לא מוכר: ${formId}` }, { status: 400 });
    }
    const fieldBase = Number(body.fieldBase || url.searchParams.get('fieldBase') || 1) || 1;

    const { data: settingRow } = await client
      .from('igud_settings').select('value').eq('key', 'nedarim').maybeSingle();
    const settings = (settingRow?.value || {}) as Record<string, string>;

    const credentials = {
      mosadId: String(settings.mosadId || ''),
      apiPassword: String(settings.apiPassword || settings.apiKey || ''),
    };
    if (!credentials.mosadId || !credentials.apiPassword) {
      return NextResponse.json(
        { error: 'לא הוגדרו מספר מוסד ומפתח API במסך ההגדרות' },
        { status: 400 },
      );
    }

    const records = await fetchFormPage(credentials, {
      tofesId: formId,
      lastId: '0',
      maxId: 1,
      order: 'Desc',
      fields: fieldsFor(layout, fieldBase),
    });

    if (!records.length) {
      return NextResponse.json({
        ok: true,
        form: formId as FormId,
        label: layout.label,
        fieldBase,
        empty: true,
        message: 'אין עדיין רשומות בטופס הזה בנדרים פלוס',
      });
    }

    const probe = probeRecord(records[0], layout, fieldBase);
    const [parsed] = parseRecords(records, layout, fieldBase);

    return NextResponse.json({
      ok: true,
      form: formId as FormId,
      label: layout.label,
      fieldBase,
      record: probe,
      parsed: parsed || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'בדיקת השדות נכשלה';
    const denied = /מנהלים בלבד|נדרשת התחברות/.test(message);
    return NextResponse.json({ error: message }, { status: denied ? 403 : 502 });
  }
}
