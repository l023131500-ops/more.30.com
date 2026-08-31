import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase';
import { parseTime, parseDate, DAY_SLOTS } from '@/lib/nedarim.js';
import { layoutOf, parseRecords } from '@/lib/nedarim-forms';

export const dynamic = 'force-dynamic';

/**
 * כתובת ה-callback שנמסרת לנדרים פלוס.
 *
 * כל טופס שמולא בעמדה נשלח לכאן, ונכנס למאגר כרשומה הממתינה לאישור.
 * האימות נעשה מול הסוד שנשמר במסך ההגדרות, בכותרת x-igud-secret
 * או בשדה secret בגוף הפנייה.
 *
 * מבנה הפנייה הנתמך (JSON או form):
 *   FormId  — מספר הטופס: 4320, 4063, 4018 או 4357
 *   Data    — אובייקט עם שדות הטופס
 *
 * שני מבנים נתמכים לשדות: שמות מפורשים (RabbiName, City וכדומה), או
 * עמודות Field1..FieldN כפי שהן חוזרות מה-API של הטפסים. במבנה השני
 * הפירוש נעשה באותם מנתחים שמשרתים את המשיכה מה-API ואת הייבוא מקובץ,
 * וכך אין שתי גרסאות של אותם כללים.
 */

interface Settings { callbackSecret?: string }

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) return await request.json();
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    form.forEach((value, key) => { out[key] = String(value); });
    return out;
  } catch {
    return {};
  }
}

/** שדות טופס 4320 אל רשומת שיעור. */
function lessonFromForm(data: Record<string, unknown>) {
  const multi = (v: unknown) => str(v).split(',').map((p) => p.trim().replace(/^\*/, '')).filter(Boolean);

  const isOneTime = str(data.LessonUpdate) === 'שיעור בתאריך מסוים';
  const occurrences: Record<string, unknown>[] = [];

  if (isOneTime) {
    occurrences.push({
      specific_date: parseDate(str(data.BDEEvent) || str(data.date)),
      time_of_day: parseTime(str(data.time)),
      sort: 0,
    });
  } else {
    DAY_SLOTS.forEach((slot: { label: string; weekday: number }, index: number) => {
      const marked = str(data[`Day${index + 1}`]) === 'true' || str(data[`Day${index + 1}`]) === '1';
      const rawTime = str(data[`time${index + 1}`]);
      if (!marked && !rawTime) return;
      occurrences.push({
        weekday: slot.weekday,
        day_label: slot.label,
        time_of_day: parseTime(rawTime),
        note: parseTime(rawTime) ? null : rawTime || null,
        sort: index,
      });
    });
  }

  const topics = multi(data.Topic_Dt);

  return {
    teacher_name: str(data.RabbiName),
    venue_name: str(data.Location),
    city: str(data.City),
    neighborhood: str(data.neighborhood),
    street: str(data.Street),
    house_no: str(data.Num),
    topic: topics[0] || null,
    topics,
    topic_other: str(data.other4) || null,
    audience_gender: str(data.GivingLessonGender) || null,
    audience_styles: multi(data.Audience_Dt),
    language: str(data.language) || null,
    lesson_style: str(data.LessonStyle) || null,
    schedule_kind: isOneTime ? 'onetime' : 'recurring',
    frequency: str(data.LessonUpdate) || null,
    broadcast: (() => {
      const v = str(data.lessonDelivere);
      if (v.includes('מוקלט') && v.includes('חי')) return 'both';
      if (v.includes('חי')) return 'live';
      if (v.includes('מוקלט')) return 'recorded';
      return 'none';
    })(),
    description: str(data.Detail) || null,
    season_note: str(data.DetailsUpdate) || null,
    contact_name: str(data.Name) || null,
    contact_phone: str(data.Tel) || null,
    contact_email: str(data.Mail) || null,
    organization: str(data.OrganizationName) || null,
    occurrences,
    source: 'nedarim',
  };
}

/** האם הגוף בנוי מעמודות Field1..FieldN של ה-API? */
function isFieldRecord(data: Record<string, unknown>): boolean {
  return Object.keys(data).some((key) => /^Field\d+$/.test(key));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('ping')) {
    return NextResponse.json({ ok: true, service: 'igud-hashiurim', time: new Date().toISOString() });
  }
  return NextResponse.json(
    { error: 'הכתובת מקבלת פניות POST בלבד. לבדיקת חיים נא להוסיף ping=1' },
    { status: 405 },
  );
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const client = await serviceClient();

    const { data: settingRow } = await client
      .from('igud_settings').select('value').eq('key', 'nedarim').maybeSingle();
    const settings = (settingRow?.value || {}) as Settings;

    if (settings.callbackSecret) {
      const provided = request.headers.get('x-igud-secret') || str(body.secret);
      if (provided !== settings.callbackSecret) {
        return NextResponse.json({ error: 'אימות נכשל' }, { status: 401 });
      }
    }

    const formId = str(body.FormId || body.formId || body.form);
    const data = (body.Data || body.data || body) as Record<string, unknown>;
    const externalId = str(data.ID || data.Id || data.id || body.ID || body.Id) || null;

    if (formId === '4320' || str(data.type) === 'lesson_update') {
      const layout = layoutOf('4320')!;
      const lesson = isFieldRecord(data)
        ? (parseRecords([data as Record<string, string>], layout)[0] || {}) as ReturnType<typeof lessonFromForm>
        : lessonFromForm(data);
      if (!lesson.teacher_name && !lesson.venue_name) {
        return NextResponse.json({ error: 'חסרים פרטי הרב והמקום' }, { status: 400 });
      }
      const { data: result, error } = await client.rpc('igud_import_lessons', {
        payload: [{ ...lesson, external_id: externalId, publishable: false }],
        p_publish: false,
      });
      if (error) throw new Error(error.message);

      await client.from('igud_audit').insert({
        actor: 'nedarim', action: 'nedarim_callback', entity: 'igud_lessons',
        meta: { form: formId, ...(result as Record<string, unknown>) },
      });
      return NextResponse.json({ ok: true, form: formId, result });
    }

    if (formId === '4063' || formId === '4018') {
      const kind = formId === '4063' ? 'open_lesson' : 'maggid';
      const item = isFieldRecord(data)
        ? parseRecords([data as Record<string, string>], layoutOf(formId)!)[0]
        : {
          contact_name: str(data.Name || data.ContactName || data.FullName),
          phone: str(data.Tel || data.Phone),
          email: str(data.Mail || data.Email),
          city: str(data.City),
          payload: data,
          external_id: externalId,
        };
      const { data: result, error } = await client.rpc('igud_import_requests', {
        p_kind: kind,
        payload: [item],
      });
      if (error) throw new Error(error.message);

      await client.from('igud_audit').insert({
        actor: 'nedarim', action: 'nedarim_callback', entity: 'igud_requests',
        meta: { form: formId, ...(result as Record<string, unknown>) },
      });
      return NextResponse.json({ ok: true, form: formId, result });
    }

    if (formId === '4357') {
      const item = isFieldRecord(data)
        ? parseRecords([data as Record<string, string>], layoutOf('4357')!)[0]
        : {
          full_name: str(data.Name || data.FirstName),
          phone: str(data.Tel || data.Phone),
          email: str(data.Mail || data.Email),
          wants: [], filters: { query: str(data.Search) }, partner: false,
          external_id: externalId,
        };
      const { data: result, error } = await client.rpc('igud_import_subscribers', {
        payload: [item],
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, form: formId, result });
    }

    return NextResponse.json(
      { error: `מספר טופס לא מוכר: ${formId || 'ריק'}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'קליטת הטופס נכשלה' },
      { status: 500 },
    );
  }
}
