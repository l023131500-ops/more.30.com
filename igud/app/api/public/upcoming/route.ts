import { NextResponse } from 'next/server';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchUpcoming } from '@/lib/queries';
import { SITE } from '@/lib/site';

export const revalidate = 60;

/** המועדים הקרובים ביותר, שורה לכל מועד. */
export async function GET(request: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'המאגר אינו מחובר' }, { status: 503 });
  }
  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') || '25'), 100);

  try {
    const rows = await fetchUpcoming(publicClient(), limit);
    return NextResponse.json(
      { source: SITE.name, count: rows.length, upcoming: rows },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בקריאת הנתונים' },
      { status: 500 },
    );
  }
}
