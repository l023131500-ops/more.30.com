import { publicClient } from '@/lib/supabase';
import { goHome, read, respond, say, yemotParams } from '@/lib/yemot';
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

  if (!params.mode) {
    return respond(
      say('שותפות בפעילות איגוד השיעורים'),
      say('האיגוד מרכז את שיעורי התורה ברחבי הארץ ומחבר בין לומדים למלמדים'),
      read(
        'להשארת הודעה ולחזרה אליכם הקישו 1. לשמיעת מספר הטלפון הקישו 2',
        'mode',
        { min: 1, max: 1 },
      ),
    );
  }

  if (params.mode === '2') {
    return respond(
      say(`מספר הטלפון לתרומות ולשותפות הוא ${SITE.voiceLine.split('').join(' ')}`),
      goHome(),
    );
  }

  // מסלול ההודעה משתמש באותו קוד של שאר השלוחות; mode=1 כאן, ולכן מומר
  const free = await freeMessage(client, { ...params, mode: '2' }, {
    kind: 'donation',
    requestKind: 'open_lesson',
    phone,
    invite: 'אמרו את שמכם ובאיזה אופן תרצו לקחת חלק, ונחזור אליכם',
  });
  if (free) return free;

  return respond(say('לא זוהתה בחירה'), goHome());
}

export const GET = handle;
export const POST = handle;
