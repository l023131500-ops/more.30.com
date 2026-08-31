import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && anonKey);

/**
 * לקוח לקריאה ציבורית. RLS מגביל אותו לשיעורים שאושרו לפרסום בלבד,
 * ולכן מותר להשתמש בו גם בדפדפן וגם בשרת.
 */
export function publicClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-igud-client': 'public' } },
  });
}

let browserSingleton: SupabaseClient | null = null;

/** לקוח דפדפן ששומר את ההתחברות (ניהול ואזור אישי). */
export function browserClient(): SupabaseClient {
  if (!browserSingleton) {
    browserSingleton = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'igud-auth',
      },
    });
  }
  return browserSingleton;
}

/**
 * לקוח שרת בהרשאות מלאות, עבור מסלולי API שאין להם משתמש מחובר
 * (מערכת קולית, קליטת נתונים מנדרים פלוס).
 *
 * שני מצבים נתמכים, לפי מה שמוגדר בסביבה:
 *   1. SUPABASE_SERVICE_ROLE_KEY — מפתח שירות ישיר.
 *   2. חשבון שירות (IGUD_SERVICE_EMAIL / IGUD_SERVICE_PASSWORD) שמוגדר כמנהל.
 */
export async function serviceClient(): Promise<SupabaseClient> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const email = process.env.IGUD_SERVICE_EMAIL;
  const password = process.env.IGUD_SERVICE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'חסרה הגדרת גישת שרת: קבעו SUPABASE_SERVICE_ROLE_KEY או IGUD_SERVICE_EMAIL + IGUD_SERVICE_PASSWORD',
    );
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`התחברות חשבון השירות נכשלה: ${error.message}`);
  return client;
}

/** כתובת ציבורית של קובץ בדלי המדיה. */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${url}/storage/v1/object/public/igud-media/${path.replace(/^\/+/, '')}`;
}
