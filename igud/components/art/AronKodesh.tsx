/**
 * ארון קודש, כאיור מקורי.
 *
 * האיור יושב מאחורי הקריאה להצטרפות — האזור שמדבר על פתיחת שיעור
 * ועל מגידי שיעור. בחרתי בארון ולא בקהל, מאותו טעם שבחרתי באיור ולא
 * בצילום: קהל מצולם הוא תמיד קהל מסוים, וארון קודש שייך לכולם.
 *
 * מה שיש כאן: שני עמודים, קשת מעל, פרוכת ברמז של קפלים, כתר וגלילה
 * דקה, ונר תמיד תלוי. הכול בטורקיז ובזהב של הלוגו, בלי סמל של עדה
 * ובלי כיתוב.
 */
export default function AronKodesh({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 520"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ak-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1B21" />
          <stop offset="100%" stopColor="#17353D" />
        </linearGradient>

        <linearGradient id="ak-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#866527" />
          <stop offset="50%" stopColor="#EBD9A2" />
          <stop offset="100%" stopColor="#866527" />
        </linearGradient>

        {/* הפרוכת: כהה בקצוות, מוארת במרכז מן הנר */}
        <linearGradient id="ak-cloth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#102831" />
          <stop offset="30%" stopColor="#175E70" />
          <stop offset="50%" stopColor="#1F7C92" />
          <stop offset="70%" stopColor="#175E70" />
          <stop offset="100%" stopColor="#102831" />
        </linearGradient>

        <radialGradient id="ak-flame" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FBEFD2" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C9A44F" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="520" fill="url(#ak-wall)" />

      {/* הילת הנר, שנותנת למרכז את החום */}
      <ellipse cx="800" cy="250" rx="430" ry="250" fill="url(#ak-flame)" opacity="0.5" />

      {/* ---------- קשת ועמודים ---------- */}
      <g>
        <path
          d="M614 470 L614 214 A186 186 0 0 1 986 214 L986 470"
          fill="url(#ak-cloth)"
          opacity="0.9"
        />
        <path
          d="M614 470 L614 214 A186 186 0 0 1 986 214 L986 470"
          fill="none"
          stroke="url(#ak-gold)"
          strokeWidth="4"
        />

        {/* קפלי הפרוכת: קווים אנכיים שמתעבים אל הקצוות */}
        {[-150, -110, -72, -36, 0, 36, 72, 110, 150].map((dx) => (
          <line
            key={dx}
            x1={800 + dx}
            y1={214 - Math.sqrt(Math.max(0, 186 * 186 - dx * dx)) + 186 - 150}
            x2={800 + dx}
            y2="470"
            stroke="#EBD9A2"
            strokeWidth={Math.abs(dx) > 120 ? 1.6 : 1}
            opacity={0.10 + Math.abs(dx) / 900}
          />
        ))}

        {/* כותרת הפרוכת */}
        <rect x="600" y="196" width="400" height="22" rx="6" fill="#102831" opacity="0.75" />
        <rect
          x="600" y="196" width="400" height="22" rx="6"
          fill="none" stroke="url(#ak-gold)" strokeWidth="2" opacity="0.85"
        />
      </g>

      {/* ---------- כתר ---------- */}
      <g transform="translate(800 152)">
        <path
          d="M-52 18 L-40 -14 L-20 6 L0 -24 L20 6 L40 -14 L52 18 Z"
          fill="none"
          stroke="url(#ak-gold)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="-56" y="18" width="112" height="9" rx="4" fill="none" stroke="url(#ak-gold)" strokeWidth="2.5" />
        {[-40, -20, 0, 20, 40].map((dx) => (
          <circle key={dx} cx={dx} cy="-16" r="3.2" fill="#EBD9A2" opacity="0.9" />
        ))}
      </g>

      {/* ---------- נר תמיד ---------- */}
      <g transform="translate(800 34)">
        <line x1="0" y1="0" x2="0" y2="46" stroke="#DCC078" strokeWidth="1.4" opacity="0.5" />
        <path d="M-16 46 L16 46 L11 74 L-11 74 Z" fill="none" stroke="url(#ak-gold)" strokeWidth="2.2" />
        <circle cx="0" cy="62" r="5" fill="#FBEFD2" opacity="0.95" />
        <circle cx="0" cy="62" r="15" fill="#F3E7BF" opacity="0.14" />
      </g>

      {/* ---------- עמודים משני הצדדים ---------- */}
      {[420, 1180].map((x) => (
        <g key={x} transform={`translate(${x} 150)`} opacity="0.7">
          <rect x="-26" y="0" width="52" height="320" fill="#102831" />
          <rect x="-26" y="0" width="52" height="320" fill="none" stroke="#DCC078" strokeWidth="1.6" opacity="0.5" />
          {/* חריצי העמוד */}
          {[-13, 0, 13].map((dx) => (
            <line key={dx} x1={dx} y1="16" x2={dx} y2="304" stroke="#DCC078" strokeWidth="0.9" opacity="0.28" />
          ))}
          <rect x="-38" y="-16" width="76" height="18" rx="5" fill="#175E70" />
          <rect x="-38" y="-16" width="76" height="18" rx="5" fill="none" stroke="#DCC078" strokeWidth="1.4" opacity="0.6" />
        </g>
      ))}

      {/* ---------- מדרגות ורצפה ---------- */}
      <rect y="470" width="1600" height="50" fill="#0A1B21" opacity="0.55" />
      <rect x="560" y="470" width="480" height="12" rx="3" fill="#175E70" opacity="0.55" />
      <rect x="520" y="486" width="560" height="12" rx="3" fill="#175E70" opacity="0.4" />
    </svg>
  );
}
