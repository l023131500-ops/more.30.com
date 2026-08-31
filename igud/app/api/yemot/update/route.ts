import { serviceClient } from '@/lib/supabase';
import { goHome, hangup, read, respond, say, yemotParams } from '@/lib/yemot';
import { describeLesson, numberedMenu } from '@/lib/ivr';
import { DAY_SLOTS } from '@/lib/nedarim.js';

export const dynamic = 'force-dynamic';

const digits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * שלוחה 2 — עדכון שיעור קיים.
 *
 * הזיהוי לפי מספר הטלפון של המתקשר, כפי שנשמר בפרטי הקשר של השיעור.
 * מהלך: בחירת שיעור -> בחירת יום -> שעה חדשה בארבע ספרות -> שמירה.
 */
async function handle(request: Request) {
  const params = await yemotParams(request);
  const phone = digits(params.ApiPhone || params.phone || '');

  if (phone.length < 9) {
    return respond(
      say('לא זוהה מספר הטלפון שלכם. לעדכון שיעור נא לפנות למשרדי האיגוד'),
      hangup(),
    );
  }

  const client = await serviceClient();

  // שיעורים ששויכו למספר הזה
  const { data: rows } = await client
    .from('igud_lessons')
    .select('id, title, topic, topics, teacher_name, venue_name, city, contact_phone, status')
    .limit(200);

  const mine = (rows || []).filter((row) => {
    const stored = digits(row.contact_phone as string);
    return stored.length >= 9 && stored.slice(-9) === phone.slice(-9);
  });

  if (!mine.length) {
    return respond(
      say('לא נמצאו שיעורים המשויכים למספר הזה'),
      say('לפרסום שיעור חדש הקישו 4 בתפריט הראשי'),
      goHome(),
    );
  }

  /* ---------- בחירת השיעור ---------- */
  if (!params.pick) {
    const menu = numberedMenu(mine.map((row) => describeLesson(row)));
    return respond(
      say(`נמצאו ${mine.length} שיעורים המשויכים אליכם`),
      read(menu.text, 'pick', { min: 1, max: 1 }),
    );
  }

  const lesson = mine[Number(params.pick) - 1];
  if (!lesson) return respond(say('בחירה לא תקינה'), goHome());

  /* ---------- בחירת היום ---------- */
  if (!params.day) {
    const menu = numberedMenu(DAY_SLOTS.map((d: { label: string }) => d.label));
    return respond(
      say('באיזה יום לעדכן את השעה'),
      read(menu.text, 'day', { min: 1, max: 1 }),
    );
  }

  const slot = DAY_SLOTS[Number(params.day) - 1] as { label: string; weekday: number } | undefined;
  if (!slot) return respond(say('בחירה לא תקינה'), goHome());

  /* ---------- שעה חדשה ---------- */
  if (!params.time) {
    return respond(
      read(
        `הקישו את השעה החדשה ל${slot.label} בארבע ספרות. לדוגמה, לשעה שמונה ורבע בערב הקישו 2015`,
        'time',
        { min: 4, max: 4 },
      ),
    );
  }

  const raw = digits(params.time);
  const hours = Number(raw.slice(0, 2));
  const minutes = Number(raw.slice(2, 4));
  if (raw.length !== 4 || hours > 23 || minutes > 59) {
    return respond(say('השעה שהוקשה אינה תקינה'), goHome());
  }
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  /* ---------- שמירה ---------- */
  const { data: existing } = await client
    .from('igud_occurrences')
    .select('id')
    .eq('lesson_id', lesson.id)
    .eq('day_label', slot.label)
    .maybeSingle();

  if (existing) {
    await client
      .from('igud_occurrences')
      .update({ time_of_day: time, note: null })
      .eq('id', existing.id);
  } else {
    await client.from('igud_occurrences').insert({
      lesson_id: lesson.id,
      weekday: slot.weekday,
      day_label: slot.label,
      time_of_day: time,
      sort: DAY_SLOTS.findIndex((d: { label: string }) => d.label === slot.label),
    });
  }

  await client.from('igud_audit').insert({
    actor: `yemot:${phone}`,
    action: 'yemot_lesson',
    entity: 'igud_occurrences',
    entity_id: String(lesson.id),
    meta: { day: slot.label, time, lesson: lesson.title || lesson.topic },
  });

  return respond(
    say(`השעה עודכנה. ${slot.label} בשעה ${time}`),
    say('העדכון ייכנס לתוקף באתר בתוך דקות ספורות'),
    read('לעדכון נוסף הקישו 1. לסיום הקישו 2', 'again', { min: 1, max: 1 }),
    params.again === '2' ? hangup() : goHome(),
  );
}

export const GET = handle;
export const POST = handle;
