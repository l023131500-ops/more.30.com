import { publicClient } from '@/lib/supabase';
import {
  goHome, isHangup, noop, read, respond, say, yemotParams,
} from '@/lib/yemot';
import { numberedMenu } from '@/lib/ivr';
import { spokenTimes } from '@/lib/ivr-lesson';
import { farewell, isBack, isHome, roundOf } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');
const ORDINAL = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי', 'השביעי'];

interface Saved {
  id: string;
  title: string | null;
  topic: string | null;
  teacher_name: string | null;
  venue_name: string | null;
  city: string | null;
  when_text: string | null;
}

/**
 * שלוחה 7 — האזור האישי.
 *
 * כאן שומעים את זמני השיעורים ששמרו למעקב. הרשימה נבנית בשלוחת החיפוש,
 * בהקשה על 5 אחרי שיעור שנשמע, וזו הסיבה שהיא קיימת: מי שמצא שיעור
 * מתאים בטלפון אינו זוכר אותו בשבוע הבא, ולחזור ולחפש אותו מחדש בכל
 * פעם זה בדיוק מה שגורם לאנשים להפסיק.
 *
 * הזיהוי הוא מספר הטלפון בלבד, וזו הרשאה חלשה. לכן מה שמותר כאן חלש
 * בהתאם: לשמוע ולהסיר שיעורים שנשמרו, וכולם מפורסמים וציבוריים ממילא.
 * אין כאן שום נתון שאינו גלוי גם באתר, ואין דרך להגיע לרשימה של מספר
 * אחר. הבדיקה עצמה יושבת במסד ולא כאן.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (isHangup(params)) return respond(noop('המתקשר ניתק'));

  const r = roundOf(params, 'again');
  const key = (name: string) => `${name}${r}`;
  const v = (name: string) => params[key(name)];

  if (r > 0) {
    const last = params[`again${r - 1}`];
    if (last === '2') return farewell(c);
    if (isHome(last)) return respond(say(c('nav.back')), goHome());
  }

  const { data } = await client.rpc('igud_ivr_saved_lessons', { p_phone: phone });
  const saved = (data || []) as Saved[];

  if (!saved.length) {
    return respond(
      say(c('personal.empty.1'), c('personal.empty.2'), c('nav.bye')),
      goHome(),
    );
  }

  const describe = (lesson: Saved) => [
    lesson.title || lesson.topic || 'שיעור תורה',
    lesson.teacher_name ? `מפי ${lesson.teacher_name}` : '',
    lesson.venue_name ? `ב${lesson.venue_name}` : '',
    lesson.city ? `ב${lesson.city}` : '',
    spokenTimes(lesson.when_text || ''),
  ].filter(Boolean).join(' ');

  /* ---------- התפריט ---------- */
  if (v('m') === undefined) {
    return respond(
      say(c('personal.intro.1'), c('personal.intro.2')),
      say(saved.length === 1 ? c('personal.countOne') : c('personal.count', { count: saved.length })),
      read(c('personal.menu'), key('m'), { min: 1, max: 1 }),
    );
  }
  if (isBack(v('m')) || isHome(v('m'))) {
    return respond(say(c('nav.back')), goHome());
  }

  /* ---------- 1: שמיעת השיעורים ---------- */
  if (v('m') === '1') {
    return respond(
      say(...saved.map((lesson, i) => {
        const label = ORDINAL[i]
          ? c('update.listItem', { ordinal: ORDINAL[i] })
          : c('search.lessonMore');
        return `${label} | ${describe(lesson)}`;
      })),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  /* ---------- 2: הסרה מהמעקב ---------- */
  if (v('pick') === undefined) {
    const menu = numberedMenu(saved.map((lesson) => describe(lesson)));
    return respond(
      say(c('personal.removeAsk')),
      read(`${menu.text}. ${c('nav.hint')}`, key('pick'), { min: 1, max: 1 }),
    );
  }
  if (isBack(v('pick'))) {
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  const lesson = saved[Number(v('pick')) - 1];
  if (!lesson) {
    return respond(
      say(c('nav.notFound')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  await client.rpc('igud_ivr_forget_lesson', { p_phone: phone, p_lesson: lesson.id });

  return respond(
    say(c('personal.removed')),
    read(c('update.more'), key('again'), { min: 1, max: 1 }),
  );
}

export const GET = handle;
export const POST = handle;
