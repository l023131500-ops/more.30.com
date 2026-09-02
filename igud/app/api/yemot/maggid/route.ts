import { publicClient } from '@/lib/supabase';
import { hangup, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import { pagedChoice, topCities, topTopics } from '@/lib/ivr';
import { askMode, freeMessage } from '@/lib/ivr-flows';

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

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return askMode(
      'שמחים שבאתם למסור תורה',
      'כמה פרטים קצרים, ונציג מהאיגוד יחזור אליכם',
    );
  }

  const free = await freeMessage(client, params, {
    kind: 'join',
    requestKind: 'maggid',
    phone,
    invite: 'ספרו בקצרה על עצמכם. באיזה נושא תרצו למסור, ובאיזה אזור',
  });
  if (free) return free;

  const cities = await topCities(client, 40);
  const cityChoice = pagedChoice(params, 'city', cities);
  if ('askText' in cityChoice) {
    return respond(
      say('באיזו עיר אתם גרים'),
      read(cityChoice.askText, cityChoice.varName, { min: 1, max: 1 }),
    );
  }

  const topics = await topTopics(client, 30);
  const topicChoice = pagedChoice(params, 'topic', topics);
  if ('askText' in topicChoice) {
    return respond(
      say('באיזה נושא תרצו למסור'),
      read(topicChoice.askText, topicChoice.varName, { min: 1, max: 1 }),
    );
  }

  if (!params.audience) {
    return respond(
      say('ולמי מתאים לכם למסור'),
      read('לגברים הקישו 1. לנשים הקישו 2. לשניהם הקישו 3', 'audience', { min: 1, max: 1 }),
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
      say('משהו השתבש בשמירת הפרטים', 'נשמח אם תנסו שוב בעוד כמה דקות'),
      hangup(),
    );
  }

  return respond(
    say('הפרטים נקלטו'),
    say('נציג מהאיגוד יחזור אליכם בימים הקרובים להשלמת השאלון'),
    say('תודה שבחרתם להרביץ תורה ברבים'),
    hangup(),
  );
}

export const GET = handle;
export const POST = handle;
