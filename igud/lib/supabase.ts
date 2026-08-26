import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * סכימת igud_shiurim אינה חשופה ל-PostgREST בכוונה. הדפדפן אינו קורא טבלאות
 * ישירות — הכול עובר בפונקציות public.shiurim_* שמחליטות מה מותר להחזיר.
 * לכן אין כאן טיפוס Database ואין supabase.from(): רק supabase.rpc().
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(): { url: string; anonKey: string } {
  if (!url || !anonKey) {
    throw new Error(
      'חסרים NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ראו igud/.env.example.',
    );
  }
  return { url, anonKey };
}

let browserClient: SupabaseClient | null = null;

/** לקוח לדפדפן — יחיד לכל הטאב, עם מפתח anon בלבד. */
export function getBrowserClient(): SupabaseClient {
  const env = requireEnv();
  browserClient ??= createClient(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return browserClient;
}

/**
 * לקוח לצד השרת — נוצר מחדש בכל בקשה ואינו שומר סשן, כדי ששתי בקשות
 * מקבילות של משתמשים שונים לא יראו זו את הזהות של זו.
 */
export function getServerClient(accessToken?: string): SupabaseClient {
  const env = requireEnv();
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

/**
 * לקוח service_role — לנתיבי API בלבד (וובהוקים, ייבוא, הסוכן הקולי).
 * המפתח לעולם אינו מגיע לדפדפן: אין לו קידומת NEXT_PUBLIC_.
 */
export function getServiceClient(): SupabaseClient {
  const env = requireEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('חסר SUPABASE_SERVICE_ROLE_KEY');
  return createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** קריאת RPC עם שגיאה קריאה בעברית במקום אובייקט השגיאה הגולמי. */
export async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
