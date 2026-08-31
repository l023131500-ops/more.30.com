import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import {
  fetchActiveCities, fetchLessons, fetchTaxonomy, TEACHER_PUBLIC_COLUMNS,
} from '@/lib/queries';
import type { Teacher } from '@/lib/types';
import { rabbiName } from '@/lib/format';
import { FALLBACK_LOGO } from '@/lib/site';
import LessonBoard from '@/components/LessonBoard';
import { IconArrowLeft, IconPin, IconUser } from '@/components/Icons';

export const revalidate = 120;

async function load(id: string) {
  if (!supabaseConfigured) return null;
  const client = publicClient();
  const { data } = await client.from('igud_teachers').select(TEACHER_PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  if (!data) return null;

  const [board, taxonomy, cities] = await Promise.all([
    fetchLessons(client, { teacher: id }, 0, 24),
    fetchTaxonomy(client),
    fetchActiveCities(client),
  ]);
  return { teacher: data as unknown as Teacher, board, taxonomy, cities };
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'מגיד השיעור לא נמצא' };
  const name = rabbiName(data.teacher.full_name, data.teacher.honorific || 'הרב');
  return {
    title: `כל שיעורי ${name}`,
    description: `רשימת השיעורים של ${name} במאגר איגוד השיעורים`,
  };
}

export default async function RabbiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const { teacher, board, taxonomy, cities } = data;
  const name = rabbiName(teacher.full_name, teacher.honorific || 'הרב');
  const photo = mediaUrl(teacher.photo_url) || mediaUrl(teacher.logo_url) || FALLBACK_LOGO;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה למאגר
      </Link>

      <header className="card-surface mb-8 flex flex-wrap items-center gap-5 rounded-2xl p-6 sm:p-8">
        <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl
                         border border-parch-300 bg-white/80 p-2">
          <Image
            src={photo}
            alt=""
            width={192}
            height={192}
            className="h-full w-full object-contain"
            unoptimized={photo.startsWith('http')}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
            <IconUser className="h-3.5 w-3.5" />
            מגיד שיעור
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-wine-700">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            {teacher.city && (
              <span className="flex items-center gap-1">
                <IconPin className="h-3.5 w-3.5 text-gold-600" />
                {teacher.city}
              </span>
            )}
            {teacher.organization && <span>{teacher.organization}</span>}
            {teacher.occupation && <span>{teacher.occupation}</span>}
            {teacher.background && <span>{teacher.background}</span>}
          </div>
          {teacher.bio && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">{teacher.bio}</p>
          )}
          {teacher.topics?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {teacher.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-[0.72rem] font-bold text-gold-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <LessonBoard
        initialRows={board.rows}
        initialTotal={board.total}
        taxonomy={taxonomy}
        cities={cities}
        lockedFilters={{ teacher: id }}
        columns={2}
        showFilters={false}
        heading={`כל השיעורים של ${name}`}
      />
    </div>
  );
}
