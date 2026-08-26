-- ============================================================================
-- איגוד השיעורים — סכימת מסד הנתונים
-- ----------------------------------------------------------------------------
-- הסכימה יושבת ב-igud_shiurim ואינה חשופה ל-PostgREST. כל גישה מהדפדפן
-- עוברת דרך פונקציות public.shiurim_* (ראו 0003_public_api.sql), בדיוק
-- כפי שנעשה בשאר המערכות בפרויקט הזה (kesef, maatefet, nadlan_pro).
-- RLS מופעל על כל טבלה כהגנת עומק, גם כשאין מסלול ישיר מבחוץ.
-- ============================================================================

create schema if not exists igud_shiurim;

comment on schema igud_shiurim is
  'איגוד השיעורים — מאגר ארצי של שיעורי תורה, מגידי שיעור, מקומות ובקשות התאמה.';

-- ---------------------------------------------------------------------------
-- טיפוסים
-- ---------------------------------------------------------------------------

do $$ begin
  create type igud_shiurim.moderation_status as enum ('pending', 'approved', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type igud_shiurim.record_source as enum ('form', 'admin', 'import', 'api', 'voice_agent', 'web_agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type igud_shiurim.request_status as enum ('open', 'matched', 'fulfilled', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type igud_shiurim.match_status as enum ('suggested', 'sent', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type igud_shiurim.staff_role as enum ('viewer', 'editor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type igud_shiurim.link_subject as enum ('rabbi', 'venue', 'lesson', 'request');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- עזרי תשתית
-- ---------------------------------------------------------------------------

create or replace function igud_shiurim.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- מפתח סודי לקישורי הניהול האישיים (רב / מקום / מרכז תורה).
create or replace function igud_shiurim.new_token()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(24), 'hex');
$$;

-- ניקוי טלפון ישראלי לצורת השוואה אחידה: ספרות בלבד, 0 מוביל.
create or replace function igud_shiurim.normalize_phone(p_phone text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_phone is null then null
    when regexp_replace(p_phone, '\D', '', 'g') = '' then null
    when regexp_replace(p_phone, '\D', '', 'g') like '972%'
      then '0' || substring(regexp_replace(p_phone, '\D', '', 'g') from 4)
    else regexp_replace(p_phone, '\D', '', 'g')
  end;
$$;

-- ---------------------------------------------------------------------------
-- טקסונומיה — רשימות הבחירה של הטפסים, ניתנות לעריכה ממסך הניהול
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.taxonomy (
  id          uuid primary key default gen_random_uuid(),
  list_key    text not null,
  value       text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint taxonomy_unique_value unique (list_key, value)
);

comment on table igud_shiurim.taxonomy is
  'רשימות בחירה שחולצו מטפסי נדרים פלוס 4320 / 4063 / 4018 / 4357.';

create index if not exists taxonomy_list_idx
  on igud_shiurim.taxonomy (list_key, sort_order) where is_active;

-- ---------------------------------------------------------------------------
-- מגידי שיעור (טופס 4018 — רישום כמגיד שיעור)
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.rabbis (
  id                uuid primary key default gen_random_uuid(),

  full_name         text not null,
  title             text,                       -- הרב / הגאון / הרה"ג
  phone             text,
  phone_normalized  text generated always as (igud_shiurim.normalize_phone(phone)) stored,
  phone_alt         text,
  email             text,

  city              text,
  neighborhood      text,
  address           text,

  background        text,                       -- taxonomy: rabbiBackground
  marital_status    text,                       -- taxonomy: maritalStatus
  occupation        text,                       -- taxonomy: occupation
  birth_year        integer,

  topics            text[] not null default '{}',   -- taxonomy: topics
  languages         text[] not null default '{}',   -- taxonomy: languages
  audience_styles   text[] not null default '{}',   -- taxonomy: audienceStyle
  lesson_characters text[] not null default '{}',   -- taxonomy: lessonCharacter
  speech_styles     text[] not null default '{}',   -- taxonomy: speechStyle
  venue_types       text[] not null default '{}',   -- taxonomy: venueTypes
  extra_skills      text[] not null default '{}',   -- taxonomy: rabbiExtraSkills

  available_days    text[] not null default '{}',   -- taxonomy: days
  available_slots   text[] not null default '{}',   -- taxonomy: timeSlots

  travel_means      text[] not null default '{}',   -- taxonomy: travel
  travel_range      text,                           -- taxonomy: travelRange
  pay_expectation   text,                           -- taxonomy: rabbiPayExpectation

  bio               text,
  photo_url         text,
  recordings_url    text,
  years_experience  integer,

  status            igud_shiurim.moderation_status not null default 'pending',
  is_public         boolean not null default true,
  accepts_requests  boolean not null default true,
  source            igud_shiurim.record_source not null default 'form',

  manage_token      text not null default igud_shiurim.new_token(),
  auth_user_id      uuid references auth.users (id) on delete set null,

  notes_internal    text,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint rabbis_manage_token_unique unique (manage_token),
  constraint rabbis_birth_year_sane check (birth_year is null or birth_year between 1900 and 2100)
);

comment on table igud_shiurim.rabbis is 'מגידי שיעור — פרופיל ציבורי + העדפות התאמה.';
comment on column igud_shiurim.rabbis.manage_token is
  'הקישור הסודי שנשלח לרב כדי לערוך את הפרופיל והשיעורים שלו ללא סיסמה.';

create index if not exists rabbis_status_idx     on igud_shiurim.rabbis (status);
create index if not exists rabbis_city_idx       on igud_shiurim.rabbis (city);
create index if not exists rabbis_phone_idx      on igud_shiurim.rabbis (phone_normalized);
create index if not exists rabbis_auth_user_idx  on igud_shiurim.rabbis (auth_user_id);
create index if not exists rabbis_topics_idx     on igud_shiurim.rabbis using gin (topics);
create index if not exists rabbis_name_trgm_idx  on igud_shiurim.rabbis using gin (full_name public.gin_trgm_ops);

drop trigger if exists rabbis_touch on igud_shiurim.rabbis;
create trigger rabbis_touch before update on igud_shiurim.rabbis
  for each row execute function igud_shiurim.touch_updated_at();

-- ---------------------------------------------------------------------------
-- מקומות — בתי כנסת, בתי מדרש, כוללים ומרכזי תורה
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.venues (
  id                uuid primary key default gen_random_uuid(),

  name              text not null,
  venue_type        text,                        -- taxonomy: venueTypes
  nusach            text,                        -- taxonomy: synagogueNusach
  activity_level    text,                        -- taxonomy: synagogueActivity

  city              text,
  neighborhood      text,
  street            text,
  house_number      text,
  address_full      text,
  latitude          double precision,
  longitude         double precision,

  contact_name      text,
  contact_role      text,                        -- גבאי / רב בית הכנסת / מנהל
  contact_phone     text,
  contact_phone_normalized text generated always as (igud_shiurim.normalize_phone(contact_phone)) stored,
  contact_email     text,

  description       text,
  logo_url          text,
  photo_url         text,
  website_url       text,

  is_torah_center   boolean not null default false,
  center_blurb      text,
  center_rank       integer not null default 0,

  services_needed   text[] not null default '{}',  -- taxonomy: religiousServices
  community_style   text[] not null default '{}',  -- taxonomy: familyStyle

  status            igud_shiurim.moderation_status not null default 'pending',
  is_public         boolean not null default true,
  source            igud_shiurim.record_source not null default 'form',

  manage_token      text not null default igud_shiurim.new_token(),
  auth_user_id      uuid references auth.users (id) on delete set null,

  notes_internal    text,
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint venues_manage_token_unique unique (manage_token),
  constraint venues_latlon_pair check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  )
);

comment on table igud_shiurim.venues is
  'מקומות שבהם נמסרים שיעורים. is_torah_center מסמן מרכז תורה לקרוסלה בעמוד הבית.';

create index if not exists venues_status_idx    on igud_shiurim.venues (status);
create index if not exists venues_city_idx      on igud_shiurim.venues (city, neighborhood);
create index if not exists venues_center_idx    on igud_shiurim.venues (center_rank desc) where is_torah_center;
create index if not exists venues_auth_user_idx on igud_shiurim.venues (auth_user_id);
create index if not exists venues_name_trgm_idx on igud_shiurim.venues using gin (name public.gin_trgm_ops);

drop trigger if exists venues_touch on igud_shiurim.venues;
create trigger venues_touch before update on igud_shiurim.venues
  for each row execute function igud_shiurim.touch_updated_at();

-- ---------------------------------------------------------------------------
-- שיעורים (טופס 4320 — עדכון שיעור)
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.lessons (
  id                uuid primary key default gen_random_uuid(),

  title             text not null,
  subtitle          text,
  description       text,

  rabbi_id          uuid references igud_shiurim.rabbis (id) on delete set null,
  rabbi_name        text,                        -- שם חופשי כשאין רשומת רב
  venue_id          uuid references igud_shiurim.venues (id) on delete set null,
  venue_name        text,                        -- שם חופשי כשאין רשומת מקום

  topic             text,                        -- taxonomy: topics
  topic_free        text,                        -- כשנבחר "אחר"
  series_text       text,                        -- מסכת / ספר / פרק נוכחי

  audience_gender   text,                        -- taxonomy: audienceGender
  audience_styles   text[] not null default '{}',-- taxonomy: audienceStyle
  language          text,                        -- taxonomy: languages
  lesson_style      text,                        -- taxonomy: lessonStyle
  lesson_character  text,                        -- taxonomy: lessonCharacter
  speech_style      text,                        -- taxonomy: speechStyle

  frequency         text,                        -- taxonomy: frequency
  days              text[] not null default '{}',-- taxonomy: days
  time_slot         text,                        -- taxonomy: timeSlots
  start_time        time,
  end_time          time,
  duration_minutes  integer,
  specific_date     date,                        -- לשיעור חד־פעמי
  hebrew_date_text  text,                        -- "כל ליל שלישי אחרי מעריב"
  schedule_note     text,

  city              text,
  neighborhood      text,
  address           text,
  latitude          double precision,
  longitude         double precision,

  broadcast         text,                        -- taxonomy: broadcast
  recording_url     text,
  stream_url        text,
  phone_line        text,                        -- שלוחה בקו הטלפוני

  has_refreshments  boolean not null default false,
  is_free           boolean not null default true,
  entry_note        text,

  contact_name      text,
  contact_phone     text,
  contact_phone_normalized text generated always as (igud_shiurim.normalize_phone(contact_phone)) stored,
  contact_email     text,

  status            igud_shiurim.moderation_status not null default 'pending',
  is_active         boolean not null default true,
  source            igud_shiurim.record_source not null default 'form',

  manage_token      text not null default igud_shiurim.new_token(),
  views_count       integer not null default 0,
  verified_at       timestamptz,
  external_ref      text,                        -- מזהה במערכת המקור (נדרים פלוס וכד')

  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint lessons_manage_token_unique unique (manage_token),
  constraint lessons_has_a_giver check (rabbi_id is not null or nullif(btrim(coalesce(rabbi_name, '')), '') is not null),
  constraint lessons_has_a_place check (venue_id is not null or nullif(btrim(coalesce(venue_name, '')), '') is not null),
  constraint lessons_time_order check (end_time is null or start_time is null or end_time > start_time),
  constraint lessons_duration_sane check (duration_minutes is null or duration_minutes between 1 and 600)
);

comment on table igud_shiurim.lessons is 'שיעור בודד — קבוע לפי ימים בשבוע או חד־פעמי לפי תאריך.';
comment on column igud_shiurim.lessons.days is
  'ימי השבוע שבהם נמסר השיעור, בשמות מהטקסונומיה ("יום ראשון", "ליל שבת"...).';

create index if not exists lessons_status_idx    on igud_shiurim.lessons (status, is_active);
create index if not exists lessons_rabbi_idx     on igud_shiurim.lessons (rabbi_id);
create index if not exists lessons_venue_idx     on igud_shiurim.lessons (venue_id);
create index if not exists lessons_city_idx      on igud_shiurim.lessons (city, neighborhood);
create index if not exists lessons_topic_idx     on igud_shiurim.lessons (topic);
create index if not exists lessons_days_idx      on igud_shiurim.lessons using gin (days);
create index if not exists lessons_audience_idx  on igud_shiurim.lessons using gin (audience_styles);
create index if not exists lessons_date_idx      on igud_shiurim.lessons (specific_date) where specific_date is not null;
create index if not exists lessons_title_trgm_idx on igud_shiurim.lessons using gin (title public.gin_trgm_ops);

-- ייבוא חוזר מאותו מקור לא יכפיל שורות. שיעורים שהוזנו ידנית אין להם
-- external_ref, ולכן האינדקס חלקי ולא חוסם אותם.
create unique index if not exists lessons_external_ref_unique
  on igud_shiurim.lessons (source, external_ref) where external_ref is not null;

drop trigger if exists lessons_touch on igud_shiurim.lessons;
create trigger lessons_touch before update on igud_shiurim.lessons
  for each row execute function igud_shiurim.touch_updated_at();

-- שדה חיפוש מאוחד: כותרת, רב, מקום, נושא, עיר. 'simple' כי אין קונפיגורציית
-- עברית ב-Postgres; החיפוש הלא־מדויק נשען על pg_trgm במקביל.
alter table igud_shiurim.lessons
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '')        || ' ' ||
      coalesce(subtitle, '')     || ' ' ||
      coalesce(rabbi_name, '')   || ' ' ||
      coalesce(venue_name, '')   || ' ' ||
      coalesce(topic, '')        || ' ' ||
      coalesce(topic_free, '')   || ' ' ||
      coalesce(series_text, '')  || ' ' ||
      coalesce(city, '')         || ' ' ||
      coalesce(neighborhood, '') || ' ' ||
      coalesce(address, '')
    )
  ) stored;

create index if not exists lessons_search_idx on igud_shiurim.lessons using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- בקשת מגיד שיעור (טופס 4063) — מקום שמחפש רב
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.rabbi_requests (
  id                uuid primary key default gen_random_uuid(),

  requester_type    text,                        -- taxonomy: requesterType
  requester_name    text not null,
  contact_phone     text,
  contact_phone_normalized text generated always as (igud_shiurim.normalize_phone(contact_phone)) stored,
  contact_email     text,

  venue_id          uuid references igud_shiurim.venues (id) on delete set null,
  venue_name        text,
  venue_type        text,                        -- taxonomy: venueTypes
  nusach            text,                        -- taxonomy: synagogueNusach
  activity_level    text,                        -- taxonomy: synagogueActivity

  city              text,
  neighborhood      text,
  address           text,

  topics            text[] not null default '{}',
  languages         text[] not null default '{}',
  audience_gender   text,
  audience_styles   text[] not null default '{}',
  lesson_styles     text[] not null default '{}',
  lesson_characters text[] not null default '{}',
  speech_styles     text[] not null default '{}',
  rabbi_backgrounds text[] not null default '{}',
  services_needed   text[] not null default '{}',

  days              text[] not null default '{}',
  time_slots        text[] not null default '{}',
  frequency         text,
  starts_on         date,
  expected_attendance integer,

  payer_offer       text,                        -- taxonomy: payerOffer
  budget_note       text,
  notes             text,

  status            igud_shiurim.request_status not null default 'open',
  moderation        igud_shiurim.moderation_status not null default 'pending',
  source            igud_shiurim.record_source not null default 'form',
  manage_token      text not null default igud_shiurim.new_token(),

  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz,

  constraint rabbi_requests_manage_token_unique unique (manage_token)
);

comment on table igud_shiurim.rabbi_requests is
  'בקשה של בית כנסת / ארגון / יחיד למגיד שיעור. מוזנת לטבלת ההתאמות.';

create index if not exists rabbi_requests_status_idx on igud_shiurim.rabbi_requests (status, moderation);
create index if not exists rabbi_requests_city_idx   on igud_shiurim.rabbi_requests (city, neighborhood);
create index if not exists rabbi_requests_venue_idx  on igud_shiurim.rabbi_requests (venue_id);
create index if not exists rabbi_requests_topics_idx on igud_shiurim.rabbi_requests using gin (topics);

drop trigger if exists rabbi_requests_touch on igud_shiurim.rabbi_requests;
create trigger rabbi_requests_touch before update on igud_shiurim.rabbi_requests
  for each row execute function igud_shiurim.touch_updated_at();

-- ---------------------------------------------------------------------------
-- התאמות בין בקשה למגיד שיעור
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.matches (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references igud_shiurim.rabbi_requests (id) on delete cascade,
  rabbi_id       uuid not null references igud_shiurim.rabbis (id) on delete cascade,

  score          numeric(6,2) not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  status         igud_shiurim.match_status not null default 'suggested',

  sent_at        timestamptz,
  responded_at   timestamptz,
  response_note  text,
  lesson_id      uuid references igud_shiurim.lessons (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint matches_unique_pair unique (request_id, rabbi_id)
);

comment on table igud_shiurim.matches is
  'הצעת שידוך בין בקשה למגיד שיעור, עם הניקוד שהוביל אליה.';

create index if not exists matches_request_idx on igud_shiurim.matches (request_id, score desc);
create index if not exists matches_rabbi_idx   on igud_shiurim.matches (rabbi_id, status);
create index if not exists matches_lesson_idx  on igud_shiurim.matches (lesson_id);

drop trigger if exists matches_touch on igud_shiurim.matches;
create trigger matches_touch before update on igud_shiurim.matches
  for each row execute function igud_shiurim.touch_updated_at();

-- ---------------------------------------------------------------------------
-- דיווחי תיקון מהציבור ("השיעור בוטל", "השעה השתנתה")
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.lesson_reports (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references igud_shiurim.lessons (id) on delete cascade,
  kind         text not null,                   -- cancelled / time_changed / wrong_details / other
  body         text,
  reporter_name  text,
  reporter_phone text,
  handled_at   timestamptz,
  handled_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists lesson_reports_open_idx
  on igud_shiurim.lesson_reports (lesson_id) where handled_at is null;
create index if not exists lesson_reports_handled_by_idx
  on igud_shiurim.lesson_reports (handled_by);

-- ---------------------------------------------------------------------------
-- הרשאות: צוות הניהול וקישורים סודיים
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  email       text not null,
  role        igud_shiurim.staff_role not null default 'viewer',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint staff_email_unique unique (email)
);

comment on table igud_shiurim.staff is
  'צוות איגוד השיעורים. מנהל־העל של more.30.com מזוהה בנפרד ואינו חייב שורה כאן.';

create index if not exists staff_user_idx on igud_shiurim.staff (user_id) where is_active;

create table if not exists igud_shiurim.access_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null default igud_shiurim.new_token(),
  subject_type  igud_shiurim.link_subject not null,
  subject_id    uuid not null,
  label         text,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  use_count     integer not null default 0,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint access_links_token_unique unique (token)
);

comment on table igud_shiurim.access_links is
  'קישורים סודיים נוספים מעבר ל-manage_token הקבוע — למשל קישור זמני לגבאי.';

create index if not exists access_links_subject_idx on igud_shiurim.access_links (subject_type, subject_id);
create index if not exists access_links_creator_idx on igud_shiurim.access_links (created_by);

-- ---------------------------------------------------------------------------
-- יומן ביקורת
-- ---------------------------------------------------------------------------

create table if not exists igud_shiurim.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_kind  text not null,                    -- staff / token / anon / service / agent
  actor_id    text,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_entity_idx on igud_shiurim.audit_log (entity, entity_id, at desc);
create index if not exists audit_log_at_idx     on igud_shiurim.audit_log (at desc);

-- ---------------------------------------------------------------------------
-- RLS — הסכימה סגורה; anon/authenticated אינם מגיעים לטבלאות ישירות
-- ---------------------------------------------------------------------------

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'igud_shiurim'
  loop
    execute format('alter table igud_shiurim.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke all on schema igud_shiurim from public, anon, authenticated;
grant usage on schema igud_shiurim to service_role;
grant all on all tables in schema igud_shiurim to service_role;
grant all on all sequences in schema igud_shiurim to service_role;
alter default privileges in schema igud_shiurim grant all on tables to service_role;
alter default privileges in schema igud_shiurim grant all on sequences to service_role;
