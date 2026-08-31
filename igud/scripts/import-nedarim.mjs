/**
 * ייבוא ייצוא טפסים של נדרים פלוס אל מסד הנתונים של איגוד השיעורים.
 *
 *   node scripts/import-nedarim.mjs <קובץ.xlsx> [עוד קבצים] [--publish] [--dry]
 *
 * --publish  מפרסם מיד רשומות שעברו את בדיקת האיכות (ברירת מחדל: ממתין לאישור)
 * --dry      מציג מה ייובא בלי לכתוב למסד
 */

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { readXlsxFile } from './xlsx-node.mjs';
import {
  detectForm, parse4320, parse4063, parse4018, parse4357, looksLikeNoise,
} from '../lib/nedarim.js';

/* ------------------------- סביבה ------------------------- */

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function connect() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('חסר NEXT_PUBLIC_SUPABASE_URL');

  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: process.env.IGUD_SERVICE_EMAIL,
    password: process.env.IGUD_SERVICE_PASSWORD,
  });
  if (error) throw new Error(`התחברות נכשלה: ${error.message}`);
  return client;
}

/* ------------------------- עזרים ------------------------- */

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');

async function findOrCreateTeacher(db, cache, record) {
  const name = norm(record.teacher_name);
  if (!name || looksLikeNoise(name)) return null;
  if (cache.teachers.has(name)) return cache.teachers.get(name);

  const { data: found } = await db
    .from('igud_teachers').select('id').eq('full_name', name).maybeSingle();
  if (found) {
    cache.teachers.set(name, found.id);
    return found.id;
  }

  const { data, error } = await db.from('igud_teachers').insert({
    full_name: name,
    city: record.city,
    phone: record.contact_phone,
    email: record.contact_email,
    organization: record.organization,
    status: 'published',
  }).select('id').single();
  if (error) throw new Error(`יצירת רב נכשלה (${name}): ${error.message}`);

  cache.teachers.set(name, data.id);
  return data.id;
}

async function findOrCreateVenue(db, cache, record) {
  const name = norm(record.venue_name);
  if (!name || looksLikeNoise(name)) return null;
  const key = `${name}|${norm(record.city)}`;
  if (cache.venues.has(key)) return cache.venues.get(key);

  let query = db.from('igud_venues').select('id').eq('name', name);
  query = record.city ? query.eq('city', record.city) : query.is('city', null);
  const { data: found } = await query.maybeSingle();
  if (found) {
    cache.venues.set(key, found.id);
    return found.id;
  }

  const { data, error } = await db.from('igud_venues').insert({
    name,
    kind: 'בית כנסת',
    city: record.city,
    neighborhood: record.neighborhood,
    street: record.street,
    house_no: record.house_no,
    status: 'published',
  }).select('id').single();
  if (error) throw new Error(`יצירת מקום נכשל (${name}): ${error.message}`);

  cache.venues.set(key, data.id);
  return data.id;
}

/* ------------------------- ייבוא לפי טופס ------------------------- */

async function importLessons(db, records, { publish, dry }) {
  const cache = { teachers: new Map(), venues: new Map() };
  let ok = 0;
  let pending = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.teacher_name && !record.venue_name) {
      skipped += 1;
      continue;
    }
    const status = publish && record.publishable ? 'published' : 'pending';

    if (dry) {
      console.log(
        `  ${status === 'published' ? '✓' : '·'} ${record.teacher_name || '—'} | ` +
        `${record.venue_name || '—'} | ${record.city || '—'} | ` +
        `${record.occurrences.length} מועדים`,
      );
      status === 'published' ? (ok += 1) : (pending += 1);
      continue;
    }

    const teacherId = await findOrCreateTeacher(db, cache, record);
    const venueId = await findOrCreateVenue(db, cache, record);

    const { data: existing } = record.external_id
      ? await db.from('igud_lessons').select('id')
          .eq('source', 'nedarim').eq('source_ref', record.external_id).maybeSingle()
      : { data: null };

    const payload = {
      topic: record.topic,
      topic_other: record.topic_other,
      topics: record.topics,
      audience_gender: record.audience_gender,
      audience_styles: record.audience_styles,
      language: record.language,
      lesson_style: record.lesson_style,
      teacher_id: teacherId,
      teacher_name: record.teacher_name,
      organization: record.organization,
      venue_id: venueId,
      venue_name: record.venue_name,
      city: record.city,
      neighborhood: record.neighborhood,
      street: record.street,
      house_no: record.house_no,
      schedule_kind: record.schedule_kind,
      frequency: record.frequency,
      broadcast: record.broadcast,
      description: record.description,
      season_note: record.season_note,
      contact_name: record.contact_name,
      contact_phone: record.contact_phone,
      contact_email: record.contact_email,
      status,
      source: 'nedarim',
      source_ref: record.external_id,
    };

    let lessonId = existing?.id;
    if (lessonId) {
      const { error } = await db.from('igud_lessons').update(payload).eq('id', lessonId);
      if (error) throw new Error(`עדכון שיעור נכשל: ${error.message}`);
      await db.from('igud_occurrences').delete().eq('lesson_id', lessonId);
    } else {
      const { data, error } = await db.from('igud_lessons').insert(payload).select('id').single();
      if (error) throw new Error(`הוספת שיעור נכשלה: ${error.message}`);
      lessonId = data.id;
    }

    if (record.occurrences.length) {
      const { error } = await db.from('igud_occurrences').insert(
        record.occurrences.map((o) => ({ ...o, lesson_id: lessonId })),
      );
      if (error) throw new Error(`הוספת מועדים נכשלה: ${error.message}`);
    }

    status === 'published' ? (ok += 1) : (pending += 1);
  }

  return { ok, pending, skipped };
}

async function importRequests(db, records, { dry }) {
  if (dry) {
    records.forEach((r) => console.log(`  · ${r.contact_name || '—'} | ${r.city || '—'}`));
    return { ok: records.length, pending: 0, skipped: 0 };
  }
  let ok = 0;
  for (const record of records) {
    if (!record.contact_name && !record.phone) continue;
    const { error } = await db.from('igud_requests').insert({
      kind: record.kind,
      contact_name: record.contact_name,
      phone: record.phone,
      email: record.email,
      city: record.city,
      payload: record.payload,
      status: 'new',
      source: 'nedarim',
      source_ref: record.external_id,
    });
    if (error) throw new Error(`הוספת פנייה נכשלה: ${error.message}`);
    ok += 1;
  }
  return { ok, pending: 0, skipped: records.length - ok };
}

async function importSubscribers(db, records, { dry }) {
  if (dry) return { ok: records.length, pending: 0, skipped: 0 };
  let ok = 0;
  for (const record of records) {
    if (!record.phone && !record.email) continue;
    const { error } = await db.from('igud_subscribers').insert({
      full_name: record.full_name,
      phone: record.phone,
      email: record.email,
      wants: record.wants,
      partner: record.partner,
      filters: record.filters,
      source: 'nedarim',
    });
    if (error) throw new Error(`הוספת נרשם נכשלה: ${error.message}`);
    ok += 1;
  }
  return { ok, pending: 0, skipped: records.length - ok };
}

/* ------------------------- ריצה ------------------------- */

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const dry = args.includes('--dry');
  const files = args.filter((a) => !a.startsWith('--'));

  if (!files.length) {
    console.error('שימוש: node scripts/import-nedarim.mjs <קובץ.xlsx> [--publish] [--dry]');
    process.exit(1);
  }

  const db = dry ? null : await connect();

  for (const file of files) {
    const sheets = readXlsxFile(file);
    const rows = sheets[0].rows;
    const form = detectForm(rows);
    console.log(`\n=== ${file.split('/').pop()} · טופס ${form || 'לא זוהה'} · ${rows.length - 3} רשומות`);

    let result;
    if (form === '4320') {
      result = await importLessons(db, parse4320(rows), { publish, dry });
    } else if (form === '4063') {
      result = await importRequests(db, parse4063(rows), { dry });
    } else if (form === '4018') {
      result = await importRequests(db, parse4018(rows), { dry });
    } else if (form === '4357') {
      result = await importSubscribers(db, parse4357(rows), { dry });
    } else {
      console.log('  טופס לא מוכר, מדלג');
      continue;
    }

    console.log(`  פורסם: ${result.ok} · ממתין לאישור: ${result.pending} · דולג: ${result.skipped}`);
  }
}

main().catch((err) => {
  console.error('שגיאה:', err.message);
  process.exit(1);
});
