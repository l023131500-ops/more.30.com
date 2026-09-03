import { publicClient } from '@/lib/supabase';
import {
  goHome, hangup, isHangup, noop, read, respond, say, yemotParams,
} from '@/lib/yemot';
import { numberedMenu } from '@/lib/ivr';
import { detailSpeech, lessonById, spokenTimes } from '@/lib/ivr-lesson';
import { formStep, loadOptions } from '@/lib/ivr-form';
import { daySlotOf, editPlan, EDIT_FIELDS, lessonPlan } from '@/lib/ivr-plans';
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
 * שלוחה 2 — הוספה ועדכון של שיעור.
 *
 * שני חצאים, ושניהם נדרשים כדי שהשלוחה תעשה את מה שהיא מבטיחה
 * בפתיחה שלה. הראשון הוא בעלות: מי שמתקשר מקבל את רשימת השיעורים
 * שרשומים עליו, מכל מקור שהוא — טופס בנדרים פלוס, פנייה מהאתר, או
 * שיחה קודמת לכאן — ויכול לאשר, לשנות שעה או להפסיק פרסום. השני הוא
 * הוספה: שאלון מלא שמכניס שיעור חדש למאגר, ממש כמו הטופס בעמדה.
 *
 * ההוספה פתוחה גם למי שלא מזוהה. אדם שמתקשר לספר על שיעור בבית
 * הכנסת שלו אינו בהכרח מי שרשום עליו משהו, וקו שאומר לו "לא נמצאו
 * שיעורים" ומחזיר אותו לתפריט הראשי הוא קו שסגר את הדלת בפניו.
 *
 * שלוש הפעולות על שיעור קיים נשענות על פונקציות במסד שבודקות בעצמן
 * שהשיעור אכן רשום על המספר הזה. הנתיב הטלפוני אינו מאומת מעבר לזיהוי
 * המספר, ולכן ההרשאה נבדקת במקום שאי אפשר לעקוף.
 *
 * אין כאן מחיקה, ובכוונה. זיהוי לפי מספר מתקשר אינו הרשאה מספיקה
 * למחוק לצמיתות רשומה שאנשים מסתמכים עליה. שיעור שהופסק יורד מהאתר
 * מיד, ההיסטוריה נשמרת, ואפשר להחזיר אותו בשיחה אחת. מחיקה אמיתית
 * נעשית בניהול, בידי אדם שהתחבר.
 *
 * השאלה "האם השיעור עדיין מתקיים כרגיל" היא הלב של החצי הראשון. מאגר
 * שיעורים מתיישן בשקט — שיעור שהופסק לפני חצי שנה נראה באתר בדיוק
 * כמו שיעור פעיל — ולכן כל שיחה לכאן היא הזדמנות לאשר, והאישור נרשם
 * עם תאריך.
 *
 * על הסבבים: ימות מחזירה בכל פנייה את כל המשתנים שנקראו ואי אפשר
 * למחוק אותם, ולכן "פעולה נוספת" ו"חזרה בכוכבית" פותחים סבב חדש עם
 * משתנים חדשים. גם השאלון נושא את מספר הסבב בתחילית שלו, כדי ששני
 * שיעורים שנוספים באותה שיחה לא ימצאו זה את תשובותיו של זה.
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

  /* ============================================================
     השאלון: הוספת שיעור חדש למאגר
     ============================================================ */

  const askNewLesson = async () => {
    const plan = lessonPlan(c, `nl${r}`);
    const taxonomy = await loadOptions(client, plan);

    const step = formStep(params, plan, taxonomy, c, {
      intro: [c('update.addIntro'), c('update.addNote')],
      onExit: () => respond(say(c('nav.back')), goHome()),
    });

    if (!step.done) return step.response;

    const a = step.answers as Record<string, string>;
    const slot = daySlotOf(a.day);

    // "הרב קוק 12" הוא רחוב ומספר, ושני שדות במסד
    const street = String(a.street || '').trim();
    const houseMatch = street.match(/\s(\d{1,4}[א-ת]?)$/);

    const { error } = await client.rpc('igud_submit_lesson', {
      payload: {
        teacher_name: a.teacher_name,
        topic: a.topic,
        topics: a.topic ? [a.topic] : [],
        city: a.city,
        venue_name: a.venue_name,
        street: houseMatch ? street.slice(0, houseMatch.index) : street || null,
        house_no: houseMatch ? houseMatch[1] : null,
        neighborhood: a.neighborhood || null,
        audience_gender: a.audience_gender || null,
        language: a.language || null,
        lesson_character: a.lesson_character ? [a.lesson_character] : [],
        contact_name: a.contact_name || a.teacher_name,
        contact_phone: a.contact_phone || phone,
        source: 'yemot',
        occurrences: slot ? [{
          weekday: slot.weekday,
          day_label: slot.label,
          time_of_day: a.time,
          sort: (DAY_SLOTS as { label: string }[]).findIndex((d) => d.label === slot.label),
        }] : [],
      },
    });

    if (error) {
      return respond(
        say(c('nav.error'), c('nav.retry')),
        read(c('update.more'), key('again'), { min: 1, max: 1 }),
      );
    }

    return respond(
      say(c('update.added.1'), c('update.added.2'), c('update.added.3')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  };

  /* ---------- זיהוי ---------- */
  if (phone.length < 9) {
    return respond(
      say(c('update.unknown.1'), c('update.unknown.2'), c('update.unknown.3'), c('nav.bye')),
      hangup(),
    );
  }

  const { data } = await client.rpc('igud_ivr_my_lessons', { p_phone: phone, p_email: null });
  const mine = (data || []) as MyLesson[];

  /* ============================================================
     מי שאין עליו שיעור רשום
     ============================================================ */

  if (!mine.length) {
    if (v('nm') === undefined) {
      return respond(
        say(c('update.none.1'), c('update.none.2')),
        read(c('update.newMenu'), key('nm'), { min: 1, max: 1 }),
      );
    }
    if (isBack(v('nm')) || isHome(v('nm'))) {
      return respond(say(c('nav.back')), goHome());
    }
    if (v('nm') === '2') {
      const free = await freeMessage(client, { ...params, mode: '2' }, {
        kind: 'update',
        requestKind: 'open_lesson',
        phone,
        invite: c('update.freeInvite'),
        copy: c,
      });
      if (free) return free;
    }
    return askNewLesson();
  }

  const pending = mine.filter((l) => l.status === 'pending').length;

  /** תיאור שיעור להקראה, כולל מתי הוא ואיפה, ומה מצבו. */
  const describe = (lesson: MyLesson) => {
    const parts = [lesson.title || lesson.topic || 'שיעור תורה'];
    if (lesson.venue_name) parts.push(`ב${lesson.venue_name}`);
    if (lesson.city) parts.push(`ב${lesson.city}`);
    if (lesson.when_text) parts.push(spokenTimes(lesson.when_text));
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
    return respond(say(c('nav.back')), goHome());
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

  /* ---------- 3: הוספת שיעור חדש ---------- */
  if (v('m') === '3') return askNewLesson();

  /* ---------- 4: הודעה חופשית ---------- */
  if (v('m') === '4') {
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
      read(`${menu.text}. ${c('nav.hint')}`, key('pick'), { min: 1, max: 1 }),
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

  /* ---------- הפרטים המלאים, ואז שלוש הפעולות ---------- */
  if (v('act') === undefined) {
    // שיעור מפורסם נקרא במלואו מכרטיס השיעור. שיעור שממתין לאישור
    // אינו בכרטיסים עדיין, ולכן נאמר עליו מה שידוע ולא נאמר "אין"
    const card = await lessonById(client, lesson.id);
    return respond(
      ...(card ? detailSpeech(card) : [say(describe(lesson))]),
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

  // 3 — הפסקת פרסום, אחרי אישור כפול
  if (v('act') === '3') {
    if (v('sure') === undefined) {
      return respond(read(c('update.sureAsk'), key('sure'), { min: 1, max: 1 }));
    }
    if (v('sure') !== '1') {
      return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
    }
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

  /* ============================================================
     2 — שינוי פרטי השיעור
     ============================================================ */

  if (v('ed') === undefined) {
    return respond(read(c('update.edit.menu'), key('ed'), { min: 1, max: 1 }));
  }
  if (isBack(v('ed'))) {
    return respond(say(c('nav.back')), read(c('update.more'), key('again'), { min: 1, max: 1 }));
  }

  /* ---------- שדה בודד, דרך אותו מנוע שאלון ---------- */
  if (EDIT_FIELDS[v('ed')]) {
    const spec = EDIT_FIELDS[v('ed')];
    const plan = editPlan(c, v('ed'), `ed${r}_`);
    if (plan) {
      const taxonomy = await loadOptions(client, plan);
      const step = formStep(params, plan, taxonomy, c, {
        onExit: () => respond(
          say(c('nav.back')),
          read(c('update.more'), key('again'), { min: 1, max: 1 }),
        ),
      });
      if (!step.done) return step.response;

      const value = step.answers.value as string;
      const { data: res } = await client.rpc('igud_ivr_set_field', {
        p_phone: phone,
        p_lesson: lesson.id,
        p_field: spec.field,
        p_value: value,
        p_source: 'yemot',
      });
      const result = (res as { success?: boolean; message?: string } | null) || {};
      if (result.success === false) {
        return respond(
          say(result.message || c('nav.error')),
          read(c('update.more'), key('again'), { min: 1, max: 1 }),
        );
      }

      // עדכון פרט הוא גם אישור שהשיעור מתקיים
      await client.rpc('igud_ivr_confirm', {
        p_phone: phone, p_lesson: lesson.id, p_source: 'yemot',
      });

      return respond(
        say(c('update.edit.done'), c('update.edit.online')),
        read(c('update.more'), key('again'), { min: 1, max: 1 }),
      );
    }
  }

  if (v('ed') !== '5') {
    return respond(
      say(c('nav.notFound')),
      read(c('update.more'), key('again'), { min: 1, max: 1 }),
    );
  }

  /* ---------- 5 — שינוי יום ושעה ---------- */
  if (v('day') === undefined) {
    const menu = numberedMenu(DAY_SLOTS.map((d: { label: string }) => d.label));
    return respond(
      say(c('update.dayAsk')),
      read(`${menu.text}. ${c('nav.hint')}`, key('day'), { min: 1, max: 1 }),
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
      c('update.saved.2', { day: slot.label, time: spokenTimes(time) }),
      c('update.saved.3'),
    ),
    read(c('update.more'), key('again'), { min: 1, max: 1 }),
  );
}

export const GET = handle;
export const POST = handle;
