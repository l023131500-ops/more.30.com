import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mediaUrl, publicClient, supabaseConfigured } from '@/lib/supabase';
import {
  fetchLesson, TEACHER_PUBLIC_COLUMNS, VENUE_PUBLIC_COLUMNS,
} from '@/lib/queries';
import type { LessonCard, Teacher, Venue } from '@/lib/types';
import {
  addressLine, BROADCAST_LABEL, dayLabel, hebrewLabel, lessonTitle, placeName,
  rabbiName, relativeWhen, telHref, timeLabel,
} from '@/lib/format';
import { FALLBACK_LOGO, SITE } from '@/lib/site';
import LessonActions from '@/components/LessonActions';
import { BroadcastMarks } from '@/components/LessonCard';
import {
  IconArrowLeft, IconBuilding, IconCalendar, IconClock, IconGlobe,
  IconPhone, IconPin, IconUser,
} from '@/components/Icons';

export const revalidate = 120;

async function load(id: string) {
  if (!supabaseConfigured) return null;
  const client = publicClient();
  const lesson = await fetchLesson(client, id).catch(() => null);
  if (!lesson) return null;

  const [teacher, venue] = await Promise.all([
    lesson.teacher_id
      ? client.from('igud_teachers').select(TEACHER_PUBLIC_COLUMNS).eq('id', lesson.teacher_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lesson.venue_id
      ? client.from('igud_venues').select(VENUE_PUBLIC_COLUMNS).eq('id', lesson.venue_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    lesson,
    teacher: (teacher.data as unknown as Teacher) || null,
    venue: (venue.data as unknown as Venue) || null,
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'שיעור לא נמצא' };

  const { lesson } = data;
  const place = placeName(lesson);
  const title = `${lessonTitle(lesson)} · ${rabbiName(lesson.teacher_name)}`;
  const description = [place, addressLine(lesson)].filter(Boolean).join(' · ');

  return {
    title,
    description: description || 'שיעור תורה במאגר איגוד השיעורים',
    openGraph: { title, description, type: 'article' },
  };
}

function Detail({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-parch-200 py-3 last:border-0">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold-100 text-gold-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-ink-500">{label}</div>
        <div className="mt-0.5 text-[0.95rem] text-ink-900">{children}</div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-parch-300 bg-white/70 px-2.5 py-1 text-[0.75rem] font-bold text-ink-700">
      {children}
    </span>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  const { lesson, teacher, venue } = data;
  const when = relativeWhen(lesson.next_at);
  const place = placeName(lesson);
  const address = addressLine(lesson);
  const logo = mediaUrl(lesson.logo_url) || mediaUrl(venue?.logo_url ?? null)
    || mediaUrl(teacher?.photo_url ?? null) || FALLBACK_LOGO;
  const phoneHref = telHref(lesson.contact_phone);

  const mapQuery = [place, address].filter(Boolean).join(' ');

  return (
    <article className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="no-print mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה למאגר
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ---------- ראשי ---------- */}
        <div>
          <div className="card-surface relative overflow-hidden rounded-2xl">
            <div className="bg-gradient-to-l from-wine-700 to-wine-800 px-6 py-6 sm:px-8">
              <div className="flex items-start gap-5">
                <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl
                                 border border-gold-500/40 bg-white/95 p-1.5 sm:h-24 sm:w-24">
                  <Image
                    src={logo}
                    alt=""
                    width={192}
                    height={192}
                    className="h-full w-full object-contain"
                    unoptimized={logo.startsWith('http')}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold leading-tight text-gold-100 sm:text-3xl">
                    {lessonTitle(lesson)}
                  </h1>
                  <p className="mt-1.5 text-base font-bold text-gold-300">
                    {rabbiName(lesson.teacher_name)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <BroadcastMarks value={lesson.broadcast} size="md" />
                  </div>
                </div>
              </div>
            </div>

            {when.day !== 'בתיאום' && (
              <div className="flex items-center gap-3 border-b border-parch-200 bg-gold-50 px-6 py-3 sm:px-8">
                <IconClock className="h-4 w-4 text-gold-700" />
                <span className="text-sm font-bold text-wine-700">
                  המועד הקרוב: {when.day} בשעה {when.time}
                </span>
              </div>
            )}

            <div className="px-6 py-4 sm:px-8">
              <Detail icon={<IconCalendar className="h-4 w-4" />} label="מועדי השיעור">
                {lesson.schedule?.length ? (
                  <ul className="space-y-1">
                    {lesson.schedule.map((occ, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-bold">{dayLabel(occ)}</span>
                        <span className="tabular-nums">{timeLabel(occ)}</span>
                        {occ.date && (
                          <span className="text-[0.78rem] text-ink-500">{hebrewLabel(occ.date)}</span>
                        )}
                        {occ.note && !occ.time && (
                          <span className="text-[0.78rem] text-ink-500">{occ.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-ink-500">המועד יעודכן</span>
                )}
                {lesson.frequency && (
                  <div className="mt-1 text-[0.78rem] text-ink-500">{lesson.frequency}</div>
                )}
              </Detail>

              {(place || address) && (
                <Detail icon={<IconPin className="h-4 w-4" />} label="מיקום">
                  {place && <div className="font-bold">{place}</div>}
                  {address && <div className="text-ink-700">{address}</div>}
                  {mapQuery && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print mt-1 inline-block text-[0.8rem] font-bold text-wine-600 underline underline-offset-2"
                    >
                      פתיחה במפה
                    </a>
                  )}
                </Detail>
              )}

              <Detail icon={<IconUser className="h-4 w-4" />} label="קהל היעד">
                <div className="flex flex-wrap gap-1.5">
                  {lesson.audience_gender && <Tag>{lesson.audience_gender}</Tag>}
                  {lesson.audience_styles?.map((a) => <Tag key={a}>{a}</Tag>)}
                  {!lesson.audience_gender && !lesson.audience_styles?.length && (
                    <span className="text-ink-500">לכל הציבור</span>
                  )}
                </div>
              </Detail>

              {(lesson.topics?.length || lesson.topic_other || lesson.lesson_character?.length) && (
                <Detail icon={<IconGlobe className="h-4 w-4" />} label="נושאים ואופי השיעור">
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.topics?.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-[0.75rem] font-bold text-gold-700"
                      >
                        {t}
                      </span>
                    ))}
                    {lesson.topic_other && <Tag>{lesson.topic_other}</Tag>}
                    {lesson.lesson_character?.map((c) => <Tag key={c}>{c}</Tag>)}
                  </div>
                </Detail>
              )}

              <Detail icon={<IconGlobe className="h-4 w-4" />} label="שפה וסגנון">
                <div className="flex flex-wrap gap-1.5">
                  {lesson.language && <Tag>{lesson.language}</Tag>}
                  {lesson.lesson_style && <Tag>{lesson.lesson_style}</Tag>}
                  {lesson.speech_style?.map((s) => <Tag key={s}>{s}</Tag>)}
                  <Tag>{BROADCAST_LABEL[lesson.broadcast]}</Tag>
                </div>
              </Detail>

              {lesson.description && (
                <Detail icon={<IconBuilding className="h-4 w-4" />} label="פרטים נוספים">
                  <p className="whitespace-pre-line leading-relaxed">{lesson.description}</p>
                </Detail>
              )}

              {lesson.season_note && (
                <Detail icon={<IconCalendar className="h-4 w-4" />} label="הערות ועדכונים">
                  <p className="whitespace-pre-line leading-relaxed">{lesson.season_note}</p>
                </Detail>
              )}

              {(lesson.contact_phone || lesson.contact_name) && (
                <Detail icon={<IconPhone className="h-4 w-4" />} label="לפרטים">
                  {lesson.contact_name && <span>{lesson.contact_name} </span>}
                  {phoneHref ? (
                    <a href={phoneHref} className="font-bold text-wine-600 tabular-nums underline underline-offset-2">
                      {lesson.contact_phone}
                    </a>
                  ) : (
                    lesson.contact_phone
                  )}
                </Detail>
              )}

              {lesson.organization && (
                <Detail icon={<IconBuilding className="h-4 w-4" />} label="בהפקת">
                  {lesson.organization}
                </Detail>
              )}
            </div>
          </div>

          <div className="mt-5">
            <LessonActions lesson={lesson} />
          </div>

          {/* ---------- שני הכפתורים התחתונים ---------- */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {lesson.teacher_id && (
              <Link
                href={`/rabbi/${lesson.teacher_id}`}
                className="card-surface flex items-center gap-3 rounded-xl px-5 py-4"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-wine-700 text-gold-200">
                  <IconUser className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-display text-base font-bold text-wine-700">
                    לכל שיעורי הרב
                  </span>
                  <span className="block text-[0.78rem] text-ink-500">
                    {rabbiName(lesson.teacher_name)}
                  </span>
                </span>
              </Link>
            )}
            {lesson.venue_id && (
              <Link
                href={`/venue/${lesson.venue_id}`}
                className="card-surface flex items-center gap-3 rounded-xl px-5 py-4"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500 text-wine-800">
                  <IconBuilding className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-display text-base font-bold text-wine-700">
                    לכל השיעורים במקום
                  </span>
                  <span className="block text-[0.78rem] text-ink-500">{lesson.venue_name}</span>
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* ---------- צד ---------- */}
        <aside className="no-print space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-parch-300 bg-white/70 p-5">
            <h2 className="font-display text-base font-bold text-wine-700">עדכון פרטי השיעור</h2>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-500">
              מגיד השיעור או האחראי על המקום יכולים לעדכן את הזמנים בכל עת,
              באתר, בעמדות נדרים פלוס או במערכת הקולית.
            </p>
            <div className="mt-4 space-y-2">
              <Link href="/portal" className="btn btn-quiet w-full !py-2 !text-[0.82rem]">
                כניסה לאזור האישי
              </Link>
              <a href={`tel:${SITE.voiceLine}`} className="btn btn-quiet w-full !py-2 !text-[0.82rem]">
                <IconPhone className="h-3.5 w-3.5" />
                מערכת קולית {SITE.voiceLine}
              </a>
            </div>
          </div>

          {venue && (
            <div className="rounded-2xl border border-parch-300 bg-white/70 p-5">
              <h2 className="font-display text-base font-bold text-wine-700">{venue.name}</h2>
              {venue.nusach && <p className="mt-1 text-[0.8rem] text-ink-500">נוסח {venue.nusach}</p>}
              {venue.about && <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-700">{venue.about}</p>}
              <Link
                href={`/venue/${venue.id}`}
                className="mt-3 inline-block text-[0.82rem] font-bold text-wine-600 underline underline-offset-2"
              >
                כל השיעורים במקום
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-gold-400/60 bg-gold-50 p-5">
            <h2 className="font-display text-base font-bold text-wine-700">מוסרים שיעור?</h2>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-700">
              הוסיפו את השיעור שלכם למאגר, ואלפי לומדים ימצאו אתכם.
            </p>
            <Link href="/add" className="btn btn-primary mt-3 w-full !py-2 !text-[0.82rem]">
              הוספת שיעור למאגר
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
