import { publicClient } from '@/lib/supabase';
import { goHome, read, respond, say, yemotParams } from '@/lib/yemot';
import { freeMessage } from '@/lib/ivr-flows';
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

  if (!params.mode) {
    return respond(
      say('מענה אנושי והשארת הודעה'),
      read(
        'להשארת הודעה למערכת הקישו 2. לשמיעת מספר הטלפון של המשרד הקישו 1',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  if (params.mode === '1') {
    return respond(
      say(`מספר הטלפון של משרדי האיגוד הוא ${SITE.voiceLine.split('').join(' ')}`),
      say('אפשר גם להשאיר הודעה, ונחזור אליכם'),
      goHome(),
    );
  }

  const free = await freeMessage(client, params, {
    kind: 'human',
    requestKind: 'open_lesson',
    phone,
    invite: 'אמרו את ההודעה שלכם אחרי הצפצוף, ונציג יחזור אליכם',
  });
  if (free) return free;

  return respond(say('לא זוהתה בחירה'), goHome());
}

export const GET = handle;
export const POST = handle;
