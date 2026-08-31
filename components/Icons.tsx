/** אייקוני קו, מצוירים ידנית כדי לשמור על עובי אחיד ומראה אחיד באתר. */

type P = { className?: string; strokeWidth?: number };

const base = (className?: string) => `shrink-0 ${className || 'w-4 h-4'}`;

function Svg({ children, className, strokeWidth = 1.6 }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={base(className)}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></Svg>
);

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </Svg>
);

export const IconUser = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Svg>
);

export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="10" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </Svg>
);

export const IconLive = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.6" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4" />
    <path d="M5 5a10 10 0 0 0 0 14M19 19a10 10 0 0 0 0-14" />
  </Svg>
);

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
  </Svg>
);

export const IconBuilding = (p: P) => (
  <Svg {...p}>
    <path d="M4 21V6.5L12 3l8 3.5V21" />
    <path d="M9.5 21v-5.5h5V21M8 10h2M14 10h2M8 13h2M14 13h2" />
  </Svg>
);

export const IconChevron = (p: P) => (
  <Svg {...p}><path d="m14 6-6 6 6 6" /></Svg>
);

export const IconChevronDown = (p: P) => (
  <Svg {...p}><path d="m6 9.5 6 6 6-6" /></Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>
);

export const IconShare = (p: P) => (
  <Svg {...p}>
    <circle cx="17.5" cy="6" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18" r="2.5" />
    <path d="m8.8 10.8 6.4-3.6M8.8 13.2l6.4 3.6" />
  </Svg>
);

export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M12 3.5v11M8 11l4 4 4-4M4.5 19.5h15" /></Svg>
);

export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
    <path d="M15 6.2A2.7 2.7 0 0 0 12.3 3.5H6.2A2.7 2.7 0 0 0 3.5 6.2v6.1A2.7 2.7 0 0 0 6.2 15" />
  </Svg>
);

export const IconPhone = (p: P) => (
  <Svg {...p}>
    <path d="M5 4h3.5l1.7 4.2-2.1 1.5a12 12 0 0 0 6.2 6.2l1.5-2.1L20 15.5V19a1.6 1.6 0 0 1-1.8 1.6C10.4 19.8 4.2 13.6 3.4 5.8A1.6 1.6 0 0 1 5 4Z" />
  </Svg>
);

export const IconMail = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.8 7 8.2 6 8.2-6" />
  </Svg>
);

export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" /><path d="m4.5 17 4.8-4.4 4 3.4 2.6-2.3 3.6 3.3" />
  </Svg>
);

export const IconPdf = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" />
    <path d="M13.5 3v5.5H19M9 13.5h1.6a1.3 1.3 0 0 1 0 2.6H9V13.5v4.5" />
  </Svg>
);

export const IconFilter = (p: P) => (
  <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>
);

export const IconMenu = (p: P) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);

export const IconArrowLeft = (p: P) => (
  <Svg {...p}><path d="M19 12H5m6-6-6 6 6 6" /></Svg>
);

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z" />
    <path d="M18.5 4.5 19 6l1.5.5L19 7l-.5 1.5L18 7l-1.5-.5L18 6Z" />
  </Svg>
);

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M3.5 9.5h17M3.5 14.5h17" />
    <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </Svg>
);

export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4" />
  </Svg>
);
