import { publicClient, supabaseConfigured } from './supabase';
import { fetchTaxonomy } from './queries';
import type { Taxonomy } from './types';
import fallback from '@/data/taxonomy.json';

/** רשימות הבחירה מהמסד, ואם אין חיבור, מהקובץ שנשמר בקוד. */
export async function loadTaxonomy(): Promise<Taxonomy> {
  if (supabaseConfigured) {
    const fetched = await fetchTaxonomy(publicClient()).catch(() => null);
    if (fetched && Object.keys(fetched).length) return fetched;
  }
  return fallback as unknown as Taxonomy;
}
