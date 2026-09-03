/**
 * בית מדרש, כאיור מקורי.
 *
 * שני נימוקים לאיור ולא לצילום. הראשון מעשי: צילום של בית מדרש מסוים
 * הוא צילום של קהילה מסוימת, ואיגוד ארצי שמציג בית מדרש אחד בראש
 * העמוד אומר בלי לומר לאיזה ציבור הוא שייך. השני עיצובי: איור נבנה
 * בפלטה של הלוגו בדיוק, נשאר חד בכל רזולוציה, ושוקל שלושה קילובייט.
 *
 * מה שיש כאן: שלוש קשתות של חלונות עם אור ערב חם, מדפי ספרים
 * מצללים משני הצדדים, ונברשת תלויה. הכול בטורקיז ובזהב של הלוגו,
 * ובלי פרט שמזהה נוסח או עדה.
 *
 * הרוחב מוגדר ב-viewBox והיחס נשמר בחיתוך, כך שהאיור נפרס לרוחב כל
 * מסך בלי להימתח.
 */
export default function BeitMidrash({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 620"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1B21" />
          <stop offset="45%" stopColor="#17353D" />
          <stop offset="100%" stopColor="#1F4E5B" />
        </linearGradient>

        {/* אור הערב שמבעד לחלון: חם במרכז ודועך אל הקצוות */}
        <radialGradient id="bm-light" cx="50%" cy="62%" r="62%">
          <stop offset="0%" stopColor="#FBEFD2" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#E4C589" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#C9A44F" stopOpacity="0" />
        </radialGradient>

        {/* אור ערב מבעד לזכוכית: חם למעלה, מצטלל למטה */}
        <linearGradient id="bm-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7E9C6" stopOpacity="0.30" />
          <stop offset="55%" stopColor="#DCC078" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3A9CB2" stopOpacity="0.10" />
        </linearGradient>

        <linearGradient id="bm-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1B21" stopOpacity="0" />
          <stop offset="100%" stopColor="#0A1B21" stopOpacity="0.85" />
        </linearGradient>

        <linearGradient id="bm-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#866527" />
          <stop offset="50%" stopColor="#DCC078" />
          <stop offset="100%" stopColor="#866527" />
        </linearGradient>

        {/* קשת מוגבהת, הצורה שחוזרת בכל בית מדרש */}
        <path
          id="bm-arch-shape"
          d="M0 300 L0 132 A94 94 0 0 1 188 132 L188 300 Z"
        />
      </defs>

      <rect width="1600" height="620" fill="url(#bm-sky)" />

      {/* הילת האור המרכזית */}
      <ellipse cx="800" cy="360" rx="520" ry="290" fill="url(#bm-light)" />

      {/* ---------- שלוש קשתות ---------- */}
      {[506, 706, 906].map((x, i) => (
        <g key={x} transform={`translate(${x} 150)`}>
          <use href="#bm-arch-shape" fill="url(#bm-window)" />
          <use
            href="#bm-arch-shape"
            fill="none"
            stroke="url(#bm-gold)"
            strokeWidth="3"
            opacity={i === 1 ? 1 : 0.75}
          />
          {/* חלוקת החלון */}
          <line x1="94" y1="42" x2="94" y2="300" stroke="#DCC078" strokeWidth="1.2" opacity="0.45" />
          <line x1="8" y1="196" x2="180" y2="196" stroke="#DCC078" strokeWidth="1.2" opacity="0.38" />
          <line x1="8" y1="248" x2="180" y2="248" stroke="#DCC078" strokeWidth="1" opacity="0.24" />
        </g>
      ))}

      {/* ---------- נברשת ---------- */}
      <g opacity="0.9">
        <line x1="800" y1="0" x2="800" y2="86" stroke="#DCC078" strokeWidth="1.5" opacity="0.45" />
        <ellipse cx="800" cy="98" rx="46" ry="11" fill="none" stroke="url(#bm-gold)" strokeWidth="2" />
        {[-34, -17, 0, 17, 34].map((dx) => (
          <g key={dx}>
            <line
              x1={800 + dx} y1="98" x2={800 + dx} y2="118"
              stroke="#DCC078" strokeWidth="1" opacity="0.5"
            />
            <circle cx={800 + dx} cy="122" r="3.4" fill="#FBEFD2" opacity="0.9" />
            <circle cx={800 + dx} cy="122" r="9" fill="#F3E7BF" opacity="0.16" />
          </g>
        ))}
      </g>

      {/* ---------- מדפי ספרים, משני הצדדים ---------- */}
      {[-20, 1320].map((x) => (
        <g key={x} transform={`translate(${x} 150)`} opacity="0.85">
          {/* דופן הארון, כדי שהמדפים לא ייראו צפים */}
          <rect x="-6" y="-6" width="312" height="342" fill="#0A1B21" opacity="0.35" />
          <rect
            x="-6" y="-6" width="312" height="342"
            fill="none" stroke="#DCC078" strokeWidth="1.5" opacity="0.28"
          />
          {[0, 78, 156, 234].map((row) => (
            <g key={row} transform={`translate(0 ${row})`}>
              <rect x="0" y="62" width="300" height="4" fill="#DCC078" opacity="0.45" />
              {Array.from({ length: 22 }).map((_, n) => {
                const w = 8 + ((n * 7) % 6);
                const h = 40 + ((n * 13) % 20);
                const tone = ['#2E6B7B', '#175E70', '#866527', '#1F4E5B', '#AC8534'][n % 5];
                const x = n * 13.4 + 4;
                return (
                  <rect
                    key={n}
                    x={x}
                    y={62 - h}
                    width={w}
                    height={h}
                    rx="1.5"
                    fill={tone}
                    opacity={0.55 + ((n * 3) % 4) * 0.1}
                  />
                );
              })}
            </g>
          ))}
        </g>
      ))}

      {/* ---------- שטנדר ופתח הספר ---------- */}
      <g transform="translate(736 366)" opacity="0.95">
        {/* ספר פתוח על שטנדר, במבט מלפנים: שני דפים שנפתחים משדרה אחת */}
        <path d="M62 16 Q34 6 6 14 L6 66 Q34 58 62 68 Z" fill="#FBEFD2" opacity="0.92" />
        <path d="M62 16 Q90 6 118 14 L118 66 Q90 58 62 68 Z" fill="#F3E7BF" opacity="0.85" />
        <path
          d="M62 16 Q34 6 6 14 L6 66 Q34 58 62 68 Q90 58 118 66 L118 14 Q90 6 62 16 Z"
          fill="none" stroke="#AC8534" strokeWidth="1.4" opacity="0.8"
        />
        <path d="M62 16 L62 68" stroke="#AC8534" strokeWidth="1.2" opacity="0.55" />

        {/* שורות הכתב, ברמז בלבד */}
        {[28, 36, 44, 52].map((y, n) => (
          <g key={y} opacity={0.3 - n * 0.045}>
            <line x1="14" y1={y} x2="54" y2={y - 1} stroke="#866527" strokeWidth="1.5" />
            <line x1="70" y1={y - 1} x2="110" y2={y} stroke="#866527" strokeWidth="1.5" />
          </g>
        ))}

        {/* השטנדר */}
        <path d="M50 68 L74 68 L70 128 L54 128 Z" fill="#175E70" opacity="0.9" />
        <rect x="34" y="128" width="56" height="8" rx="3" fill="#175E70" opacity="0.9" />
        <rect
          x="34" y="128" width="56" height="8" rx="3"
          fill="none" stroke="#DCC078" strokeWidth="0.9" opacity="0.45"
        />
      </g>

      {/* ---------- רצפה ---------- */}
      <rect y="440" width="1600" height="180" fill="url(#bm-floor)" />
    </svg>
  );
}
