import { publicClient } from '@/lib/supabase';
import {
  goHome, goToFolder, isHangup, noop, read, respond, say, yemotParams,
} from '@/lib/yemot';
import { isBack, isHome } from '@/lib/ivr-flows';
import { spokenTimes } from '@/lib/ivr-lesson';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');
const ORDINAL = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי', 'השביעי'];

interface MyLesson {
  title: string | null;
  topic: string | null;
  venue_name: string | null;
  city: string | null;
  status: string;
  when_text: string | null;
}

/** תיאור שיעור להקראה, כולל מצבו */
function describe(lesson: MyLesson, c: (k: string) => string) {
  const parts = [lesson.title || lesson.topic || 'שיעור תורה'];
  if (lesson.venue_name) parts.push(`ב${lesson.venue_name}`);
  if (lesson.city) parts.push(`ב${lesson.city}`);
  if (lesson.when_text) parts.push(spokenTimes(lesson.when_text));
  if (lesson.status === 'pending') parts.push(c('update.statusPending'));
  if (lesson.status === 'paused') parts.push(c('update.statusPaused'));
  return parts.join(' ');
}

/**
 * שלוחה 8 — פורטל מגידי השיעורים.
 *
 * הפורטל פתוח רק למי שכבר רשום כמגיד שיעור או כאיש קשר של שיעור
 * במאגר. הבדיקה היא קיומו של שיעור הרשום על מספר המתקשר, ולכן היא
 * אינה מסתמכת על רשימה נפרדת שצריך לתחזק: מי שיש לו שיעור, יש לו
 * פורטל.
 *
 * שתי האפשרויות בתפריט אינן זהות, וזה תוקן: הראשונה מקריאה כאן את
 * השיעורים, והשנייה מעבירה לשלוחה 2 שבה נמצא מהלך העדכון המלא.
 * תפריט שמציע בחירה ולא מכבד אותה גרוע מתפריט קצר, ושכפול של מהלך
 * העדכון היה מבטיח ששתי הגרסאות יתפצלו תוך חודש.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  const { data } = await client.rpc('igud_ivr_my_lessons', { p_phone: phone, p_email: null });
  const mine = (data || []) as MyLesson[];

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

  /* ---------- 1: הקראת השיעורים כאן ---------- */
  if (params.m === '1') {
    if (!params.after) {
      return respond(
        say(c('portal.listIntro')),
        say(...mine.map((lesson, i) => {
          const label = ORDINAL[i]
            ? c('update.listItem', { ordinal: ORDINAL[i] })
            : c('search.lessonMore');
          return `${label} | ${describe(lesson, c)}`;
        })),
        read(c('portal.after'), 'after', { min: 1, max: 1 }),
      );
    }
    if (params.after !== '1') return respond(say(c('nav.back')), goHome());
  }

  /* ---------- 2: מהלך העדכון המלא, בשלוחה 2 ---------- */
  return respond(goToFolder('/2'));
}

export const GET = handle;
export const POST = handle;
