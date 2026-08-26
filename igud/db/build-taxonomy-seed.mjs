// מייצר את igud/db/0002_taxonomy_seed.sql מתוך igud/data/taxonomy.json.
// כשמעדכנים את הטקסונומיה מריצים:  node igud/db/build-taxonomy-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const taxonomy = JSON.parse(readFileSync(join(here, '..', 'data', 'taxonomy.json'), 'utf8'));

const lists = Object.fromEntries(
  Object.entries(taxonomy).filter(([key, value]) => !key.startsWith('_') && Array.isArray(value)),
);

const total = Object.values(lists).reduce((n, values) => n + values.length, 0);

// dollar-quoting במקום בריחת גרשיים — הערכים מכילים גרשיים עבריים (חרד"לים).
const payload = JSON.stringify(lists, null, 2);
if (payload.includes('$taxonomy$')) throw new Error('הטקסונומיה מכילה את מפריד ה-dollar quoting');

const sql = `-- ============================================================================
-- איגוד השיעורים — זריעת הטקסונומיה
-- ----------------------------------------------------------------------------
-- נוצר אוטומטית מ-igud/data/taxonomy.json ע"י igud/db/build-taxonomy-seed.mjs.
-- אין לערוך ידנית: עדכנו את קובץ ה-JSON והריצו את הסקריפט מחדש.
-- ${Object.keys(lists).length} רשימות, ${total} ערכים.
-- ============================================================================

create or replace function igud_shiurim.seed_taxonomy(p_lists jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_count integer;
begin
  insert into igud_shiurim.taxonomy (list_key, value, sort_order)
  select list_key, value, (ord - 1)::integer
  from jsonb_each(p_lists) as l(list_key, values_json)
  cross join lateral jsonb_array_elements_text(l.values_json) with ordinality as v(value, ord)
  on conflict (list_key, value) do update
    set sort_order = excluded.sort_order,
        is_active  = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function igud_shiurim.seed_taxonomy(jsonb) from public, anon, authenticated;

select igud_shiurim.seed_taxonomy($taxonomy$${payload}$taxonomy$::jsonb);
`;

writeFileSync(join(here, '0002_taxonomy_seed.sql'), sql);
console.log(`נכתב 0002_taxonomy_seed.sql — ${Object.keys(lists).length} רשימות, ${total} ערכים.`);
