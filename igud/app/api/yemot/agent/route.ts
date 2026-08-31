import Anthropic from '@anthropic-ai/sdk';
import { publicClient, serviceClient } from '@/lib/supabase';
import { goHome, read, respond, say, yemotParams } from '@/lib/yemot';
import { describeLesson, keywordSearch, upcomingFor } from '@/lib/ivr';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * שלוחה 5 — סוכן קולי לחיפוש בדיבור חופשי.
 *
 * מקבל טקסט מזוהה מהמערכת הקולית (פרמטר text או speech), מפרש את הבקשה
 * ומקריא את השיעורים המתאימים. אם הוגדר מפתח של Claude, הפירוש נעשה בעזרתו.
 * בלעדיו המערכת נופלת לחיפוש לפי מילות מפתח, כך שהשלוחה עובדת בכל מקרה.
 */

interface Intent {
  city?: string;
  topic?: string;
  teacher?: string;
  keywords?: string;
}

/**
 * מפתח Claude, לפי סדר עדיפות:
 *   1. משתנה סביבה — הדרך הפשוטה, ואינה דורשת חשבון שירות.
 *   2. מסך ההגדרות — דורש חשבון שירות מוגדר.
 * אם אין אף אחד מהם, מחזירים ריק והשלוחה עובדת בחיפוש מילות מפתח.
 */
async function aiConfig(): Promise<{ apiKey?: string; model?: string }> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return { apiKey: envKey, model: process.env.ANTHROPIC_MODEL };

  try {
    const client = await serviceClient();
    const { data } = await client.from('igud_settings').select('value').eq('key', 'ai').maybeSingle();
    return (data?.value || {}) as { apiKey?: string; model?: string };
  } catch {
    // אין חשבון שירות מוגדר: ממשיכים בלי הסוכן החכם
    return {};
  }
}

async function readIntent(text: string): Promise<Intent> {
  const config = await aiConfig();
  const apiKey = config.apiKey;

  if (!apiKey) return { keywords: text };

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: config.model || 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system:
        'אתה עוזר של איגוד השיעורים, מאגר ארצי של שיעורי תורה. ' +
        'המשתמש מדבר בטלפון ומחפש שיעור. ' +
        'החזר אך ורק אובייקט JSON, בלי טקסט נוסף, עם השדות: ' +
        'city (שם עיר בעברית או השמט), topic (נושא לימוד בעברית או השמט), ' +
        'teacher (שם הרב או השמט), keywords (מילות חיפוש חופשיות). ' +
        'אם לא זוהה דבר, החזר אובייקט עם keywords בלבד.',
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { keywords: text };

    const parsed = JSON.parse(match[0]) as Intent;
    return {
      city: parsed.city?.trim() || undefined,
      topic: parsed.topic?.trim() || undefined,
      teacher: parsed.teacher?.trim() || undefined,
      keywords: parsed.keywords?.trim() || text,
    };
  } catch {
    // כל תקלה בפירוש מחזירה אותנו לחיפוש לפי מילים
    return { keywords: text };
  }
}

async function handle(request: Request) {
  const params = await yemotParams(request);
  const text = (params.text || params.speech || params.query || '').trim();

  if (!text) {
    return respond(
      say('חיפוש שיעור בדיבור חופשי'),
      read(
        'אמרו במשפט אחד מה אתם מחפשים. לדוגמה, דף יומי בבני ברק, או שיעור מוסר של הרב כהן',
        'text',
        { mode: 'voice', max: 60, wait: 10 },
      ),
    );
  }

  const client = publicClient();
  const intent = await readIntent(text);

  let rows = await upcomingFor(
    client,
    { city: intent.city, topic: intent.topic, teacher: intent.teacher },
    5,
  );

  if (!rows.length && (intent.keywords || text)) {
    const matches = await keywordSearch(client, intent.keywords || text, 5);
    rows = matches as unknown as typeof rows;
  }

  if (!rows.length) {
    return respond(
      say('לא נמצאו שיעורים שמתאימים לבקשה'),
      say('אפשר לנסות שוב עם ניסוח אחר, או לחפש לפי עיר ונושא בשלוחה 1'),
      goHome(),
    );
  }

  const heading = [
    intent.city ? `ב${intent.city}` : '',
    intent.topic ? `בנושא ${intent.topic}` : '',
    intent.teacher ? `של ${intent.teacher}` : '',
  ].filter(Boolean).join(' ');

  return respond(
    say(`נמצאו ${rows.length} שיעורים ${heading}`.trim()),
    say(...rows.map((row, i) => `${i + 1}. ${describeLesson(row)}`)),
    goHome(),
  );
}

export const GET = handle;
export const POST = handle;
