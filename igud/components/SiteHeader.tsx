'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, SITE } from '@/lib/site';
import { IconMenu, IconClose, IconPhone } from './Icons';

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname?.startsWith('/admin') || pathname?.startsWith('/portal')) return null;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 no-print ${
        lifted
          ? 'bg-parch-100/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(198,167,92,0.35),0_10px_30px_-24px_rgba(42,21,18,0.5)]'
          : 'bg-parch-100/80 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group shrink-0" aria-label={SITE.name}>
          <Image
            src={SITE.logoSmall}
            alt=""
            width={220}
            height={259}
            priority
            className={`w-auto transition-all duration-300 ${lifted ? 'h-10' : 'h-12 sm:h-14'}`}
          />
          <span className="hidden sm:block leading-tight">
            <span className="block font-display text-lg font-bold text-royal-700 sm:text-xl">
              {SITE.name}
            </span>
            <span className="block text-[0.7rem] tracking-wide text-ink-500">{SITE.tagline}</span>
          </span>
        </Link>

        <nav className="mr-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  active ? 'text-royal-700' : 'text-ink-700 hover:text-royal-600'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-gold-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mr-auto flex items-center gap-2 lg:mr-2">
          <a
            href={`tel:${SITE.voiceLine}`}
            className="hidden items-center gap-1.5 rounded-lg border border-parch-300 bg-white/70
                       px-3 py-1.5 text-xs font-bold text-royal-700 transition hover:border-gold-400 md:flex"
            title="המערכת הקולית של האיגוד"
          >
            <IconPhone className="h-3.5 w-3.5" />
            {SITE.voiceLine}
          </a>

          <Link href="/join" className="btn btn-quiet !px-3 !py-1.5 !text-xs sm:!text-sm">
            הצטרפות לאיגוד
          </Link>
          <Link href="/add" className="btn btn-primary !px-3 !py-1.5 !text-xs sm:!text-sm">
            הוספת שיעור
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'סגירת התפריט' : 'פתיחת התפריט'}
            aria-expanded={open}
            className="rounded-lg border border-parch-300 bg-white/70 p-2 text-royal-700 lg:hidden"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="rule-gold opacity-60" />

      {open && (
        <div className="border-b border-parch-300 bg-parch-50 lg:hidden">
          <nav className="mx-auto flex max-w-[1400px] flex-col px-4 py-2 sm:px-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-bold text-ink-700 hover:bg-gold-50 hover:text-royal-700"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={`tel:${SITE.voiceLine}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-royal-700"
            >
              <IconPhone className="h-4 w-4" />
              מערכת קולית {SITE.voiceLine}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
