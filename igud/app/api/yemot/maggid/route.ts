import { publicClient } from '@/lib/supabase';
import {
  goHome, hangup, isHangup, noop, respond, say, yemotParams,
} from '@/lib/yemot';
import { formStep, loadOptions } from '@/lib/ivr-form';
import { maggidPlan } from '@/lib/ivr-plans';
import { askMode, farewell, freeMessage } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 3 — הצטרפות למערך מגידי השיעורים.
 *
 * שני מסלולים בפתיחה: שאלון מונחה, או הודעה חופשית בקול. שניהם מגיעים
 * לאותה תיבה בניהול, ואין ביניהם מסלול "נחות" — ההבדל הוא רק בכמה
 * מהמידע הגיע מובנה. מי שמתקשר תוך כדי הליכה לא יעבור שאלון, ולא
 * נרצה לאבד אותו בגלל זה.
 *
 * השאלון עצמו הוא טופס 4018 בנדרים פלוס, באותו סדר ועם אותן רשימות
 * בחירה — כך שמי שנרשם בטלפון ומי שנרשם בעמדה נראים אותו דבר במאגר.
 * ארבעה שדות בלבד הם חובה; כל השאר מדולגים בסולמית, ואפשר לחזור אחורה
 * בכוכבית בכל שלב.
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

  const plan = maggidPlan(c);
  const taxonomy = await loadOptions(client, plan);

  const step = formStep(params, plan, taxonomy, c, {
    onExit: () => respond(say(c('nav.back')), goHome()),
  });
  if (!step.done) return step.response;

  const a = step.answers as Record<string, string | string[]>;
  const one = (key: string) => (Array.isArray(a[key]) ? (a[key] as string[])[0] : a[key] as string) || null;
  const many = (key: string) => (Array.isArray(a[key]) ? a[key] as string[] : a[key] ? [a[key] as string] : []);

  const { error } = await client.rpc('igud_submit_request', {
    p_kind: 'maggid',
    payload: {
      contact_name: one('full_name'),
      phone: one('phone') || phone,
      city: one('city'),
      source: 'yemot',
      source_ref: params.ApiCallId || null,
      details: {
        occupation: one('occupation'),
        background: one('background'),
        topics: many('topics'),
        audienceGender: one('audienceGender'),
        audienceStyles: many('audienceStyles'),
        language: one('language'),
        lessonCharacter: many('lessonCharacter'),
        speechStyle: one('speechStyle'),
        training: one('training'),
        days: many('days'),
        hours: many('hours'),
        travelRange: one('travelRange'),
        travel: one('travel'),
        payExpectation: one('payExpectation'),
        viaVoice: true,
      },
    },
  });

  if (error) return respond(say(c('nav.error'), c('nav.retry')), hangup());

  return farewell(c, c('maggid.done.1'), c('maggid.done.2'), c('maggid.done.3'));
}

export const GET = handle;
export const POST = handle;
