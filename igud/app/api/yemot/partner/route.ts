import { publicClient } from '@/lib/supabase';
import { goHome, isHangup, noop, read, respond, say, sayDigits, yemotParams } from '@/lib/yemot';
import { freeMessage } from '@/lib/ivr-flows';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 5 — שותפות בפעילות.
 *
 * היעד הוא סליקה טלפונית דרך נדרים פלוס. היא אינה פעילה כאן, ובכוונה:
 * החוזה המדויק של דף התשלום טרם התקבל, וניחוש של פרמטר בסליקה אינו
 * טעות שמתגלה בבדיקה — הוא תרומה שנכשלת, או גרוע מזה, כזו שנגבית
 * ואינה מגיעה ליעדה. עדיף מספר טלפון שעובד מאשר טופס שאינו.
 *
 * עד אז השלוחה עושה את הדבר המועיל שכן אפשר: אומרת שאפשר לתרום,
 * מוסרת מספר, ומאפשרת להשאיר הודעה כדי שיחזרו למתקשר.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');
  const client = publicClient();

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  if (!params.mode) {
    return respond(
      say(
        'איגוד השיעורים הוא הבית של שיעורי התורה בארץ ישראל',
        'כל שיעור שנפתח כאן, וכל לומד שמצא את מקומו, הם גם שלכם',
      ),
      read(
        'להשאיר פרטים ונחזור אליכם הקישו 1. לשמוע את מספר הטלפון לתרומות הקישו 2',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  if (params.mode === '2') {
    return respond(
      say('המספר לתרומות ולשותפות'),
      sayDigits(SITE.voiceLine),
      say('תודה, וזכות הרבים תעמוד לכם'),
      goHome(),
    );
  }

  // מסלול ההודעה משתמש באותו קוד של שאר השלוחות; mode=1 כאן, ולכן מומר
  const free = await freeMessage(client, { ...params, mode: '2' }, {
    kind: 'donation',
    requestKind: 'open_lesson',
    phone,
    invite: 'אמרו את שמכם, ובאיזה אופן תרצו לקחת חלק',
  });
  if (free) return free;

  return respond(say('לא זיהינו את הבחירה', 'נחזור לתפריט'), goHome());
}

export const GET = handle;
export const POST = handle;
