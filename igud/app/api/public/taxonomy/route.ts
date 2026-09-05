import { NextResponse } from 'next/server';
import { loadTaxonomy } from '@/lib/load-taxonomy';
import { SITE } from '@/lib/site';

export const revalidate = 3600;

/** רשימות הבחירה של הטפסים, לשילוב במערכות אחרות. */
export async function GET() {
  const taxonomy = await loadTaxonomy();
  return NextResponse.json(
    { source: SITE.name, taxonomy },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' } },
  );
}
