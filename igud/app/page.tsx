import Image from 'next/image';
import Link from 'next/link';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import {
  fetchActiveCities, fetchLessons, fetchTaxonomy, fetchUpcoming, fetchVenues,
} from '@/lib/queries';
import type { LessonCard, Taxonomy, Venue } from '@/lib/types';
import LessonBoard from '@/components/LessonBoard';
import UpcomingTicker, { type UpcomingRow } from '@/components/UpcomingTicker';
import VenueMarquee, { type VenueTile } from '@/components/VenueMarquee';
import { relativeWhen, todayHebrew } from '@/lib/format';
import { SITE } from '@/lib/site';
import BeitMidrash from '@/components/art/BeitMidrash';
import { IconBook, IconBuilding, IconSparkle, IconUser } from '@/components/Icons';

export const revalidate = 120;

interface PageData {
  lessons: LessonCard[];
  total: number;
  upcoming: UpcomingRow[];
  venueTiles: VenueTile[];
  taxonomy: Taxonomy;
  cities: string[];
  teacherCount: number;
  ready: boolean;
}

async function loadData(): Promise<PageData> {
  const empty: PageData = {
    lessons: [], total: 0, upcoming: [], venueTiles: [],
    taxonomy: {}, cities: [], teacherCount: 0, ready: false,
  };
  if (!supabaseConfigured) return empty;

  try {
    const client = publicClient();
    const [board, upcoming, venues, taxonomy, cities, teachers] = await Promise.all([
      fetchLessons(client, {}, 0),
      fetchUpcoming(client, 20),
      fetchVenues(client, 18),
      fetchTaxonomy(client),
      fetchActiveCities(client),
      client.from('igud_teachers').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ]);

    const byVenue = new Map<string, UpcomingRow[]>();
    for (const row of upcoming as unknown as (UpcomingRow & { venue_id?: string })[]) {
      const key = row.venue_name || '';
      if (!key) continue;
      const list = byVenue.get(key) || [];
      list.push(row);
      byVenue.set(key, list);
    }

    const venueTiles: VenueTile[] = (venues as Venue[]).map((venue) => {
      const rows = byVenue.get(venue.name) || [];
      return {
        venue,
        total: rows.length,
        lessons: rows.slice(0, 3).map((r) => {
          const when = relativeWhen(r.next_at);
          return {
            id: r.lesson_id,
            title: r.title || r.topic || r.topics?.[0] || 'שיעור',
            teacher: r.teacher_name || '',
            when: `${when.day} ${when.time}`.trim(),
          };
        }),
      };
    });

    return {
      lessons: board.rows,
      total: board.total,
      upcoming: upcoming as unknown as UpcomingRow[],
      venueTiles,
      taxonomy,
      cities,
      teacherCount: teachers.count ?? 0,
      ready: true,
    };
  } catch {
    return empty;
  }
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gold-400/25 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400/20 text-gold-200">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl font-bold tabular-nums text-parch-50">{value}</span>
        <span className="block text-[0.72rem] text-royal-200">{label}</span>
      </span>
    </div>
  );
}

export default async function HomePage() {
  const data = await loadData();
  const hebrewToday = todayHebrew();

  return (
    <>
      {/* ---------- כותרת ראשית ---------- */}
      {/*
        האיור יושב מאחורי הכותרת ולא לצידה, ודוהה אל הטקסט.
        כך יש לעמוד עומק ואווירה, והמילים נשארות הדבר הראשון שקוראים.
      */}
      <section className="relative overflow-hidden bg-royal-800">
        <div className="pointer-events-none absolute inset-0">
          <BeitMidrash className="h-full w-full" />
          {/* שכבה כהה מצד הטקסט, כדי שהמילים יישבו על שקט ולא על פרטים */}
          <div className="absolute inset-0 bg-gradient-to-l from-royal-900/92 via-royal-800/72 to-royal-900/35" />
        </div>
        {/* פס זהב שסוגר את הפאנל, וקימור עדין אל התוכן הבהיר */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-gold-500/70 to-transparent" />

        <div className="relative mx-auto grid max-w-[1400px] items-center gap-8 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:pb-16 lg:pt-16">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/60 bg-royal-900/50 px-3.5 py-1.5 text-[0.78rem] font-bold text-gold-200 backdrop-blur-sm">
              <IconSparkle className="h-3.5 w-3.5" />
              {hebrewToday}
            </span>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.15] text-parch-50 sm:text-5xl lg:text-[3.5rem]">
              כל שיעורי התורה בארץ,
              <br />
              <span className="bg-gradient-to-l from-gold-500 via-gold-300 to-gold-500 bg-clip-text text-transparent">
                במקום אחד
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-royal-100 sm:text-lg">
              מאגר ארצי מתעדכן של זמני שיעורי תורה. מחפשים שיעור לפי רב, נושא, עיר או בית כנסת,
              ורואים מיד מה הקרוב ביותר. כל מגיד שיעור ומרכז תורני מעדכנים את הזמנים שלהם בעצמם.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/search"
                className="btn btn-gold !px-7 !py-3 !text-base shadow-[0_10px_30px_-10px_rgba(201,164,79,0.7)]"
              >
                חיפוש שיעור
              </Link>
              <Link
                href="/add"
                className="btn !px-7 !py-3 !text-base border border-gold-400/50 bg-white/10 text-parch-50
                           backdrop-blur-sm transition hover:border-gold-300 hover:bg-white/20"
              >
                הוספת שיעור למאגר
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Stat
                icon={<IconBook className="h-4 w-4" />}
                value={data.total.toLocaleString('he-IL')}
                label="שיעורים במאגר"
              />
              <Stat
                icon={<IconUser className="h-4 w-4" />}
                value={data.teacherCount.toLocaleString('he-IL')}
                label="מגידי שיעור"
              />
              <Stat
                icon={<IconBuilding className="h-4 w-4" />}
                value={data.cities.length.toLocaleString('he-IL')}
                label="ערים ויישובים"
              />
            </div>
          </div>

          <div className="hidden justify-self-center lg:block">
            {/* הילה רכה מאחורי הלוגו, כדי שלא ייראה מודבק על הרקע */}
            <div className="relative">
              <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-gradient-to-b from-gold-400/25 to-royal-400/25 blur-3xl" />
              <Image
                src={SITE.logo}
                alt={SITE.name}
                width={640}
                height={705}
                priority
                className="h-auto w-[17rem] drop-shadow-[0_22px_48px_rgba(16,40,49,0.32)] xl:w-[20rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="rule-gold" />
      </div>

      {/* ---------- לוח השיעורים ---------- */}
      <div className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6">
        {!data.ready ? (
          <div className="rounded-2xl border border-dashed border-parch-300 bg-white/60 p-12 text-center">
            <h2 className="font-display text-xl font-bold text-royal-700">המאגר בהתחברות</h2>
            <p className="mt-2 text-sm text-ink-500">
              לא הושלמה ההגדרה של מסד הנתונים. יש להשלים את משתני הסביבה של Supabase.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <LessonBoard
              initialRows={data.lessons}
              initialTotal={data.total}
              taxonomy={data.taxonomy}
              cities={data.cities}
              columns={2}
              heading="שיעורים במאגר"
            />

            <div className="lg:sticky lg:top-24 lg:self-start">
              <UpcomingTicker rows={data.upcoming} />
            </div>
          </div>
        )}
      </div>

      {/* ---------- מרכזי תורה ---------- */}
      <VenueMarquee items={data.venueTiles} />

      {/* ---------- הצטרפות ---------- */}
      <section className="mx-auto mt-20 max-w-[1400px] px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-gold-400/60 bg-gradient-to-l from-royal-700 to-royal-800 p-8 text-gold-100 sm:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                מעוניינים לפתוח שיעור, או למסור שיעור?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gold-200/85 sm:text-base">
                האיגוד מחבר בין בתי כנסת, מרכזים תורניים וקהילות שמחפשים מגיד שיעור,
                לבין מגידי שיעור שמחפשים מקום למסור בו. מילוי טופס קצר, והצוות מתאים ביניכם.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
              <Link href="/join/host" className="btn btn-gold !px-6 !py-3">
                מעוניינים לפתוח שיעור תורה
              </Link>
              <Link href="/join/maggid" className="btn !border !border-gold-400/70 !bg-transparent !px-6 !py-3 !text-gold-200 hover:!bg-white/10">
                הצטרפות כמגיד שיעור
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
