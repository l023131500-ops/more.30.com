import { publicClient } from '@/lib/supabase';
import { hangup, read, respond, say, yemotParams } from '@/lib/yemot';
import { pagedChoice, topCities, topTopics } from '@/lib/ivr';
import { askMode, freeMessage } from '@/lib/ivr-flows';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 4 — פתיחת שיעור תורה חדש.
 *
 * מקום שמחפש מגיד שיעור. כמו בשלוחה 3, שני מסלולים: טופס מונחה או
 * הודעה חופשית. גבאי שמתקשר בין מנחה למעריב לא יעבור שאלון.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = publicClient();

  if (!params.mode) {
    return askMode(
      'פתיחת שיעור תורה חדש',
      'נאסוף כמה פרטים, וצוות האיגוד יחפש עבורכם מגיד שיעור',
    );
  }

  const free = await freeMessage(client, params, {
    kind: 'host',
    requestKind: 'open_lesson',
    phone,
    invite: 'ספרו איזה שיעור אתם מחפשים, באיזה מקום ובאילו זמנים',
  });
  if (free) return free;

  if (!params.kind) {
    return respond(
      read(
        'עבור בית כנסת הקישו 1. עבור מרכז תורני או ארגון הקישו 2. עבור קבוצת לומדים או חוג בית הקישו 3',
        'kind',
        { min: 1, max: 1 },
      ),
    );
  }

  const cities = await topCities(client, 40);
  const cityChoice = pagedChoice(params, 'city', cities);
  if ('askText' in cityChoice) {
    return respond(read(`באיזו עיר. ${cityChoice.askText}`, cityChoice.varName, { min: 1, max: 1 }));
  }

  const topics = await topTopics(client, 30);
  const topicChoice = pagedChoice(params, 'topic', topics);
  if ('askText' in topicChoice) {
    return respond(read(`באיזה נושא תרצו שיעור. ${topicChoice.askText}`, topicChoice.varName, { min: 1, max: 1 }));
  }

  const city = cityChoice.value;
  const topic = topicChoice.value;
  const requesterType = ({ '1': 'בית כנסת', '2': 'מרכז תורני', '3': 'לימוד בסגנון של חברותא' } as Record<string, string>)[params.kind] || null;

  const { error } = await client.rpc('igud_submit_request', {
    p_kind: 'open_lesson',
    payload: {
      contact_name: `פנייה טלפונית ${phone}`,
      phone,
      city,
      source: 'yemot',
      source_ref: params.ApiCallId || null,
      details: { requesterType, topics: topic ? [topic] : [], viaVoice: true },
    },
  });
  if (error) {
    return respond(
      say('אירעה תקלה בשמירת הפרטים. נא לנסות שוב מאוחר יותר'),
      hangup(),
    );
  }

  return respond(
    say('הבקשה נקלטה. תודה רבה'),
    say('צוות האיגוד יחפש מגיד שיעור שמתאים לכם, ויחזור אליכם בהקדם'),
    hangup(),
  );
}

export const GET = handle;
export const POST = handle;
