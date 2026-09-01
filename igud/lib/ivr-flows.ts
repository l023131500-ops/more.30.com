import type { SupabaseClient } from '@supabase/supabase-js';
import { hangup, read, respond, say } from '@/lib/yemot';
import { logRequest } from '@/lib/ivr-ai';

/**
 * שני המסלולים שחוזרים בכל שלוחת הצטרפות.
 *
 * לא כל מי שמתקשר רוצה לענות על שאלון בהקשות. מי שיודע בדיוק מה למלא
 * מעדיף טופס מונחה; מי שמתקשר תוך כדי הליכה מעדיף לומר משפט ושיחזרו
 * אליו. שתי הדרכים מגיעות לאותו מקום — פנייה שממתינה לאישור בניהול —
 * ולכן אין כאן מסלול "נחות". ההבדל הוא רק בכמה מהמידע הגיע מובנה.
 */

export const MODE_PROMPT =
  'למילוי הפרטים בצורה מדויקת הקישו 1. להשארת הודעה למערכת בשפה שלכם הקישו 2';

/** שאלת הפתיחה: טופס מונחה או הודעה חופשית. */
export function askMode(title: string, subtitle?: string) {
  return respond(
    say(title),
    subtitle ? say(subtitle) : '',
    read(MODE_PROMPT, 'mode', { min: 1, max: 1 }),
  );
}

/**
 * מסלול ההודעה החופשית.
 *
 * מחזיר תשובה כשהמסלול הזה מטפל בשיחה, ו-null כשצריך להמשיך לטופס
 * המונחה. כך השלוחה הקוראת נשארת קריאה: אם חזר משהו — מחזירים אותו.
 */
export async function freeMessage(
  client: SupabaseClient,
  params: Record<string, string>,
  opts: {
    kind: 'join' | 'host' | 'message' | 'human' | 'update';
    requestKind: string;
    phone: string;
    invite: string;
  },
): Promise<Response | null> {
  if (params.mode !== '2') return null;

  const spoken = (params.msg || '').trim();
  if (!spoken) {
    return respond(read(opts.invite, 'msg', { mode: 'voice', max: 120, wait: 12 }));
  }

  const { error } = await client.rpc('igud_submit_request', {
    p_kind: opts.requestKind,
    payload: {
      contact_name: `פנייה קולית ${opts.phone}`,
      phone: opts.phone,
      source: 'yemot',
      source_ref: params.ApiCallId || null,
      details: { message: spoken, viaVoice: true, freeText: true },
    },
  });

  await logRequest(client, {
    callId: params.ApiCallId,
    phone: opts.phone,
    extension: params.ApiExtension,
    kind: opts.kind,
    spoken,
    count: null,
    resolved: !error,
  });

  if (error) {
    return respond(
      say('אירעה תקלה בשמירת ההודעה. נא לנסות שוב מאוחר יותר'),
      hangup(),
    );
  }

  return respond(
    say('ההודעה נקלטה. תודה רבה'),
    say('נציג מהאיגוד יאזין לה ויחזור אליכם בהקדם'),
    hangup(),
  );
}
