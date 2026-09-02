import { publicClient } from '@/lib/supabase';
import { goHome, isHangup, noop, read, respond, say, sayDigits, yemotParams } from '@/lib/yemot';
import { freeMessage } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 6 — מענה אנושי והשארת הודעה.
 *
 * השלוחה האחרונה בתפריט היא זו שמונעת ממתקשר להיתקע. כל מסלול אחר
 * במערכת מניח שהפנייה מתאימה לאחת המשבצות; כאן אין הנחה כזו. מי שלא
 * מצא את מקומו בשום שלוחה אחרת מגיע לכאן, מדבר חופשי, ומקבל מספר.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = publicClient();
  const c = await loadCopy(client);

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return respond(
      say(c('contact.intro.1'), c('contact.intro.2')),
      read(c('contact.menu'), 'mode', { min: 1, max: 1 }),
    );
  }

  if (params.mode === '2') {
    return respond(
      say(c('contact.phone')),
      sayDigits(SITE.voiceLine),
      say(c('contact.phoneAfter'), c('nav.bye')),
      goHome(),
    );
  }

  // מסלול ההודעה משתמש באותו קוד של שאר השלוחות, שם 2 הוא ההודעה
  const free = await freeMessage(client, { ...params, mode: '2' }, {
    kind: 'human',
    requestKind: 'open_lesson',
    phone,
    invite: c('contact.freeInvite'),
    copy: c,
  });
  if (free) return free;

  return respond(say(c('nav.notFound'), c('nav.back')), goHome());
}

export const GET = handle;
export const POST = handle;
