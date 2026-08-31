import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchLessons } from '@/lib/queries';
import { rabbiName } from '@/lib/format';
import { FALLBACK_LOGO, SITE } from '@/lib/site';
import LessonCardTile from '@/components/LessonCard';
import { IconBuilding, IconPin, IconUser } from '@/components/Icons';

export const revalidate = 120;

interface ResolvedLink {
  kind: 'teacher' | 'venue';
  id: string;
  name: string;
  honorific: string | null;
  logo: string | null;
  city: string | null;
  about: string | null;
  organization: string | null;
}

async function load(token: string) {
  if (!supabaseConfigured) return null;
  const client = publicClient();
  const { data } = await client.rpc('igud_resolve_link', { p_token: token });
  const link = data as ResolvedLink | null;
  if (!link) return null;

  const board = await fetchLessons(
    client,
    link.kind === 'teacher' ? { teacher: link.id } : { venue: link.id },
    0,
    60,
  ).catch(() => ({ rows: [], total: 0 }));

  return { link, board };
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const data = await load(token);
  if (!data) return { title: 'הקישור לא נמצא', robots: { index: false } };
  const name = data.link.kind === 'teacher'
    ? rabbiName(data.link.name, data.link.honorific || 'הרב')
    : data.link.name;
  return {
    title: `שיעורי ${name}`,
    description: `לוח הזמנים של השיעורים של ${name}`,
    robots: { index: false, follow: false },
  };
}

export default async function PersonalLinkPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();

  const { link, board } = data;
  const name = link.kind === 'teacher'
    ? rabbiName(link.name, link.honorific || 'הרב')
    : link.name;
  const logo = mediaUrl(link.logo) || FALLBACK_LOGO;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="mb-10 text-center">
        <span className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-2xl
                         border border-parch-300 bg-white/80 p-2 shadow-[var(--shadow-card)]">
          <Image
            src={logo}
            alt=""
            width={224}
            height={224}
            className="h-full w-full object-contain"
            unoptimized={logo.startsWith('http')}
          />
        </span>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          {link.kind === 'teacher'
            ? <IconUser className="h-3.5 w-3.5" />
            : <IconBuilding className="h-3.5 w-3.5" />}
          {link.kind === 'teacher' ? 'שיעורי הרב' : link.organization || 'מרכז תורה'}
        </p>

        <h1 className="mt-1 font-display text-3xl font-bold text-wine-700 sm:text-4xl">{name}</h1>

        {link.city && (
          <p className="mt-2 flex items-center justify-center gap-1 text-sm text-ink-500">
            <IconPin className="h-3.5 w-3.5 text-gold-600" />
            {link.city}
          </p>
        )}

        {link.about && (
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">{link.about}</p>
        )}

        <div className="rule-gold mx-auto mt-8 max-w-sm" />
      </header>

      {board.rows.length === 0 ? (
        <p className="py-12 text-center text-ink-500">אין כרגע שיעורים מפורסמים.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {board.rows.map((lesson, i) => (
            <LessonCardTile
              key={lesson.id}
              lesson={lesson}
              index={i}
              overrideLogo={mediaUrl(lesson.logo_url) || logo}
            />
          ))}
        </div>
      )}

      <footer className="mt-14 text-center">
        <div className="rule-gold mx-auto mb-6 max-w-xs" />
        <Link href="/" className="inline-flex flex-col items-center gap-2 text-ink-500 transition hover:text-wine-600">
          <Image src="/brand/mark-96.webp" alt="" width={96} height={96} className="h-10 w-10 opacity-80" />
          <span className="text-[0.78rem] font-bold">
            מוצג באדיבות {SITE.name} · {SITE.tagline}
          </span>
        </Link>
      </footer>
    </div>
  );
}
