import Link from 'next/link';
import Image from 'next/image';
import type { LessonCard as Lesson } from '@/lib/types';
import { FALLBACK_LOGO } from '@/lib/site';
import { mediaUrl } from '@/lib/supabase';
import {
  addressLine, lessonTitle, placeName, rabbiName, relativeWhen, scheduleSummary,
} from '@/lib/format';
import { IconClock, IconLive, IconMic, IconPin, IconUser } from './Icons';

export function BroadcastMarks({ value, size = 'sm' }: { value: string; size?: 'sm' | 'md' }) {
  const recorded = value === 'recorded' || value === 'both';
  const live = value === 'live' || value === 'both';
  if (!recorded && !live) return null;

  const pad = size === 'md' ? 'px-2.5 py-1 text-[0.72rem]' : 'px-2 py-0.5 text-[0.66rem]';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <>
      {recorded && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border border-gold-500/60
                      bg-gold-100 font-bold text-gold-700 ${pad}`}
          title="השיעור מוקלט"
        >
          <IconMic className={icon} />
          מוקלט
        </span>
      )}
      {live && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border border-royal-500/50
                      bg-royal-50 font-bold text-royal-600 ${pad}`}
          title="השיעור משודר בשידור חי"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-royal-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-royal-600" />
          </span>
          <IconLive className={icon} />
          שידור חי
        </span>
      )}
    </>
  );
}

export default function LessonCardTile({
  lesson,
  index = 0,
  overrideLogo,
}: {
  lesson: Lesson;
  index?: number;
  overrideLogo?: string | null;
}) {
  const when = relativeWhen(lesson.next_at);
  const place = placeName(lesson);
  const address = addressLine(lesson);
  const logo = overrideLogo || mediaUrl(lesson.logo_url) || FALLBACK_LOGO;

  return (
    <Link
      href={`/lesson/${lesson.id}`}
      className="card-surface card-edge animate-rise relative flex flex-col overflow-hidden rounded-2xl p-5 pr-6"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      <div className="flex items-start gap-4">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl
                         border border-parch-300 bg-white/70 p-1">
          <Image
            src={logo}
            alt=""
            width={112}
            height={112}
            className="h-full w-full object-contain"
            unoptimized={logo.startsWith('http')}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-snug text-royal-700 line-clamp-2">
            {lessonTitle(lesson)}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink-700">
            <IconUser className="h-3.5 w-3.5 text-gold-600" />
            <span className="truncate">{rabbiName(lesson.teacher_name)}</span>
          </p>
        </div>

        {when.day !== 'בתיאום' && (
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center leading-tight ${
              when.soon
                ? 'bg-gradient-to-br from-royal-600 to-royal-800 text-gold-200'
                : 'border border-parch-300 bg-white/70 text-royal-700'
            }`}
          >
            <span className="block text-[0.65rem] opacity-85">{when.day}</span>
            <span className="block font-display text-base font-bold tabular-nums">{when.time}</span>
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-ink-700">
        {place && (
          <p className="flex items-start gap-1.5">
            <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
            <span className="min-w-0">
              <span className="font-bold">{place}</span>
              {address && <span className="text-ink-500"> · {address}</span>}
            </span>
          </p>
        )}
        {!place && address && (
          <p className="flex items-start gap-1.5">
            <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
            <span>{address}</span>
          </p>
        )}
        <p className="flex items-start gap-1.5">
          <IconClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
          <span className="text-ink-500">{scheduleSummary(lesson)}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-parch-200 pt-3">
        <BroadcastMarks value={lesson.broadcast} />
        {lesson.audience_gender && (
          <span className="rounded-full border border-parch-300 bg-white/70 px-2 py-0.5 text-[0.66rem] font-bold text-ink-500">
            {lesson.audience_gender}
          </span>
        )}
        {lesson.language && lesson.language !== 'עברית' && (
          <span className="rounded-full border border-parch-300 bg-white/70 px-2 py-0.5 text-[0.66rem] font-bold text-ink-500">
            {lesson.language}
          </span>
        )}
        {lesson.lesson_style && (
          <span className="rounded-full border border-parch-300 bg-white/70 px-2 py-0.5 text-[0.66rem] font-bold text-ink-500">
            {lesson.lesson_style}
          </span>
        )}
        {lesson.topics?.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-full border border-gold-300 bg-gold-50 px-2 py-0.5 text-[0.66rem] font-bold text-gold-700"
          >
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
