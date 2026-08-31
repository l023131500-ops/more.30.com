import { serviceClient } from '@/lib/supabase';
import { hangup, read, respond, say, yemotParams } from '@/lib/yemot';
import { pagedChoice, topCities, topTopics } from '@/lib/ivr';

export const dynamic = 'force-dynamic';

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 3 — הצטרפות כמגיד שיעור.
 * אוספת את הפרטים החיוניים בהקשות, ומשאירה את השאלון המלא לשיחת חזרה.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = await serviceClient();

  const cities = await topCities(client, 40);
  const cityChoice = pagedChoice(params, 'city', cities);
  if ('askText' in cityChoice) {
    return respond(
      say('הצטרפות כמגיד שיעור'),
      say('נאסוף כמה פרטים, ונציג מהאיגוד יחזור אליכם להשלמת השאלון'),
      read(`באיזו עיר אתם גרים. ${cityChoice.askText}`, cityChoice.varName, { min: 1, max: 1 }),
    );
  }

  const topics = await topTopics(client, 30);
  const topicChoice = pagedChoice(params, 'topic', topics);
  if ('askText' in topicChoice) {
    return respond(
      read(`באיזה נושא תרצו למסור שיעור. ${topicChoice.askText}`, topicChoice.varName, { min: 1, max: 1 }),
    );
  }

  if (!params.audience) {
    return respond(read('למי מתאים לכם למסור. לגברים הקישו 1. לנשים הקישו 2. לשניהם הקישו 3', 'audience', { min: 1, max: 1 }));
  }

  const city = cityChoice.value;
  const topic = topicChoice.value;
  const audience = ({ '1': 'גברים', '2': 'נשים', '3': 'גברים ונשים' } as Record<string, string>)[params.audience] || null;

  await client.from('igud_requests').insert({
    kind: 'maggid',
    contact_name: `פנייה טלפונית ${phone}`,
    phone,
    city,
    payload: { topics: topic ? [topic] : [], audienceGender: audience, viaVoice: true },
    status: 'new',
    source: 'yemot',
    source_ref: params.ApiCallId || null,
  });

  await client.from('igud_audit').insert({
    actor: `yemot:${phone}`,
    action: 'yemot_request',
    entity: 'igud_requests',
    meta: { kind: 'maggid', city, topic },
  });

  return respond(
    say('הפרטים נקלטו. תודה רבה'),
    say('נציג מהאיגוד יחזור אליכם בהקדם להשלמת הפרטים'),
    hangup(),
  );
}

export const GET = handle;
export const POST = handle;
