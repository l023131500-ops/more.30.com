'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconPlus } from './Icons';

/**
 * כפתור צף עגול שקורא להוסיף שיעור למאגר.
 * מתרחב לרוחב אחרי רגע, ומתכווץ בחזרה כשגוללים.
 */
export default function FloatingCta() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = window.setTimeout(() => setVisible(true), 900);
    const grow = window.setTimeout(() => setExpanded(true), 2200);
    const shrink = window.setTimeout(() => setExpanded(false), 8200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(grow);
      window.clearTimeout(shrink);
    };
  }, []);

  const hidden =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/portal') ||
    pathname?.startsWith('/add') ||
    pathname?.startsWith('/join');

  if (hidden) return null;

  return (
    <div
      className={`fixed bottom-5 left-5 z-40 no-print transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <Link
        href="/add"
        onMouseEnter={() => setExpanded(true)}
        onFocus={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onBlur={() => setExpanded(false)}
        className="animate-soft-pulse group flex items-center gap-3 rounded-full border border-gold-500
                   bg-gradient-to-br from-royal-600 to-royal-800 p-1 pl-1 text-gold-100
                   transition-all duration-500 hover:from-royal-500 hover:to-royal-700"
        aria-label="מעוניינים להפיץ תורה? הוספת שיעור למאגר"
      >
        <span
          className={`grid place-items-center rounded-full bg-gold-400/15 transition-all duration-500
                      ${expanded ? 'h-12 w-12' : 'h-14 w-14'}`}
        >
          <IconPlus className="h-6 w-6 text-gold-300" strokeWidth={2} />
        </span>

        <span
          className={`overflow-hidden whitespace-nowrap text-right transition-all duration-500
                      ${expanded ? 'max-w-[16rem] pl-4 opacity-100' : 'max-w-0 opacity-0'}`}
        >
          <span className="block text-[0.72rem] leading-tight text-gold-300">
            מעוניינים להפיץ תורה?
          </span>
          <span className="block text-sm font-bold leading-tight">הוספת שיעור למאגר</span>
        </span>
      </Link>
    </div>
  );
}
