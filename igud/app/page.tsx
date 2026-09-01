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
    <div className="flex items-center gap-3 rounded-xl border border-parch-300 bg-white/60 px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-100 text-gold-700">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl font-bold tabular-nums text-royal-700">{value}</span>
        <span className="block text-[0.72rem] text-ink-500">{label}</span>
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
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]">
          <div className="absolute left-[-8%] top-[-30%] h-[34rem] w-[34rem] rounded-full bg-royal-600 blur-3xl" />
          <div className="absolute right-[-6%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-gold-500 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-14">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-400 bg-gold-50 px-3.5 py-1.5 text-[0.78rem] font-bold text-gold-700">
              <IconSparkle className="h-3.5 w-3.5" />
              {hebrewToday}
            </span>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.15] text-royal-700 sm:text-5xl lg:text-[3.4rem]">
              כל שיעורי התורה בארץ,
              <br />
              <span className="text-gold-600">במקום אחד</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-700 sm:text-lg">
              מאגר ארצי מתעדכן של זמני שיעורי תורה. מחפשים שיעור לפי רב, נושא, עיר או בית כנסת,
              ורואים מיד מה הקרוב ביותר. כל מגיד שיעור ומרכז תורני מעדכנים את הזמנים שלהם בעצמם.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/search" className="btn btn-primary !px-7 !py-3 !text-base">
                חיפוש שיעור
              </Link>
              <Link href="/add" className="btn btn-gold !px-7 !py-3 !text-base">
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
            <Image
              src={SITE.logo}
              alt={SITE.name}
              width={640}
              height={754}
              priority
              className="h-auto w-[17rem] drop-shadow-[0_18px_40px_rgba(74,24,24,0.28)] xl:w-[20rem]"
            />
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
