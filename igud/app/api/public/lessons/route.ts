import { NextResponse } from 'next/server';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchLessons } from '@/lib/queries';
import type { LessonFilters } from '@/lib/types';
import { SITE } from '@/lib/site';

export const revalidate = 120;

/** ממשק ציבורי לקריאת השיעורים שאושרו לפרסום. */
export async function GET(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'המאגר אינו מחובר' }, { status: 503 });
  }

  const url = new URL(request.url);
  const filters: LessonFilters = {
    q: url.searchParams.get('q') || undefined,
    city: url.searchParams.get('city') || undefined,
    topic: url.searchParams.get('topic') || undefined,
    gender: url.searchParams.get('gender') || undefined,
    language: url.searchParams.get('language') || undefined,
    style: url.searchParams.get('style') || undefined,
    day: url.searchParams.get('day') || undefined,
    broadcast: url.searchParams.get('broadcast') || undefined,
    teacher: url.searchParams.get('teacher') || undefined,
    venue: url.searchParams.get('venue') || undefined,
  };

  const page = Math.max(0, Number(url.searchParams.get('page') || '0'));
  const pageSize = Math.min(Number(url.searchParams.get('limit') || '50'), 200);

  try {
    const { rows, total } = await fetchLessons(publicClient(), filters, page, pageSize);
    return NextResponse.json(
      {
        source: SITE.name,
        total,
        page,
        limit: pageSize,
        lessons: rows.map((lesson) => ({
          id: lesson.id,
          number: lesson.public_no,
          title: lesson.title,
          topic: lesson.topic,
          topics: lesson.topics,
          teacher: lesson.teacher_name,
          organization: lesson.organization,
          venue: lesson.venue_name,
          city: lesson.city,
          neighborhood: lesson.neighborhood,
          street: lesson.street,
          house_no: lesson.house_no,
          audience: lesson.audience_gender,
          audience_styles: lesson.audience_styles,
          language: lesson.language,
          style: lesson.lesson_style,
          broadcast: lesson.broadcast,
          schedule_kind: lesson.schedule_kind,
          schedule: lesson.schedule,
          next_at: lesson.next_at,
          url: `${SITE.url}/lesson/${lesson.id}`,
        })),
      },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=120' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בקריאת הנתונים' },
      { status: 500 },
    );
  }
}
