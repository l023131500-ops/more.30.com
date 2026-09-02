import { publicClient } from '@/lib/supabase';
import { goHome, isHangup, noop, read, respond, say, sayDigits, yemotParams } from '@/lib/yemot';
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

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return respond(
      say('הגעתם למענה האנושי של האיגוד', 'כאן אפשר לשאול כל דבר'),
      read(
        'להשאיר הודעה ונחזור אליכם הקישו 1. לשמוע את מספר הטלפון של המשרד הקישו 2',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  if (params.mode === '2') {
    return respond(
      say('מספר הטלפון של משרדי האיגוד'),
      sayDigits(SITE.voiceLine),
      say('אפשר גם להשאיר כאן הודעה, ונחזור אליכם'),
      goHome(),
    );
  }

  // מסלול ההודעה משתמש באותו קוד של שאר השלוחות, שם 2 הוא ההודעה
  const free = await freeMessage(client, { ...params, mode: '2' }, {
    kind: 'human',
    requestKind: 'open_lesson',
    phone,
    invite: 'ספרו לנו במה נוכל לעזור, ונחזור אליכם',
  });
  if (free) return free;

  return respond(say('לא זיהינו את הבחירה', 'נחזור לתפריט'), goHome());
}

export const GET = handle;
export const POST = handle;
