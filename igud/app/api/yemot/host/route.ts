import { publicClient } from '@/lib/supabase';
import {
  goHome, hangup, isHangup, noop, respond, say, yemotParams,
} from '@/lib/yemot';
import { formStep, loadOptions } from '@/lib/ivr-form';
import { hostPlan } from '@/lib/ivr-plans';
import { askMode, farewell, freeMessage } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 4 — הקמת שיעור תורה חדש.
 *
 * מקום שמחפש מגיד שיעור. כמו בשלוחה 3, שני מסלולים: שאלון מונחה או
 * הודעה חופשית. גבאי שמתקשר בין מנחה למעריב לא יעבור שאלון.
 *
 * השאלון הוא טופס 4063 בנדרים פלוס, ובשונה משלוחה 3 אין כאן שלב
 * זיהוי: מי שמבקש שיעור אינו בהכרח מוכר לנו, ואין סיבה לומר לו שהוא
 * כן. שלושה שדות חובה, וכל השאר מדולגים בסולמית.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = publicClient();
  const c = await loadCopy(client);

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return askMode(c, c('host.intro.1'), c('host.intro.2'));
  }

  const free = await freeMessage(client, params, {
    kind: 'host',
    requestKind: 'open_lesson',
    phone,
    invite: c('host.freeInvite'),
    copy: c,
  });
  if (free) return free;

  const plan = hostPlan(c);
  const taxonomy = await loadOptions(client, plan);

  const step = formStep(params, plan, taxonomy, c, {
    onExit: () => respond(say(c('nav.back')), goHome()),
  });
  if (!step.done) return step.response;

  const a = step.answers as Record<string, string | string[]>;
  const one = (key: string) => (Array.isArray(a[key]) ? (a[key] as string[])[0] : a[key] as string) || null;
  const many = (key: string) => (Array.isArray(a[key]) ? a[key] as string[] : a[key] ? [a[key] as string] : []);

  const { error } = await client.rpc('igud_submit_request', {
    p_kind: 'open_lesson',
    payload: {
      contact_name: one('contact_name'),
      phone: one('phone') || phone,
      city: one('city'),
      source: 'yemot',
      source_ref: params.ApiCallId || null,
      details: {
        requesterType: one('requesterType'),
        venue_name: one('venue_name'),
        nusach: one('nusach'),
        activity: one('activity'),
        familyStyle: one('familyStyle'),
        audienceGender: one('audienceGender'),
        language: one('language'),
        audienceStyles: many('audienceStyles'),
        topics: many('topics'),
        background: one('background'),
        lessonCharacter: many('lessonCharacter'),
        speechStyle: one('speechStyle'),
        frequency: one('frequency'),
        days: many('days'),
        hours: many('hours'),
        payerOffer: one('payerOffer'),
        viaVoice: true,
      },
    },
  });

  if (error) return respond(say(c('nav.error'), c('nav.retry')), hangup());

  return farewell(c, c('host.done.1'), c('host.done.2'), c('host.done.3'));
}

export const GET = handle;
export const POST = handle;
