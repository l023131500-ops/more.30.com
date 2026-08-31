import { serviceClient } from '@/lib/supabase';
import { hangup, read, respond, say, yemotParams } from '@/lib/yemot';
import { numberedMenu, topCities, topTopics } from '@/lib/ivr';

export const dynamic = 'force-dynamic';

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 4 — פתיחת שיעור תורה חדש.
 * מקום שמחפש מגיד שיעור משאיר את הפרטים החיוניים, והמשך בשיחת חזרה.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = await serviceClient();

  if (!params.kind) {
    return respond(
      say('פתיחת שיעור תורה חדש'),
      read(
        'עבור בית כנסת הקישו 1. עבור מרכז תורני או ארגון הקישו 2. עבור קבוצת לומדים או חוג בית הקישו 3',
        'kind',
        { min: 1, max: 1 },
      ),
    );
  }

  if (!params.city) {
    const cities = await topCities(client, 30);
    const menu = numberedMenu(cities, Number(params.page || '0'));
    return respond(read(`באיזו עיר. ${menu.text}`, 'city', { min: 1, max: 1 }));
  }

  if (!params.topic) {
    const topics = await topTopics(client, 20);
    const menu = numberedMenu(topics);
    return respond(read(`באיזה נושא תרצו שיעור. ${menu.text}`, 'topic', { min: 1, max: 1 }));
  }

  const cities = await topCities(client, 30);
  const topics = await topTopics(client, 20);
  const city = numberedMenu(cities, Number(params.page || '0')).slice[Number(params.city) - 1] || null;
  const topic = numberedMenu(topics).slice[Number(params.topic) - 1] || null;
  const requesterType = ({ '1': 'בית כנסת', '2': 'מרכז תורני', '3': 'לימוד בסגנון של חברותא' } as Record<string, string>)[params.kind] || null;

  await client.from('igud_requests').insert({
    kind: 'open_lesson',
    contact_name: `פנייה טלפונית ${phone}`,
    phone,
    city,
    payload: { requesterType, topics: topic ? [topic] : [], viaVoice: true },
    status: 'new',
    source: 'yemot',
    source_ref: params.ApiCallId || null,
  });

  await client.from('igud_audit').insert({
    actor: `yemot:${phone}`,
    action: 'yemot_request',
    entity: 'igud_requests',
    meta: { kind: 'open_lesson', city, topic, requesterType },
  });

  return respond(
    say('הבקשה נקלטה. תודה רבה'),
    say('צוות האיגוד יחפש מגיד שיעור שמתאים לכם, ויחזור אליכם בהקדם'),
    hangup(),
  );
}

export const GET = handle;
export const POST = handle;
