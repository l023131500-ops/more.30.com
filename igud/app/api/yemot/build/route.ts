import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase';
import { loadCopy } from '@/lib/ivr-copy';
import {
  EXTENSIONS, apiExtensionIni, getSession, rootMenuIni, uploadTextFile, yemotConfig,
} from '@/lib/yemot';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * בניית שלוחות האיגוד במערכת הקולית.
 *
 * יוצר תפריט ראשי תחת שלוחת הבסיס, ומתחתיו שמונה שלוחות API.
 * כל הכתיבות מוגבלות לשלוחת הבסיס בלבד, ואין כאן שום פעולת מחיקה.
 */
export async function POST(request: Request) {
  try {
    const client = await requireAdmin(request);
    const config = await yemotConfig(client);
    if (!config) {
      return NextResponse.json(
        { error: 'לא הוגדר חיבור למערכת הקולית. יש למלא מספר מערכת ומפתח API במסך ההגדרות.' },
        { status: 400 },
      );
    }

    // בדיקת תקינות ההרשאות לפני שכותבים משהו
    await getSession(config);

    const origin = new URL(request.url).origin || SITE.url;
    // מבנה שטוח כשאין שלוחת בסיס: התפריט יושב בשורש והשלוחות תחתיו
    const root = config.rootExt;
    const at = (ext: string) => (root ? `ivr2:/${root}/${ext}/ext.ini` : `ivr2:/${ext}/ext.ini`);
    const rootPath = root ? `ivr2:/${root}/ext.ini` : 'ivr2:/ext.ini';

    // התפריט נכתב מהנוסחים שבניהול, ולכן שינוי טקסט שם מגיע לימות בלחיצה
    const copy = await loadCopy(client);
    await uploadTextFile(config, rootPath, rootMenuIni(copy));

    let created = 1;
    for (const plan of EXTENSIONS) {
      await uploadTextFile(config, at(plan.ext), apiExtensionIni(origin, plan));
      created += 1;
    }

    await client.from('igud_audit').insert({
      action: 'yemot_build',
      entity: 'yemot',
      meta: { root, created, origin },
    });

    return NextResponse.json({
      ok: true,
      root,
      created,
      extensions: EXTENSIONS.map((e) => ({ ext: `${root}/${e.ext}`, title: e.title, url: `${origin}${e.apiPath}` })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'בניית השלוחות נכשלה';
    const denied = /מנהלים בלבד|נדרשת התחברות/.test(message);
    return NextResponse.json({ error: message }, { status: denied ? 403 : 500 });
  }
}
