import { publicClient } from '@/lib/supabase';
import {
  goHome, goToFolder, isHangup, noop, read, respond, say, yemotParams,
} from '@/lib/yemot';
import { isBack, isHome } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 8 — פורטל מגידי השיעורים.
 *
 * הפורטל פתוח רק למי שכבר רשום כמגיד שיעור או כאיש קשר של שיעור
 * במאגר. הבדיקה היא קיומו של שיעור הרשום על מספר המתקשר, ולכן היא
 * אינה מסתמכת על רשימה נפרדת שצריך לתחזק: מי שיש לו שיעור, יש לו
 * פורטל.
 *
 * הפעולות עצמן — לשמוע את השיעורים שלי, לעדכן שיעור — הן בדיוק אלה
 * של שלוחה 2, ולכן הן אינן משוכפלות כאן. הפורטל מזהה, אומר שלום,
 * ומעביר לשם. שכפול של מהלך עדכון שלם היה מבטיח ששתי הגרסאות יתפצלו
 * תוך חודש.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  const { data } = await client.rpc('igud_ivr_my_lessons', { p_phone: phone, p_email: null });
  const mine = (data || []) as unknown[];

  if (!mine.length) {
    return respond(
      say(c('portal.intro.1'), c('portal.notTeacher.1'), c('portal.notTeacher.2'), c('nav.bye')),
      goHome(),
    );
  }

  if (!params.m) {
    return respond(
      say(c('portal.intro.1')),
      read(c('portal.menu'), 'm', { min: 1, max: 1 }),
    );
  }
  if (isBack(params.m) || isHome(params.m)) {
    return respond(say(c('nav.back')), goHome());
  }

  // שתי האפשרויות מגיעות לאותו מקום, וזו לא עצלנות: שלוחה 2 היא
  // המהלך המלא של השיעורים שלי, ופיצול שלו לשתי גרסאות היה מבטיח
  // ששתיהן יתפצלו
  return respond(goToFolder('/2'));
}

export const GET = handle;
export const POST = handle;
