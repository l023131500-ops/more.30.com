import { publicClient } from '@/lib/supabase';
import { hangup, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import { pagedChoice, topCities, topTopics } from '@/lib/ivr';
import { askMode, farewell, freeMessage } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 3 — הצטרפות כמגיד שיעור.
 *
 * שני מסלולים בפתיחה: טופס מונחה בהקשות, או הודעה חופשית בקול. שניהם
 * מגיעים לאותה תיבה בניהול. מי שמתקשר תוך כדי הליכה לא יעבור שאלון,
 * ולא נרצה לאבד אותו בגלל זה.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = publicClient();
  const c = await loadCopy(client);

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return askMode(c, c('maggid.intro.1'), c('maggid.intro.2'));
  }

  const free = await freeMessage(client, params, {
    kind: 'join',
    requestKind: 'maggid',
    phone,
    invite: c('maggid.freeInvite'),
    copy: c,
  });
  if (free) return free;

  const cities = await topCities(client, 40);
  const cityChoice = pagedChoice(params, 'city', cities);
  if ('askText' in cityChoice) {
    return respond(
      say(c('maggid.cityAsk')),
      read(cityChoice.askText, cityChoice.varName, { min: 1, max: 1 }),
    );
  }

  const topics = await topTopics(client, 30);
  const topicChoice = pagedChoice(params, 'topic', topics);
  if ('askText' in topicChoice) {
    return respond(
      say(c('maggid.topicAsk')),
      read(topicChoice.askText, topicChoice.varName, { min: 1, max: 1 }),
    );
  }

  if (!params.audience) {
    return respond(
      say(c('maggid.audienceAsk')),
      read(c('maggid.audienceMenu'), 'audience', { min: 1, max: 1 }),
    );
  }

  const city = cityChoice.value;
  const topic = topicChoice.value;
  const audience = ({ '1': 'גברים', '2': 'נשים', '3': 'גברים ונשים' } as Record<string, string>)[params.audience] || null;

  const { error } = await client.rpc('igud_submit_request', {
    p_kind: 'maggid',
    payload: {
      contact_name: `פנייה טלפונית ${phone}`,
      phone,
      city,
      source: 'yemot',
      source_ref: params.ApiCallId || null,
      details: { topics: topic ? [topic] : [], audienceGender: audience, viaVoice: true },
    },
  });
  if (error) {
    return respond(
      say(c('nav.error'), c('nav.retry')),
      hangup(),
    );
  }

  return farewell(c, c('maggid.done.1'), c('maggid.done.2'), c('maggid.done.3'));
}

export const GET = handle;
export const POST = handle;
