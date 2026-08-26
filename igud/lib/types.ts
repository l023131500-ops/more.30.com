/** הטיפוסים שמוחזרים מפונקציות public.shiurim_* — ראו igud/db/0003_public_api.sql. */

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'archived';

/** שמות הימים כפי שהם בטקסונומיה. הסדר הוא סדר השבוע. */
export const DAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'ליל שבת',
  'שבת',
  'מוצאי שבת',
] as const;

export type DayName = (typeof DAYS)[number];

export interface LessonCard {
  id: string;
  title: string;
  subtitle: string | null;
  rabbi_id: string | null;
  rabbi_name: string | null;
  venue_id: string | null;
  venue_name: string | null;
  topic: string | null;
  series_text: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  days: string[];
  time_slot: string | null;
  start_time: string | null;
  end_time: string | null;
  specific_date: string | null;
  hebrew_date_text: string | null;
  audience_gender: string | null;
  audience_styles: string[];
  language: string | null;
  broadcast: string | null;
  has_refreshments: boolean;
}

export interface LessonFull extends LessonCard {
  description: string | null;
  topic_free: string | null;
  lesson_style: string | null;
  lesson_character: string | null;
  speech_style: string | null;
  frequency: string | null;
  duration_minutes: number | null;
  schedule_note: string | null;
  latitude: number | null;
  longitude: number | null;
  recording_url: string | null;
  stream_url: string | null;
  phone_line: string | null;
  is_free: boolean;
  entry_note: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  verified_at: string | null;
  updated_at: string;
}

export interface RabbiCard {
  id: string;
  full_name: string;
  title: string | null;
  city: string | null;
  neighborhood: string | null;
  topics: string[];
  languages: string[];
  photo_url: string | null;
  lessons_count: number;
}

export interface VenueCard {
  id: string;
  name: string;
  venue_type: string | null;
  nusach: string | null;
  city: string | null;
  neighborhood: string | null;
  address_full: string | null;
  logo_url: string | null;
  is_torah_center: boolean;
  center_blurb: string | null;
  lessons_count: number;
}

/** רשימות הבחירה, מקובצות לפי מפתח: taxonomy.topics, taxonomy.days וכו'. */
export type Taxonomy = Record<string, string[]>;
