import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { IconBuilding, IconMail, IconPhone, IconSparkle, IconUser } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'אודות האיגוד',
  description: 'איגוד השיעורים מרכז את זמני שיעורי התורה בארץ, ומחבר בין מקומות שמחפשים מגיד שיעור לבין רבנים שמחפשים מקום.',
};

const CHANNELS = [
  {
    icon: <IconSparkle className="h-6 w-6" />,
    title: 'באתר',
    body: 'הוספה ועדכון של שיעורים, חיפוש חכם, ואזור אישי לכל רב ולכל מרכז תורני.',
  },
  {
    icon: <IconPhone className="h-6 w-6" />,
    title: 'במערכת הקולית',
    body: `חיוג ל-${SITE.voiceLine} מאפשר לשמוע שיעורים קרובים, לעדכן זמנים ולהצטרף לאיגוד, גם בלי אינטרנט.`,
  },
  {
    icon: <IconBuilding className="h-6 w-6" />,
    title: 'בעמדות נדרים פלוס',
    body: 'הטפסים המוכרים בעמדות מוזרמים ישירות למאגר, ומופיעים באתר לאחר אישור.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
      <header className="text-center">
        <Image
          src={SITE.logo}
          alt={SITE.name}
          width={640}
          height={754}
          className="mx-auto h-40 w-auto drop-shadow-[0_14px_32px_rgba(74,24,24,0.25)]"
        />
        <h1 className="mt-6 font-display text-3xl font-bold text-wine-700 sm:text-4xl">
          {SITE.name}
        </h1>
        <p className="mt-2 text-base text-gold-700">{SITE.tagline}</p>
        <div className="rule-gold mx-auto mt-6 max-w-xs" />
      </header>

      <section className="mt-10 space-y-4 text-[0.98rem] leading-relaxed text-ink-700">
        <p>
          בכל שכונה ובכל עיר נמסרים מדי יום שיעורי תורה. הרבה מהם ידועים רק למי שכבר
          מתפלל שם. איגוד השיעורים נועד לפתוח את הדלת: מאגר אחד, מסודר ומעודכן,
          שבו אפשר למצוא בכמה שניות שיעור שמתאים לזמן, למקום ולסגנון.
        </p>
        <p>
          המאגר בנוי משלושה סוגי משתמשים. הציבור הרחב מחפש ומוצא. מגידי שיעור
          ומרכזים תורניים מעדכנים בעצמם את הזמנים שלהם, ומקבלים קישור אישי שמציג
          רק את השיעורים שלהם עם הלוגו שלהם. וצוות האיגוד מאשר כל שיעור לפני
          שהוא מתפרסם, כדי שהמידע יישאר נכון ומהימן.
        </p>
        <p>
          מעבר לפרסום, האיגוד מחבר בין מי שמחפש למי שמציע. בית כנסת שמחפש מגיד
          שיעור, ורב שמחפש מקום למסור בו, ממלאים טופס קצר, וצוות האיגוד מחפש את
          ההתאמה לפי הקהל, הנושא, השפה והזמינות.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-wine-700">שלושה ערוצים, מאגר אחד</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div key={channel.title} className="card-surface rounded-2xl p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-wine-600 to-wine-800 text-gold-200">
                {channel.icon}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-wine-700">{channel.title}</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-700">{channel.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-gold-400/60 bg-gradient-to-l from-wine-700 to-wine-800 p-8 text-gold-100">
        <h2 className="font-display text-2xl font-bold">יצירת קשר</h2>
        <div className="mt-4 space-y-2 text-[0.95rem]">
          <a href={`tel:${SITE.voiceLine}`} className="flex items-center gap-2 hover:text-white">
            <IconPhone className="h-4 w-4 text-gold-400" />
            מערכת קולית {SITE.voiceLine}
          </a>
          <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 hover:text-white">
            <IconMail className="h-4 w-4 text-gold-400" />
            {SITE.email}
          </a>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/add" className="btn btn-gold">הוספת שיעור למאגר</Link>
          <Link href="/join" className="btn !border !border-gold-400/70 !bg-transparent !text-gold-200 hover:!bg-white/10">
            <IconUser className="h-4 w-4" />
            הצטרפות לאיגוד
          </Link>
        </div>
      </section>
    </div>
  );
}
