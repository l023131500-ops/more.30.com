import Image from 'next/image';
import { photoOf, WINDOWS, type WindowKey } from '@/lib/imagery';

/**
 * חלון תמונה.
 *
 * מלבן בגודל קבוע, זהה לכל אחיו ברשת. שתי החלטות כאן חשובות יותר
 * מהמראה עצמו.
 *
 * הראשונה, יחס הצדדים נקבע מבחוץ ואחיד לכל הרשת, כך שכל החלונות
 * באותו טור באותו גובה בדיוק גם כשהתמונות שיגיעו יהיו בגדלים שונים
 * לגמרי. חוסר סימטריה ברשת תמונות נובע כמעט תמיד מכך שכל תמונה
 * מכתיבה את גובהה, וזה נמנע כאן מראש.
 *
 * השנייה, כשאין עדיין תמונה החלון אינו נעלם ואינו מציג ריבוע אפור.
 * הוא מציג מילוי בצבעי המותג שנושא את שם התמונה החסרה. כך העמוד
 * שלם, והחלפת המילוי בתצלום אינה משנה שום מידה בעמוד.
 */
export default function PhotoWindow({
  name,
  ratio = 'aspect-[4/3]',
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
  children,
}: {
  name: WindowKey;
  /** יחס הצדדים, כמחלקת Tailwind. אחיד לכל הרשת */
  ratio?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** כיתוב שמונח על החלון, למשל שם מקום */
  children?: React.ReactNode;
}) {
  const photo = photoOf(name);
  const meta = WINDOWS[name];

  return (
    <div className={`window window-zoom ${ratio} ${className}`}>
      {photo ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          style={photo.focus ? { objectPosition: photo.focus } : undefined}
        />
      ) : (
        <Placeholder title={meta.title} note={meta.note} />
      )}
      {children}
    </div>
  );
}

/**
 * המילוי שמחכה לתמונה.
 *
 * כתוב עליו מה אמור לבוא במקומו, כי חלון ריק שאיש אינו יודע מה שייך
 * לו נשאר ריק. הקשת והנקודות הן אותה שפה של שאר האתר, כדי שגם בזמן
 * ההמתנה העמוד ייראה מעוצב ולא חסר.
 */
function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-royal-700 via-royal-800 to-royal-900">
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full opacity-45"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pw-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="0">
            <stop offset="0%" stopColor="#C9A44F" stopOpacity="0" />
            <stop offset="50%" stopColor="#DCC078" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C9A44F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#pw-fade)" strokeWidth="1.2">
          <path d="M120 300 L120 168 A80 80 0 0 1 280 168 L280 300" />
          <path d="M148 300 L148 178 A52 52 0 0 1 252 178 L252 300" opacity="0.55" />
          <circle cx="200" cy="140" r="4" />
        </g>
      </svg>

      <div className="relative px-4 text-center">
        <span className="mx-auto mb-2.5 block h-px w-10 bg-gradient-to-l from-transparent via-gold-400 to-transparent" />
        <span className="block font-display text-lg font-bold text-gold-200">{title}</span>
        <span className="mt-1 block text-[0.72rem] leading-snug text-royal-100/75">{note}</span>
        <span className="mt-3 inline-block rounded-full border border-gold-400/40 px-2.5 py-0.5
                         text-[0.62rem] font-bold tracking-wide text-gold-300/85">
          ממתין לתמונה
        </span>
      </div>
    </div>
  );
}
