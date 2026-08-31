import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase';
import { addressLine, lessonTitle } from '@/lib/format';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * שליחת שיעורים מפורסמים אל נדרים פלוס.
 *
 * הפעולה מיועדת למנהלים, וניתן להריץ אותה גם כמשימה מתוזמנת.
 * כתובת היעד וההרשאות נלקחות ממסך ההגדרות.
 */

const ENDPOINT = process.env.NEDARIM_ENDPOINT
  || 'https://www.matara.pro/nedarimplus/Reports/ApiSet.aspx';

interface NedarimSettings {
  mosadId?: string;
  apiValid?: string;
  apiKey?: string;
}

export async function POST(request: Request) {
  try {
    const client = await requireAdmin(request);

    const { data: settingRow } = await client
      .from('igud_settings').select('value').eq('key', 'nedarim').maybeSingle();
    const settings = (settingRow?.value || {}) as NedarimSettings;

    if (!settings.mosadId || !(settings.apiValid || settings.apiKey)) {
      return NextResponse.json(
        { error: 'לא הוגדרו פרטי החיבור לנדרים פלוס. יש למלא מספר מוסד ומפתח במסך ההגדרות.' },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const since = url.searchParams.get('since');
    const limit = Math.min(Number(url.searchParams.get('limit') || '200'), 500);

    let query = client
      .from('igud_lesson_cards')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (since) query = query.gte('published_at', since);

    const { data: lessons, error } = await query;
    if (error) throw new Error(error.message);

    const payload = (lessons || []).map((lesson) => ({
      ExternalId: lesson.id,
      Number: lesson.public_no,
      Title: lessonTitle(lesson),
      Rabbi: lesson.teacher_name,
      Organization: lesson.organization,
      Location: lesson.venue_name,
      City: lesson.city,
      Address: addressLine(lesson),
      Topics: (lesson.topics || []).join(', '),
      Audience: lesson.audience_gender,
      Language: lesson.language,
      Style: lesson.lesson_style,
      Broadcast: lesson.broadcast,
      Schedule: (lesson.schedule || [])
        .map((o: { day: string | null; time: string | null; date: string | null }) =>
          `${o.day || o.date || ''} ${(o.time || '').slice(0, 5)}`.trim())
        .filter(Boolean)
        .join(' | '),
      Url: `${SITE.url}/lesson/${lesson.id}`,
    }));

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Mosad: settings.mosadId,
        ApiValid: settings.apiValid || settings.apiKey,
        Action: 'IgudHashiurimSync',
        Lessons: payload,
      }),
    });

    const text = await res.text();

    await client.from('igud_audit').insert({
      action: 'nedarim_push',
      entity: 'igud_lessons',
      meta: { sent: payload.length, status: res.status, response: text.slice(0, 300) },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `נדרים פלוס החזירו שגיאה ${res.status}`, body: text.slice(0, 500) },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, sent: payload.length, response: text.slice(0, 500) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'השליחה נכשלה';
    const denied = /מנהלים בלבד|נדרשת התחברות/.test(message);
    return NextResponse.json({ error: message }, { status: denied ? 403 : 500 });
  }
}
