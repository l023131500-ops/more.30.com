import { publicClient } from '@/lib/supabase';
import {
  goHome, goToFolder, isHangup, noop, read, respond, say, sayDigits, yemotParams,
} from '@/lib/yemot';
import { freeMessage, isBack, isHome } from '@/lib/ivr-flows';
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

  if (isBack(params.mode) || isHome(params.mode)) {
    return respond(say(c('nav.back')), goHome());
  }

  /* ---------- 1: העברה לנציג ---------- */
  //
  // ההעברה עצמה נעשית בשלוחת ניתוב בימות, ולא בפקודה מכאן. זו אינה
  // עקיפה אלא המקום הנכון: מספר הנציג, זמן ההמתנה ומה קורה כשאין
  // מענה הם הגדרות של מרכזייה, ומי שמחזיק את הגישה לימות רואה אותן
  // ומשנה אותן בלי פריסה. השרת רק מחליט מתי להעביר.
  if (params.mode === '1') {
    const { data: rows } = await client
      .from('igud_settings').select('value').eq('key', 'agent').maybeSingle();
    const agent = ((rows as { value?: Record<string, unknown> } | null)?.value || {}) as {
      enabled?: boolean | string; folder?: string;
    };
    const on = agent.enabled === true || agent.enabled === 'true' || agent.enabled === 'yes';
    const folder = String(agent.folder || '').trim();

    if (on && folder) {
      // בלי הכרזה. מי שביקש נציג רוצה נציג, ולא משפט שמסביר לו שהוא
      // עומד לקבל נציג — שלוחת הניתוב מנגנת בזמן ההמתנה
      return respond(goToFolder(folder));
    }
    // אין נציג מוגדר: לא מנתקים ולא משמיעים שגיאה, אלא ממשיכים להודעה
    return respond(
      say(c('contact.agent.none')),
      read(c('contact.freeInvite'), 'msg', { mode: 'voice', silence: 4, seconds: 60 }),
    );
  }

  /* ---------- 3: מספר הטלפון ---------- */
  if (params.mode === '3') {
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
