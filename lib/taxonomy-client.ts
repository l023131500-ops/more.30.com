'use client';

import { publicClient } from './supabase';
import { fetchTaxonomy } from './queries';
import type { Taxonomy } from './types';
import fallback from '@/data/taxonomy.json';

let cache: Taxonomy | null = null;

/** רשימות הבחירה, בטעינה אחת לכל חיי הדף. */
export async function loadTaxonomyClient(): Promise<Taxonomy> {
  if (cache) return cache;
  try {
    const fetched = await fetchTaxonomy(publicClient());
    if (Object.keys(fetched).length) {
      cache = fetched;
      return cache;
    }
  } catch {
    // ממשיכים עם הרשימות שנשמרו בקוד
  }
  cache = fallback as unknown as Taxonomy;
  return cache;
}
