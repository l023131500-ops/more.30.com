import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from '@/lib/supabase';

/**
 * הבנת דיבור חופשי במערכת הקולית, ורישום מה שנשאל.
 *
 * שני החלקים כאן משרתים את אותה מטרה. הראשון מנסה להבין מה המתקשר ביקש.
 * השני רושם את מה שביקש, בין אם הובן ובין אם לא — וזה החלק החשוב יותר
 * לאורך זמן: חיפוש שלא מצא הוא הדיווח הכי מדויק על מה שחסר במאגר, או על
 * מה שאנשים מנסחים אחרת מכפי שהחיפוש יודע לקרוא.
 */

export interface Intent {
  city?: string;
  topic?: string;
  teacher?: string;
  keywords?: string;
}

/**
 * מפתח Claude, לפי סדר עדיפות:
 *   1. משתנה סביבה — הדרך הפשוטה, ואינה דורשת חשבון שירות.
 *   2. מסך ההגדרות — דורש חשבון שירות מוגדר.
 * בלי אף אחד מהם החיפוש נופל למילות מפתח, וממשיך לעבוד.
 */
async function aiConfig(): Promise<{ apiKey?: string; model?: string }> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return { apiKey: envKey, model: process.env.ANTHROPIC_MODEL };

  try {
    const client = await serviceClient();
    const { data } = await client.from('igud_settings').select('value').eq('key', 'ai').maybeSingle();
    return (data?.value || {}) as { apiKey?: string; model?: string };
  } catch {
    return {};
  }
}

/** פירוק משפט חופשי לשם רב, עיר ונושא. */
export async function readIntent(text: string): Promise<Intent> {
  const config = await aiConfig();
  if (!config.apiKey) return { keywords: text };

  try {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const response = await anthropic.messages.create({
      model: config.model || 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system:
        'אתה עוזר של איגוד השיעורים, מאגר ארצי של שיעורי תורה. '
        + 'המשתמש מדבר בטלפון ומחפש שיעור. '
        + 'החזר אך ורק אובייקט JSON, בלי טקסט נוסף, עם השדות: '
        + 'city (שם עיר בעברית או השמט), topic (נושא לימוד בעברית או השמט), '
        + 'teacher (שם הרב או השמט), keywords (מילות חיפוש חופשיות). '
        + 'אם לא זוהה דבר, החזר אובייקט עם keywords בלבד.',
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

/** תיאור הבקשה בעברית, להקראה חזרה למתקשר. */
export function describeIntent(intent: Intent): string {
  return [
    intent.teacher ? `של ${intent.teacher}` : '',
    intent.topic ? `בנושא ${intent.topic}` : '',
    intent.city ? `ב${intent.city}` : '',
  ].filter(Boolean).join(' ');
}

/**
 * רישום הפנייה. נכשל בשקט: תקלת רישום לא תפיל שיחה.
 */
export async function logRequest(
  client: SupabaseClient,
  args: {
    callId?: string; phone?: string; extension?: string;
    kind?: 'search' | 'update' | 'message' | 'join' | 'host' | 'donation' | 'human';
    spoken?: string; intent?: Intent | null; count?: number | null; resolved?: boolean;
  },
): Promise<void> {
  try {
    await client.rpc('igud_ivr_log', {
      p_call_id: args.callId || null,
      p_phone: args.phone || null,
      p_extension: args.extension || null,
      p_kind: args.kind || 'search',
      p_spoken: args.spoken || null,
      p_intent: args.intent ? (args.intent as unknown as Record<string, unknown>) : null,
      p_count: args.count ?? null,
      p_resolved: args.resolved ?? false,
    });
  } catch {
    /* הרישום הוא תיעוד, לא תנאי להמשך השיחה */
  }
}
