import { publicClient } from '@/lib/supabase';
import {
  goHome, hangup, isHangup, noop, read, respond, say, yemotParams,
} from '@/lib/yemot';
import { numberedMenu } from '@/lib/ivr';
import { farewell, freeMessage, isBack, isHome, roundOf } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';
import { DAY_SLOTS } from '@/lib/nedarim.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const digits = (v: string) => String(v || '').replace(/\D/g, '');
const ORDINAL = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי', 'השביעי'];

interface MyLesson {
  id: string;
  title: string | null;
  topic: string | null;
  teacher_name: string | null;
  venue_name: string | null;
  city: string | null;
  status: string;
  source: string | null;
  when_text: string | null;
  confirmed_at: string | null;
}

/**
 * שלוחה 2 — השיעורים שלי.
 *
 * הרעיון שמאחורי השלוחה הזו אינו "עדכון" אלא בעלות. מי שמתקשר מקבל
 * את רשימת השיעורים שרשומים עליו, מכל מקור שהוא — טופס בנדרים פלוס,
 * פנייה מהאתר, או שיחה קודמת לכאן — ויכול לומר עליהם משהו. הזיהוי
 * לפי המספר שממנו הוא מתקשר, כפי שנשמר בפרטי הקשר של השיעור.
 *
 * שלוש הפעולות על שיעור הן אישור, שינוי שעה והפסקת פרסום, וכולן
 * נשענות על פונקציות במסד שבודקות בעצמן שהשיעור אכן רשום על המספר
 * הזה. הנתיב הטלפוני אינו מאומת מעבר לזיהוי המספר, ולכן ההרשאה
 * נבדקת במקום שאי אפשר לעקוף.
 *
 * אין כאן מחיקה, ובכוונה. זיהוי לפי מספר מתקשר אינו הרשאה מספיקה
 * למחוק לצמיתות רשומה שאנשים מסתמכים עליה. שיעור שהופסק יורד מהאתר
 * מיד, ההיסטוריה נשמרת, ואפשר להחזיר אותו בשיחה אחת. מחיקה אמיתית
 * נעשית בניהול, בידי אדם שהתחבר.
 *
 * השאלה "האם השיעור עדיין מתקיים כרגיל" היא הלב של השלוחה. מאגר
 * שיעורים מתיישן בשקט — שיעור שהופסק לפני חצי שנה נראה באתר בדיוק
 * כמו שיעור פעיל — ולכן כל שיחה לכאן היא הזדמנות לאשר, והאישור נרשם
 * עם תאריך.
 *
 * על הסבבים: ימות מחזירה בכל פנייה את כל המשתנים שנקראו ואי אפשר
 * למחוק אותם, ולכן "עדכון נוסף" ו"חזרה בכוכבית" פותחים סבב חדש עם
 * משתנים חדשים. בלי זה הבחירה הקודמת הייתה נמצאת שוב.
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

  /* ---------- סגירת הסבב הקודם ---------- */
  if (r > 0) {
    const last = params[`again${r - 1}`];
    if (last === '2' || isHome(last)) {
      return last === '2' ? farewell(c) : respond(say(c('nav.back')), goHome());
    }
  }

  /* ---------- זיהוי ---------- */
  if (phone.length < 9) {
    return respond(
      say(c('update.unknown.1'), c('update.unknown.2'), c('update.unknown.3'), c('nav.bye')),
      hangup(),
    );
  }

  const { data } = await client.rpc('igud_ivr_my_lessons', { p_phone: phone, p_email: null });
  const mine = (data || []) as MyLesson[];

  if (!mine.length) {
    return respond(
      say(c('update.none.1'), c('update.none.2'), c('update.none.3'), c('nav.bye')),
      goHome(),
    );
  }

  const pending = mine.filter((l) => l.status === 'pending').length;

  /** תיאור שיעור להקראה, כולל מתי הוא ואיפה, ומה מצבו. */
  const describe = (lesson: MyLesson) => {
    const parts = [lesson.title || lesson.topic || 'שיעור תורה'];
    if (lesson.venue_name) parts.push(`ב${lesson.venue_name}`);
    if (lesson.city) parts.push(`ב${lesson.city}`);
    if (lesson.when_text) parts.push(lesson.when_text);
    if (lesson.status === 'pending') parts.push(c('update.statusPending'));
    if (lesson.status === 'paused') parts.push(c('update.statusPaused'));
    return parts.join(' ');
  };

  /* ---------- התפריט של השלוחה ---------- */
  if (v('m') === undefined) {
    return respond(
      say(mine.length === 1
        ? c('update.greetOne')
        : c('update.greetMany', { count: mine.length })),
      pending ? say(c('update.pending', { count: pending })) : '',
      read(c('update.menu'), key('m'), { min: 1, max: 1 }),
    );
  }

  if (isBack(v('m')) || isHome(v('m'))) {
    return respond(say(c('nav.back')), isHome(v('m')) ? goHome() : goHome());
  }

  /* ---------- 1: שמיעת השיעורים שלי ---------- */
  if (v('m') === '1' && v('pick') === undefined) {
    return respond(
      say(c('update.listIntro')),
      say(...mine.map((lesson, i) => {
        const label = ORDINAL[i]
          ? c('update.listItem', { ordinal: ORDINAL[i] })
          : c('search.lessonMore');
        return `${label} | ${describe(lesson)}`;
      })),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  /* ---------- 3: הודעה חופשית ---------- */
  if (v('m') === '3') {
    const free = await freeMessage(client, { ...params, mode: '2' }, {
      kind: 'update',
      requestKind: 'open_lesson',
      phone,
      invite: c('update.freeInvite'),
      copy: c,
    });
    if (free) return free;
  }

  /* ---------- 2: בחירת שיעור ---------- */
  if (v('pick') === undefined) {
    const menu = numberedMenu(mine.map((lesson) => describe(lesson)));
    return respond(
      say(c('update.pickAsk')),
      read(menu.text, key('pick'), { min: 1, max: 1 }),
    );
  }
  if (isBack(v('pick'))) {
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  const lesson = mine[Number(v('pick')) - 1];
  if (!lesson) {
    return respond(
      say(c('nav.notFound')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  /* ---------- שיעור מושהה: הצעה להחזיר ---------- */
  if (lesson.status === 'paused') {
    if (v('act') === undefined) {
      return respond(read(c('update.resumeAsk'), key('act'), { min: 1, max: 1 }));
    }
    if (v('act') === '1') {
      const { data: res } = await client.rpc('igud_ivr_set_status', {
        p_phone: phone, p_lesson: lesson.id, p_status: 'published', p_source: 'yemot',
      });
      const ok = (res as { success?: boolean } | null)?.success !== false;
      return respond(
        say(ok ? c('update.resumed') : c('nav.error')),
        read(c('update.more'), key('again'), { min: 1, max: 1 }),
      );
    }
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  /* ---------- שלוש הפעולות ---------- */
  if (v('act') === undefined) {
    return respond(
      say(c('update.stillOn')),
      read(c('update.stillOnMenu'), key('act'), { min: 1, max: 1 }),
    );
  }
  if (isBack(v('act'))) {
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  // 1 — הכל כרגיל
  if (v('act') === '1') {
    const { data: res } = await client.rpc('igud_ivr_confirm', {
      p_phone: phone, p_lesson: lesson.id, p_source: 'yemot',
    });
    const ok = (res as { success?: boolean } | null)?.success !== false;
    return respond(
      say(ok ? c('update.confirmed.1') : c('nav.error'), ok ? c('update.confirmed.2') : ''),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  // 3 — הפסקת פרסום
  if (v('act') === '3') {
    const { data: res } = await client.rpc('igud_ivr_set_status', {
      p_phone: phone, p_lesson: lesson.id, p_status: 'paused', p_source: 'yemot',
    });
    const result = (res as { success?: boolean; message?: string } | null) || {};
    if (result.success === false) {
      return respond(
        say(result.message || c('nav.error')),
        read(c('update.more'), key('again'), { min: 1, max: 1 }),
      );
    }
    return respond(
      say(c('update.pausedDone.1'), c('update.pausedDone.2'), c('update.pausedDone.3')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  /* ---------- 2 — שינוי שעה ---------- */
  if (v('day') === undefined) {
    const menu = numberedMenu(DAY_SLOTS.map((d: { label: string }) => d.label));
    return respond(
      say(c('update.dayAsk')),
      read(menu.text, key('day'), { min: 1, max: 1 }),
    );
  }
  if (isBack(v('day'))) {
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  const slot = DAY_SLOTS[Number(v('day')) - 1] as { label: string; weekday: number } | undefined;
  if (!slot) {
    return respond(
      say(c('nav.notFound')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  if (v('time') === undefined) {
    return respond(
      read(c('update.timeAsk', { day: slot.label }), key('time'),
        { min: 4, max: 4, echo: 'Time', confirm: true }),
    );
  }

  const raw = digits(v('time'));
  const hours = Number(raw.slice(0, 2));
  const minutes = Number(raw.slice(2, 4));
  if (raw.length !== 4 || hours > 23 || minutes > 59) {
    return respond(
      say(c('update.timeBad.1'), c('update.timeBad.2')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const { error } = await client.rpc('igud_ivr_set_time', {
    p_phone: phone,
    p_lesson: lesson.id,
    p_day_label: slot.label,
    p_weekday: slot.weekday,
    p_time: time,
    p_sort: DAY_SLOTS.findIndex((d: { label: string }) => d.label === slot.label),
  });

  if (error) {
    return respond(
      say(c('nav.error'), c('nav.retry')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  // שמירת שעה היא גם אישור שהשיעור מתקיים
  await client.rpc('igud_ivr_confirm', {
    p_phone: phone, p_lesson: lesson.id, p_source: 'yemot',
  });

  return respond(
    say(
      c('update.saved.1'),
      c('update.saved.2', { day: slot.label, time }),
      c('update.saved.3'),
    ),
    read(c('update.more'), key('again'), { min: 1, max: 1 }),
  );
}

export const GET = handle;
export const POST = handle;
