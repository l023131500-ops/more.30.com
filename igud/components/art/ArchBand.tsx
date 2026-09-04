/**
 * שורת קשתות, בקו זהב דק.
 *
 * זהו קישוט לרצועה רחבה ונמוכה, ולא תמונה: קווים בלבד, בשקיפות
 * נמוכה, מאחורי הכותרת. הוא נותן לעמוד פנימי את אותה שפה של הפתיח —
 * קשת של בית מדרש — בלי לגרוע מקריאוּת הכותרת שיושבת עליו.
 *
 * העיגון לתחתית מכוון: קשת שנחתכת למטה נראית שבורה, וקשת שנחתכת
 * למעלה נראית כמו קשת שממשיכה מעבר למסגרת. לכן רגלי הקשתות נצמדות
 * תמיד לתחתית המסגרת, יהיה גובהה אשר יהיה.
 */
export default function ArchBand({ className = '' }: { className?: string }) {
  const arches = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <svg
      viewBox="0 0 1600 200"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* דוהה אל הקצוות, כדי שהקישוט לא ייגמר בקו חתוך */}
        {/*
          gradientUnits בקואורדינטות הציור, ולא בתיבה של כל צורה.
          בברירת המחדל כל קשת מקבלת את הדהייה לעצמה, ואז רגלי הקשת —
          שיושבות בקצה תיבת הצורה — נעלמות לגמרי ונשארות קשתות מרחפות.
        */}
        <linearGradient id="ab-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="0">
          <stop offset="0%" stopColor="#C9A44F" stopOpacity="0" />
          <stop offset="22%" stopColor="#C9A44F" stopOpacity="0.85" />
          <stop offset="78%" stopColor="#C9A44F" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C9A44F" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g fill="none" stroke="url(#ab-fade)" strokeWidth="1.6">
        {arches.map((n) => {
          const x = n * 200 + 24;
          return (
            <g key={n}>
              <path d={`M${x} 200 L${x} 96 A76 76 0 0 1 ${x + 152} 96 L${x + 152} 200`} />
              <path d={`M${x + 22} 200 L${x + 22} 104 A54 54 0 0 1 ${x + 130} 104 L${x + 130} 200`} opacity="0.5" />
              <circle cx={x + 76} cy="70" r="5" />
            </g>
          );
        })}
        <line x1="0" y1="200" x2="1600" y2="200" strokeWidth="2" />
      </g>
    </svg>
  );
}
