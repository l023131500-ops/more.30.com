import { publicClient } from '@/lib/supabase';
import { goHome, isHangup, noop, read, respond, say, yemotParams } from '@/lib/yemot';
import { topCities, topTopics } from '@/lib/ivr';
import {
  countLessons, detailSpeech, keywordsOf, lessonById, listLine, matchOne,
  narrowOptions, pageOfLessons, type LessonRow, type SearchFilter,
} from '@/lib/ivr-lesson';
import { describeIntent, logRequest, readIntent, type Intent } from '@/lib/ivr-ai';
import { farewell, isBack, pageState, roundOf } from '@/lib/ivr-flows';
import { loadCopy } from '@/lib/ivr-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * שלוחה 1 — חיפוש שיעור.
 *
 * ארבעה מסלולים שמגיעים לאותו מקום: חיפוש חכם שבו אומרים משפט שלם,
 * וחיפוש לפי שם הרב, לפי נושא או לפי עיר. בכל אחד מהם המתקשר מדבר,
 * שומע מה המערכת הבינה, ומאשר. רק אז מחפשים.
 *
 * שלושה כללים שאין לחרוג מהם, וכל אחד מהם נלמד מכישלון:
 *
 *   מסנן ריק אינו "הכול" אלא "לא הבנתי". אם מהמשפט לא חולץ דבר,
 *   אסור להקריא את המאגר. מנסים מילות מפתח, ואם גם הן לא מצאו —
 *   אומרים שלא נמצא.
 *
 *   ברשימה נאמרים שלושה פרטים בלבד: שם הרב, תפקידו, ונושא השיעור.
 *   הפרטים המלאים ממתינים אחרי הבחירה.
 *
 *   כל הקלטה מלווה בשיקוף ובאישור. תמלול שגוי שממשיך בשקט הוא הדרך
 *   הבטוחה לגרום למתקשר לחשוב שאין שיעורים בעיר שלו.
 *
 * על שמות המשתנים: ימות המשיח מחזירה בכל פנייה את כל המשתנים שכבר
 * נקראו בשלוחה, ואי אפשר למחוק אותם. הם זיכרון השיחה, וגם כלא שלה.
 * לכן כל שלב מקודד את מיקומו בתוך שם המשתנה:
 *
 *   m0, m1     בחירת המסלול. סבב חדש פותח מספר חדש
 *   q0, q1     מה שנאמר. הקלטה מחדש היא סבב חדש
 *   ok0_0      האישור. שמיעה חוזרת מוסיפה ספרה, כי צריך לשאול שוב
 *   pick0      מה לעשות ברשימה ארוכה
 *   nr0_0      צמצום הרשימה, ממופה לעמודים
 *   p0_0       הקשה ברשימת התוצאות. אפס מקדם עמוד, ורק אפס
 *   d0_2_0     תפריט הפרטים. המספר האמצעי הוא מצב הרשימה, וכך
 *              "חזרה לרשימה" פותחת מרחב חדש ולא נתקעת בלולאה
 *   nf0        התפריט של חיפוש שלא מצא
 *
 * מונים ולא דגלים. דגל אי אפשר לכבות, ומונה תמיד אפשר לקדם.
 */

/** תשע היו מתנגשות עם "לשמיעה חוזרת הקישו 9", ולכן שמונה */
const PAGE = 8;

const MODE_ASK: Record<string, string> = {
  '1': 'search.ask.smart',
  '2': 'search.ask.teacher',
  '3': 'search.ask.topic',
  '4': 'search.ask.city',
};

/**
 * הערכים שאפשר להתאים אליהם מה שנאמר, ולא רק מה שכבר יש במאגר.
 *
 * ההתאמה נעשתה עד עכשיו רק מול ערים שיש בהן שיעורים, ולכן מי שאמר שם
 * של עיר שעדיין אין בה שיעור לא הותאם כלל, והחיפוש נפל למילות מפתח
 * גם כשהעיר נאמרה בבירור. הרשימה המלאה של הטופס נכנסת עכשיו ראשונה,
 * ומה שבמאגר מתווסף אליה — כך שגם עיר או נושא שאינם ברשימה עדיין
 * מותאמים אם הם קיימים בפועל.
 *
 * ומה שלא הותאם לשום ערך אינו אבוד: הוא ממשיך לחיפוש לפי מילות מפתח.
 */
async function knownValues(
  client: ReturnType<typeof publicClient>,
  kind: string,
  fromData: (c: ReturnType<typeof publicClient>, limit: number) => Promise<string[]>,
): Promise<string[]> {
  const [taxonomy, used] = await Promise.all([
    client.from('igud_taxonomy').select('value').eq('kind', kind).eq('active', true),
    fromData(client, 300),
  ]);
  const list = ((taxonomy.data || []) as { value: string }[]).map((row) => row.value);
  return [...new Set([...list, ...used])];
}

async function handle(request: Request) {
  const params = await yemotParams(request);
  const client = publicClient();
  const c = await loadCopy(client);

  const meta = {
    callId: params.ApiCallId,
    phone: params.ApiPhone,
    extension: params.ApiExtension,
    kind: 'search' as const,
  };

  /* ============================================================
     איפה אנחנו בשיחה
     ============================================================ */

  const mn = roundOf(params, 'm');
  const qn = roundOf(params, 'q');
  const R = Math.max(mn, qn, 1) - 1;

  /** המסלול של הסבב הזה. הקלטה מחדש אינה שואלת שוב, ולכן יורשת */
  const modeOf = (round: number): string => {
    for (let i = round; i >= 0; i -= 1) {
      const value = String(params[`m${i}`] ?? '').trim();
      if (value) return value;
    }
    return '1';
  };

  const spoken = String(params[`q${R}`] ?? '').trim();

  /* ---------- ניתוק באמצע ---------- */
  if (isHangup(params)) {
    if (spoken) await logRequest(client, { ...meta, spoken, count: null, resolved: false });
    return respond(noop('המתקשר ניתק'));
  }

  /* ============================================================
     שלב א: בחירת המסלול
     ============================================================ */

  if (mn === 0 && qn === 0) {
    return respond(
      say(c('search.intro.1'), c('search.intro.2')),
      read(c('search.menu'), 'm0', { min: 1, max: 1 }),
    );
  }

  const mode = modeOf(R);
  if (isBack(params[`m${R}`])) return respond(say(c('nav.back')), goHome());
  if (!MODE_ASK[mode]) {
    return respond(say(c('nav.notFound')), read(c('search.menu'), `m${mn}`, { min: 1, max: 1 }));
  }

  /* ============================================================
     שלב ב: מה שנאמר
     ============================================================ */

  if (qn <= R) {
    return respond(read(c(MODE_ASK[mode]), `q${R}`, { mode: 'voice', silence: 3, seconds: 20 }));
  }

  /* ---------- התמלול חזר ריק ---------- */
  if (!spoken) {
    let empties = 0;
    for (let i = R; i >= 0 && String(params[`q${i}`] ?? '').trim() === ''; i -= 1) empties += 1;

    if (empties < 3) {
      return respond(
        say(c('search.notHeard')),
        read(c(MODE_ASK[mode]), `q${R + 1}`, { mode: 'voice', silence: 3, seconds: 20 }),
      );
    }
    // שלושה ניסיונות. לא ממשיכים לנסות, מציעים מסלול אחר
    await logRequest(client, { ...meta, spoken: '', count: 0, resolved: false });
    return respond(
      say(c('search.notHeard'), c('search.none.2')),
      read(c('search.none.menu'), `nf${R}`, { min: 1, max: 1 }),
    );
  }

  /* ============================================================
     שלב ג: שיקוף ואישור
     ============================================================ */

  const ok = pageState(params, `ok${R}_`);

  if (ok.last === null) {
    return respond(
      say(c('search.heard', { text: spoken })),
      read(c('search.confirm'), ok.next, { min: 1, max: 1 }),
    );
  }

  if (ok.last === '3') {
    // שמיעה חוזרת של מה שהמערכת הבינה
    return respond(
      say(c('search.heard', { text: spoken })),
      read(c('search.confirm'), ok.next, { min: 1, max: 1 }),
    );
  }

  if (ok.last === '2') {
    // הקלטה מחדש, באותו מסלול
    return respond(read(c(MODE_ASK[mode]), `q${R + 1}`, { mode: 'voice', silence: 3, seconds: 20 }));
  }

  if (ok.last === '4' || isBack(ok.last)) {
    return respond(say(c('nav.back')), read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }));
  }

  if (ok.last !== '1') {
    return respond(say(c('nav.notFound')), read(c('search.confirm'), ok.next, { min: 1, max: 1 }));
  }

  /* ============================================================
     שלב ד: מה מחפשים
     ============================================================ */

  let filter: SearchFilter = {};
  let heading = '';
  let intent: Intent | null = null;

  if (mode === '1') {
    intent = await readIntent(spoken);
    filter = { city: intent.city, topic: intent.topic, teacher: intent.teacher };
    heading = describeIntent(intent);
    if (!filter.city && !filter.topic && !filter.teacher) {
      // הפירוק לא חילץ דבר. מילות מפתח, ולא המאגר כולו
      filter = { words: keywordsOf(intent.keywords || spoken) };
      heading = '';
    }
  } else if (mode === '2') {
    filter = { teacher: spoken };
    heading = `של ${spoken}`;
  } else if (mode === '3') {
    const known = matchOne(await knownValues(client, 'topics', topTopics), spoken);
    filter = known ? { topic: known } : { words: keywordsOf(spoken) };
    heading = known ? `בנושא ${known}` : '';
  } else {
    const known = matchOne(await knownValues(client, 'cities', topCities), spoken);
    filter = known ? { city: known } : { words: keywordsOf(spoken) };
    heading = known ? `ב${known}` : '';
  }

  /* ---------- הצמצום, אם נבחר ---------- */
  const narrowBy: 'city' | 'topic' | 'teacher' = mode === '4' ? 'topic'
    : mode === '3' ? 'city'
      : mode === '2' ? 'city'
        : filter.city ? 'topic' : 'city';

  const pick = String(params[`pick${R}`] ?? '').trim();
  let options: string[] = [];
  let narrowed = false;

  if (pick === '2') {
    options = await narrowOptions(client, filter, narrowBy);
    const nr = pageState(params, `nr${R}_`);
    const index = Number(nr.last);

    if (nr.last && index >= 1 && index <= PAGE) {
      const chosen = options[nr.page * PAGE + index - 1];
      if (chosen) {
        filter = { ...filter, [narrowBy]: chosen };
        heading = narrowBy === 'city' ? `ב${chosen}`
          : narrowBy === 'topic' ? `בנושא ${chosen}` : `של ${chosen}`;
        narrowed = true;
      }
    }
  }

  const total = await countLessons(client, filter);

  /* ============================================================
     שלב ה: לא נמצא דבר
     ============================================================ */

  if (!total) {
    const nf = String(params[`nf${R}`] ?? '').trim();

    if (nf === '1' || isBack(nf)) {
      return respond(
        say(c('search.again.ask')),
        read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }),
      );
    }

    if (nf === '2') {
      await client.rpc('igud_submit_request', {
        p_kind: 'open_lesson',
        payload: {
          contact_name: `בקשה קולית ${params.ApiPhone || ''}`,
          phone: params.ApiPhone || '',
          source: 'yemot',
          source_ref: params.ApiCallId || null,
          details: { message: spoken, viaVoice: true, wanted: true, mode },
        },
      });
      return farewell(c, c('search.noted.1'), c('search.noted.2'), c('search.noted.3'));
    }

    await logRequest(client, { ...meta, spoken, intent, count: 0, resolved: false });
    return respond(
      say(c('search.none.1'), c('search.none.2')),
      read(c('search.none.menu'), `nf${R}`, { min: 1, max: 1 }),
    );
  }

  const found = total === 1
    ? c('search.foundOne', { heading })
    : c('search.found', { count: total, heading });

  /* ============================================================
     שלב ו: הרשימה — מוגדרת כאן, כי גם מסך הצמצום נופל אליה
     ============================================================ */

  const p = pageState(params, `p${R}_`);
  const index = Number(p.last);
  const inDetails = Boolean(p.last) && index >= 1 && index <= PAGE;

  /** מסך הרשימה: עמוד אחד, ואחריו המקשים */
  const listScreen = async (page: number, ...before: string[]): Promise<Response> => {
    const rows = await pageOfLessons(client, filter, page, PAGE);
    if (!rows.length && page > 0) return listScreen(0, ...before);

    const lines = rows.map((row, i) => c('search.listItem', { line: listLine(row), n: i + 1 }));
    if (total > (page + 1) * PAGE) lines.push(c('search.listMore'));
    lines.push(c('search.listRepeat'), c('search.listNew'));

    await logRequest(client, { ...meta, spoken, intent, count: total, resolved: true });

    // חיפוש שנפל למילות מפתח אינו התאמה מדויקת, וכדאי שהמאזין ידע
    const opening = page > 0 ? [c('search.listPage')]
      : filter.words?.length ? [c('search.partial.1'), c('search.partial.2')]
        : [found, c('search.listHead')];

    return respond(
      say(...before, ...opening),
      read(lines.join('. '), p.next, { min: 1, max: 2, wait: 5 }),
    );
  };

  /* ============================================================
     שלב ז: הרבה תוצאות
     ============================================================ */

  // מתחת לעשרה לא מציעים לצמצם. הרשימה קצרה דיה, וההצעה רק מאריכה
  if (total >= 10 && !pick) {
    await logRequest(client, { ...meta, spoken, intent, count: total, resolved: false });
    return respond(say(found), read(c('search.manyMenu'), `pick${R}`, { min: 1, max: 1 }));
  }

  if (isBack(pick)) {
    return respond(say(c('nav.back')), read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }));
  }

  /* ---------- מסך הצמצום ---------- */
  if (pick === '2' && !narrowed) {
    const nr = pageState(params, `nr${R}_`);

    if (options.length < 2) {
      // אין מה לצמצם: לא שולחים אותו למסך ריק, ממשיכים לרשימה
      return listScreen(0, say(c('search.narrow.none')));
    }

    if (isBack(nr.last)) {
      return respond(say(c('nav.back')), read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }));
    }

    const page = nr.last === '9' ? Math.max(0, nr.page) : nr.page;
    const slice = options.slice(page * PAGE, page * PAGE + PAGE);
    const start = slice.length ? page : 0;
    const shown = slice.length ? slice : options.slice(0, PAGE);

    const lines = shown.map((value, i) => `להקשה על ${i + 1}, ${value}`);
    if (options.length > (start + 1) * PAGE) lines.push(c('search.listMore'));
    lines.push(c('search.listRepeat'), c('nav.hint'));

    return respond(
      say(c(`search.narrow.${narrowBy}`)),
      read(lines.join('. '), nr.next, { min: 1, max: 1 }),
    );
  }

  /* ============================================================
     שלב ז: הרשימה, והפרטים
     ============================================================ */

  if (!inDetails) {
    if (isBack(p.last)) {
      return respond(say(c('nav.back')), read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }));
    }
    if (p.last && p.last !== '0' && p.last !== '9') {
      return listScreen(p.page, c('nav.notFound'));
    }
    return listScreen(p.page);
  }

  /* ---------- הפרטים המלאים ---------- */

  const rows = await pageOfLessons(client, filter, p.page, PAGE);
  const lesson: LessonRow | null = rows[index - 1]
    ? await lessonById(client, rows[index - 1].id)
    : null;

  if (!lesson) return listScreen(p.page, c('nav.notFound'));

  // המספר האמצעי הוא מצב הרשימה, וכך חזרה לרשימה פותחת מרחב חדש
  const d = pageState(params, `d${R}_${p.n}_`);

  const detailScreen = (...before: string[]) => respond(
    say(...before, c('search.detailHead')),
    ...detailSpeech(lesson),
    read(c('search.detailMenu'), d.next, { min: 1, max: 1 }),
  );

  if (d.last === null || d.last === '9') return detailScreen();

  if (d.last === '5') {
    const { data } = await client.rpc('igud_ivr_save_lesson', {
      p_phone: params.ApiPhone || '', p_lesson: lesson.id,
    });
    const saved = (data as { success?: boolean } | null)?.success !== false;
    return respond(
      say(saved ? c('personal.saved') : c('nav.error')),
      read(c('search.detailMenu'), d.next, { min: 1, max: 1 }),
    );
  }

  if (isBack(d.last)) return listScreen(p.page);

  if (d.last === '3') {
    return respond(
      say(c('search.again.ask')),
      read(c('search.menu'), `m${R + 1}`, { min: 1, max: 1 }),
    );
  }

  return detailScreen(c('nav.notFound'));
}

export const GET = handle;
export const POST = handle;
