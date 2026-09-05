'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * פס התקדמות בראש העמוד.
 *
 * שלד הטעינה פותר את המעבר שנמשך, אבל לא את הרגע שלפניו: בין הלחיצה
 * לבין הרגע שבו Next מחליף את התוכן יש שבריר שנייה שבו שום דבר על
 * המסך לא זז. במחשב מהיר זה בלתי מורגש, ובטלפון על רשת סלולרית זה
 * מספיק כדי שאדם יילחץ שוב.
 *
 * הפס מופיע על כל לחיצה בקישור פנימי, ונעלם כשהכתובת השתנתה. הוא
 * מתקדם בקצב דועך ולעולם אינו מגיע לסוף בעצמו — כי הוא אינו יודע כמה
 * זמן זה ייקח, ופס שקופץ ל־100 ואז ממתין גרוע מפס שמתקדם לאט.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const timer = useRef<number | null>(null);

  /* ---------- לחיצה על קישור פנימי מתחילה את הפס ---------- */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as HTMLElement | null)?.closest?.('a');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // עוגן באותו עמוד אינו ניווט
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setActive(true);
      setWidth(8);
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  /* ---------- התקדמות דועכת, כל עוד לא הגענו ---------- */
  useEffect(() => {
    if (!active) return undefined;
    timer.current = window.setInterval(() => {
      // ככל שמתקרבים, הצעד קטן. הפס נעצר סביב תשעים ומחכה
      setWidth((w) => (w >= 90 ? w : w + Math.max(0.6, (90 - w) / 12)));
    }, 120);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [active]);

  /* ---------- הכתובת השתנתה: סוגרים ---------- */
  useEffect(() => {
    if (!active) return undefined;
    setWidth(100);
    const id = window.setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 260);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]"
      role="progressbar"
      aria-label="טוען עמוד"
    >
      <div
        className="h-full bg-gradient-to-l from-gold-600 via-gold-300 to-gold-600
                   shadow-[0_0_10px_rgba(220,192,120,0.8)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
