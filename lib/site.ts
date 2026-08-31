/** קבועי המותג והערוצים של איגוד השיעורים. */

export const SITE = {
  name: 'איגוד השיעורים',
  tagline: 'מחברים בין לומדים ומלמדים',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://igud-hashiurim.vercel.app',
  logo: '/brand/logo-640.webp',
  logoLarge: '/brand/logo-1024.webp',
  logoSmall: '/brand/logo-220.webp',
  mark: '/brand/mark-256.webp',
  markSmall: '/brand/mark-96.webp',

  /** המערכת הקולית של האיגוד */
  voiceLine: '023130600',
  /** קו נוסף שמופיע בטפסי נדרים פלוס */
  updatesLine: '023131600',
  email: 'E023130600@GMAIL.COM',
} as const;

/** שיעור בלי לוגו משלו מקבל את סמל האיגוד. */
export const FALLBACK_LOGO = '/brand/mark-256.webp';

export const NAV = [
  { href: '/', label: 'ראשי' },
  { href: '/search', label: 'חיפוש שיעור' },
  { href: '/centers', label: 'מרכזי תורה' },
  { href: '/rabbis', label: 'מגידי שיעור' },
  { href: '/about', label: 'אודות' },
] as const;
