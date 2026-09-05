'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * עוטף שמכניס את התוכן למסך ברגע שהוא באמת נראה.
 *
 * ההבדל בין זה לבין אנימציית טעינה הוא שאדם שגולל לאמצע העמוד רואה
 * את החלק הזה נכנס עכשיו, ולא מגיע אל שדה שכבר סיים לזוז לפני שהספיק
 * להסתכל. ה-index קובע את ההשהיה, וכך רשת של שישה כרטיסים נפרשת
 * בקצב אחיד במקום לקפוץ בבת אחת.
 *
 * המחיצה נפתחת פעם אחת ונסגרת: אין טעם לנתק ולחבר צופה בכל גלילה,
 * וגם אין טעם להנפיש שוב משהו שכבר נראה.
 */
export default function Reveal({
  children,
  index = 0,
  className = '',
  style,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // דפדפן ישן, או עיבוד בשרת: מציגים מיד ולא מסתירים תוכן
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // מעט לפני שהאיבר נוגע בתחתית המסך, כך שהוא כבר במקומו כשמגיעים אליו
      { rootMargin: '0px 0px -10% 0px', threshold: 0.06 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-in={shown ? 'true' : 'false'}
      style={{ ...style, '--reveal-delay': `calc(${Math.min(index, 9)} * var(--stagger))` } as CSSProperties}
    >
      {children}
    </div>
  );
}
