import { NextResponse } from 'next/server';
import { publicClient } from '@/lib/supabase';
import { LESSON_CARD_COLUMNS } from '@/lib/queries';
import {
  buildFieldMap, isInbound, isShare, lessonFromFields,
  requestFromFields, subscriberFromFields, toShareRow, SHARE_COLUMNS,
  INBOUND_TYPES, SHARE_TYPES,
} from '@/lib/nedarim-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * נקודת הקצה היחידה מול נדרים פלוס.
 *
 * כתובת אחת, שני כיוונים, והזיהוי לפי השדה type:
 *
 *   נכנס  — lesson_update, lesson, seeker_request, teacher_request, subscriber
 *           הפנייה נשמרת גולמית, מפורקת לפי תוויות בעברית, ונכנסת
 *           למאגר כרשומה הממתינה לאישור.
 *
 *   יוצא  — lesson_share, synagogue_share, event_share, portal_share
 *           מוחזרת רשימת שיעורים מפורסמים בשלוש עשרה עמודות קבועות.
 *
 * האימות: סוד שנקבע במסך ההגדרות. אפשר למסור אותו בשלוש דרכים,
 * כדי שיתאים לכל אופן שליחה שנוח לנדרים פלוס — בכתובת (key=),
 * בכותרת x-igud-secret, או בשדה secret בגוף הפנייה.
 */

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) return await request.json();
    if (type.includes('form')) {
      const form = await request.formData();
      const out: Record<string, unknown> = {};
      form.forEach((value, key) => { out[key] = String(value); });
      return out;
    }
    // ללא כותרת מפורשת: מנסים JSON, ואם לא — טופס
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { /* ממשיכים */ }
    const out: Record<string, unknown> = {};
    new URLSearchParams(text).forEach((value, key) => { out[key] = value; });
    return out;
  } catch {
    return {};
  }
}

function secretOf(request: Request, body: Record<string, unknown>): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get('key')
    || request.headers.get('x-igud-secret')
    || str(body.secret)
    || str(body.key)
    || ''
  );
}

/* ============================================================
   כיוון יוצא: שיעורים מהמאגר אל נדרים פלוס
   ============================================================ */

async function share(type: string, body: Record<string, unknown>, url: URL) {
  const client = publicClient();
  const q = (name: string) => str(body[name]) || url.searchParams.get(name) || '';

  const limit = Math.min(Number(q('limit')) || 200, 500);
  let query = client
    .from('igud_lesson_cards')
    .select(LESSON_CARD_COLUMNS)
    .limit(limit);

  const city = q('city') || q('עיר');
  const topic = q('topic') || q('נושא');
  const teacher = q('teacher') || q('שם הרב');
  const venue = q('venue') || q('שם בית הכנסת');
  const search = q('search') || q('q');

  if (city) query = query.eq('city', city);
  if (topic) query = query.contains('topics', [topic]);
  if (teacher) query = query.ilike('teacher_name', `%${teacher}%`);
  if (venue) query = query.ilike('venue_name', `%${venue}%`);
  if (search) query = query.ilike('search_text', `%${search}%`);

  // synagogue_share מחזיר רק שיעורים שיש להם מקום מוגדר
  if (type === 'synagogue_share') query = query.not('venue_name', 'is', null);
  // event_share מחזיר שיעורים בתאריך מסוים בלבד
  if (type === 'event_share') query = query.eq('schedule_kind', 'onetime');

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, type, message: error.message },
      { status: 502 },
    );
  }

  const results = (data || []).map(toShareRow);
  return NextResponse.json({ success: true, type, count: results.length, results });
}

/* ============================================================
   כיוון נכנס: טפסים מנדרים פלוס אל המאגר
   ============================================================ */

async function ingest(type: string, body: Record<string, unknown>, secret: string, ip: string | null) {
  const map = buildFieldMap(body);
  const externalId = str(body.ID || body.Id || body.id || body.RecordId) || null;

  let payload: Record<string, unknown>[];
  if (type === 'lesson_update' || type === 'lesson') {
    payload = [lessonFromFields(map, externalId)];
  } else if (type === 'subscriber') {
    payload = [subscriberFromFields(map, externalId)];
  } else {
    payload = [requestFromFields(map, externalId, body)];
  }

  const { data, error } = await publicClient().rpc('igud_ingest_nedarim', {
    p_secret: secret,
    p_type: type,
    p_raw: body,
    p_payload: payload,
    p_ip: ip,
  });

  if (error) {
    return NextResponse.json(
      { success: false, type, message: error.message },
      { status: /אימות/.test(error.message) ? 401 : 500 },
    );
  }

  const result = (data || {}) as Record<string, unknown>;
  return NextResponse.json(
    {
      success: result.success !== false,
      type,
      submission: result.submission,
      result: result.result,
      message: result.message,
    },
    { status: result.success === false ? 422 : 200 },
  );
}

/* ============================================================ */

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await readBody(request);
    const secret = secretOf(request, body);
    const type = str(body.type || body.Type || url.searchParams.get('type'));

    if (!type) {
      return NextResponse.json(
        {
          success: false,
          message: 'חסר שדה type',
          inbound: INBOUND_TYPES,
          share: SHARE_TYPES,
        },
        { status: 400 },
      );
    }

    // האימות נבדק במסד, מול הסוד שנקבע במסך ההגדרות
    const { data: ok } = await publicClient().rpc('igud_verify_secret', {
      p_key: 'nedarim', p_field: 'callbackSecret', p_secret: secret,
    });
    if (ok !== true) {
      return NextResponse.json(
        { success: false, message: 'אימות נכשל' },
        { status: 401 },
      );
    }

    const ip = request.headers.get('x-forwarded-for');

    if (isShare(type)) return share(type, body, url);
    if (isInbound(type)) return ingest(type, body, secret, ip);

    return NextResponse.json(
      {
        success: false,
        message: `סוג לא מוכר: ${type}`,
        inbound: INBOUND_TYPES,
        share: SHARE_TYPES,
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'הקליטה נכשלה' },
      { status: 500 },
    );
  }
}

/** בדיקת חיים, וגם תיאור קצר של החוזה. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!url.searchParams.get('ping')) {
    return NextResponse.json(
      { success: false, message: 'הכתובת מקבלת POST. לבדיקת חיים נא להוסיף ping=1' },
      { status: 405 },
    );
  }
  return NextResponse.json({
    success: true,
    service: 'igud-hashiurim',
    time: new Date().toISOString(),
    inbound: INBOUND_TYPES,
    share: SHARE_TYPES,
    columns: SHARE_COLUMNS,
  });
}

