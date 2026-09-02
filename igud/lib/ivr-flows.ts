import type { SupabaseClient } from '@supabase/supabase-js';
import { hangup, read, respond, say } from '@/lib/yemot';
import { logRequest } from '@/lib/ivr-ai';
import { copyDefaults, type Copy } from '@/lib/ivr-copy';

/* ============================================================
   ניווט: יציאה, חזרה, ופרידה
   ============================================================ */

/**
 * כוכבית לחזרה, אפס לתפריט הראשי.
 *
 * ימות מחזירה בכל פנייה את כל המשתנים שכבר נקראו, ואי אפשר למחוק
 * אותם. לכן "חזרה" אינה מחיקה של הבחירה האחרונה אלא פתיחת סבב חדש:
 * לכל סבב מספר משלו, וכל המשתנים שלו נושאים אותו. זו הדרך היחידה
 * שבה חזרה באמת מנקה את המסך במקום למצוא את הבחירה הקודמת.
 */
export const isBack = (value?: string) => String(value || '').trim() === '*';
export const isHome = (value?: string) => String(value || '').trim() === '0';

/** מספר הסבב הפעיל, לפי כמה סבבים כבר נסגרו בשיחה. */
export function roundOf(params: Record<string, string>, marker: string): number {
  let n = 0;
  while (params[`${marker}${n}`] !== undefined) n += 1;
  return n;
}

/** הפרידה, זהה בכל השלוחות. */
export function farewell(c: Copy, ...before: string[]) {
  return respond(
    say(...before, c('nav.blessing'), c('nav.bye')),
    hangup(),
  );
}

/**
 * שני המסלולים שחוזרים בכל שלוחת הצטרפות.
 *
 * לא כל מי שמתקשר רוצה לענות על שאלון בהקשות. מי שיודע בדיוק מה למלא
 * מעדיף טופס מונחה; מי שמתקשר תוך כדי הליכה מעדיף לומר משפט ושיחזרו
 * אליו. שתי הדרכים מגיעות לאותו מקום — פנייה שממתינה לאישור בניהול —
 * ולכן אין כאן מסלול "נחות". ההבדל הוא רק בכמה מהמידע הגיע מובנה.
 */

/** שאלת הפתיחה: טופס מונחה או הודעה חופשית. */
export function askMode(c: Copy, ...intro: string[]) {
  return respond(
    say(...intro),
    read(c('mode.prompt'), 'mode', { min: 1, max: 1 }),
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
    kind: 'join' | 'host' | 'message' | 'human' | 'update' | 'donation';
    requestKind: string;
    phone: string;
    invite: string;
    /** הנוסחים. בלעדיהם משתמשים בברירות המחדל */
    copy?: Copy;
  },
): Promise<Response | null> {
  if (params.mode !== '2') return null;

  const spoken = (params.msg || '').trim();
  if (!spoken) {
    return respond(read(opts.invite, 'msg', { mode: 'voice', silence: 4, seconds: 60 }));
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

  const c = opts.copy || copyDefaults;

  if (error) {
    return respond(say(c('nav.error'), c('nav.retry'), c('nav.bye')), hangup());
  }

  return farewell(c, c('free.saved.1'), c('free.saved.2'));
}
