import Image from 'next/image';
import type { Metadata } from 'next';
import { publicClient } from '@/lib/supabase';
import { SITE } from '@/lib/site';
import DonateForm from '@/components/donate/DonateForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'שותפות בזיכוי הרבים',
  description:
    'איגוד השיעורים מרכז את שיעורי התורה ברחבי הארץ ומחבר בין לומדים למלמדים. השותפות בפעילות נעשית בתרומה מאובטחת דרך נדרים פלוס.',
};

/**
 * דף התרומות של האיגוד עצמו.
 *
 * זה אינו דף התרומות של בית כנסת או ארגון — לאלה יש חשבון משלהם, והכסף
 * נכנס ישירות אליהם. כאן הכסף נכנס לאיגוד, ולכן מספר המוסד ומפתח דף
 * התשלום נקראים מהגדרות המערכת ולא מרשומה של גוף מסוים.
 */
export default async function DonatePage() {
  const { data } = await publicClient().rpc('igud_own_payment');
  const config = (data || {}) as { mosadId?: string; apiValid?: string; ready?: boolean };

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <header className="text-center">
        <Image
          src={SITE.mark}
          alt={SITE.name}
          width={256}
          height={256}
          className="mx-auto h-20 w-auto"
        />
        <h1 className="mt-4 font-display text-3xl font-bold text-royal-700 sm:text-4xl">
          שותפות בזיכוי הרבים
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-[0.98rem] leading-relaxed text-ink-700">
          כל שיעור שנפתח כאן, וכל לומד שמצא את מקומו, הם גם שלכם.
          האיגוד מרכז את שיעורי התורה ברחבי הארץ ומעמיד את המידע לרשות הציבור בחינם.
        </p>
      </header>

      <section className="card-surface mt-8 rounded-2xl p-5 sm:p-7">
        {config.ready ? (
          <DonateForm config={{ mosadId: config.mosadId!, apiValid: config.apiValid! }} />
        ) : (
          <div className="text-center">
            <p className="font-bold text-royal-700">התרומה המקוונת אינה זמינה כרגע</p>
            <p className="mt-2 text-[0.9rem] text-ink-700">
              אפשר להתקשר אלינו ונשמח לסייע
            </p>
            <p className="mt-3 font-display text-2xl font-bold text-royal-700" dir="ltr">
              {SITE.voiceLine}
            </p>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[0.82rem] leading-relaxed text-ink-500">
        הסליקה מאובטחת ומתבצעת במערכת נדרים פלוס.
        פרטי כרטיס האשראי אינם נשמרים באתר האיגוד ואינם עוברים דרכו.
        <br />
        אפשר לתרום גם בטלפון, בחיוג ל־{SITE.voiceLine} והקשה על 5.
      </p>
    </div>
  );
}
