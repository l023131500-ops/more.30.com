/**
 * ממיר ייצוא טפסים של נדרים פלוס להצהרות SQL קומפקטיות.
 * שימושי כשאין גישת רשת ישירה למסד (למשל ריצה מאחורי פרוקסי),
 * ואז מריצים את הפלט דרך מסוף ה-SQL של Supabase.
 *
 *   node scripts/to-sql.mjs <קובץ.xlsx> [--publish] > seed.sql
 */

import { readXlsxFile } from './xlsx-node.mjs';
import { detectForm, parse4320, parse4063, parse4018, parse4357 } from '../lib/nedarim.js';

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (list) => (!list || !list.length ? `'{}'` : `array[${list.map(q).join(',')}]`);

/** משאיר בעומס רק שדות שמולאו בפועל. */
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

function lessonsSql(records, publish, onlyGood) {
  const rows = records.filter((r) => (r.teacher_name || r.venue_name) && (!onlyGood || r.publishable));
  if (!rows.length) return '';
  const out = [];

  out.push('-- ===== מגידי שיעור =====');
  const teachers = new Map();
  for (const r of rows) {
    if (!r.teacher_name || teachers.has(r.teacher_name)) continue;
    teachers.set(r.teacher_name, r);
  }
  out.push('insert into public.igud_teachers (full_name, city, phone, email, organization, status) values');
  out.push([...teachers.values()]
    .map((r) => `(${q(r.teacher_name)},${q(r.city)},${q(r.contact_phone)},${q(r.contact_email)},${q(r.organization)},${q(publish && r.publishable ? 'published' : 'pending')})`)
    .join(',\n'));
  out.push('on conflict (full_name) do nothing;\n');

  out.push('-- ===== מרכזי תורה ובתי כנסת =====');
  const venues = new Map();
  for (const r of rows) {
    if (!r.venue_name) continue;
    const key = `${r.venue_name}|${r.city || ''}`;
    if (!venues.has(key)) venues.set(key, r);
  }
  out.push('insert into public.igud_venues (name, kind, city, neighborhood, street, house_no, status) values');
  out.push([...venues.values()]
    .map((r) => `(${q(r.venue_name)},'בית כנסת',${q(r.city)},${q(r.neighborhood)},${q(r.street)},${q(r.house_no)},${q(publish && r.publishable ? 'published' : 'pending')})`)
    .join(',\n'));
  out.push('on conflict (name, city_key) do nothing;\n');

  out.push('-- ===== שיעורים =====');
  out.push(`insert into public.igud_lessons (
  topic, topic_other, topics, audience_gender, audience_styles, language, lesson_style,
  teacher_id, teacher_name, organization, venue_id, venue_name,
  city, neighborhood, street, house_no, schedule_kind, frequency, broadcast,
  description, season_note, contact_name, contact_phone, contact_email,
  status, source, source_ref)
select
  v.topic, v.topic_other, v.topics, v.audience_gender, v.audience_styles, v.language, v.lesson_style,
  t.id, v.teacher_name, v.organization, n.id, v.venue_name,
  v.city, v.neighborhood, v.street, v.house_no, v.schedule_kind, v.frequency, v.broadcast,
  v.description, v.season_note, v.contact_name, v.contact_phone, v.contact_email,
  v.status, 'nedarim', v.source_ref
from (values`);
  out.push(rows.map((r) => `(${[
    q(r.topic), q(r.topic_other), arr(r.topics), q(r.audience_gender), arr(r.audience_styles),
    q(r.language), q(r.lesson_style), q(r.teacher_name), q(r.organization), q(r.venue_name),
    q(r.city), q(r.neighborhood), q(r.street), q(r.house_no), q(r.schedule_kind), q(r.frequency),
    q(r.broadcast), q(r.description), q(r.season_note), q(r.contact_name), q(r.contact_phone),
    q(r.contact_email), q(publish && r.publishable ? 'published' : 'pending'), q(r.external_id),
  ].join(',')})`).join(',\n'));
  out.push(`) as v(topic, topic_other, topics, audience_gender, audience_styles, language, lesson_style,
  teacher_name, organization, venue_name, city, neighborhood, street, house_no,
  schedule_kind, frequency, broadcast, description, season_note,
  contact_name, contact_phone, contact_email, status, source_ref)
left join public.igud_teachers t on t.full_name = v.teacher_name
left join public.igud_venues   n on n.name = v.venue_name and n.city is not distinct from v.city
where not exists (
  select 1 from public.igud_lessons l where l.source = 'nedarim' and l.source_ref = v.source_ref
);\n`);

  const occ = [];
  for (const r of rows) {
    for (const o of r.occurrences) {
      occ.push(`(${q(r.external_id)},${o.weekday === null ? 'null::int' : o.weekday},${q(o.day_label)},${o.time_of_day ? `'${o.time_of_day}'::time` : 'null::time'},${o.specific_date ? `'${o.specific_date}'::date` : 'null::date'},${q(o.note)},${o.sort})`);
    }
  }
  if (occ.length) {
    out.push('-- ===== מועדי השיעורים =====');
    out.push(`insert into public.igud_occurrences (lesson_id, weekday, day_label, time_of_day, specific_date, note, sort)
select l.id, v.weekday, v.day_label, v.time_of_day, v.specific_date, v.note, v.sort
from (values`);
    out.push(occ.join(',\n'));
    out.push(`) as v(source_ref, weekday, day_label, time_of_day, specific_date, note, sort)
join public.igud_lessons l on l.source = 'nedarim' and l.source_ref = v.source_ref
where not exists (
  select 1 from public.igud_occurrences o where o.lesson_id = l.id
);\n`);
  }

  return out.join('\n');
}

function requestsSql(records) {
  const rows = records
    .filter((r) => r.contact_name || r.phone)
    .map((r) => `(${q(r.kind)},${q(r.contact_name)},${q(r.phone)},${q(r.email)},${q(r.city)},${q(JSON.stringify(compact(r.payload)))}::jsonb,'new','nedarim',${q(r.external_id)})`);
  if (!rows.length) return '';
  return `insert into public.igud_requests (kind, contact_name, phone, email, city, payload, status, source, source_ref)
select * from (values\n${rows.join(',\n')}
) as v(kind, contact_name, phone, email, city, payload, status, source, source_ref)
where not exists (
  select 1 from public.igud_requests r where r.source = 'nedarim' and r.source_ref = v.source_ref
);`;
}

function subscribersSql(records) {
  const rows = records
    .filter((r) => r.phone || r.email)
    .map((r) => `(${q(r.full_name)},${q(r.phone)},${q(r.email)},${arr(r.wants)},${r.partner},${q(JSON.stringify(compact(r.filters)))}::jsonb,'nedarim')`);
  if (!rows.length) return '';
  return `insert into public.igud_subscribers (full_name, phone, email, wants, partner, filters, source) values\n${rows.join(',\n')};`;
}

const args = process.argv.slice(2);
const publish = args.includes('--publish');
const onlyGood = args.includes('--only-good');

for (const file of args.filter((a) => !a.startsWith('--'))) {
  const rows = readXlsxFile(file)[0].rows;
  const form = detectForm(rows);
  if (form === '4320') console.log(lessonsSql(parse4320(rows), publish, onlyGood));
  else if (form === '4063') console.log(requestsSql(parse4063(rows)));
  else if (form === '4018') console.log(requestsSql(parse4018(rows)));
  else if (form === '4357') console.log(subscribersSql(parse4357(rows)));
  console.log('');
}
