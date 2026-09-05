/** טיפוסי הליבה של איגוד השיעורים. */

export type LessonStatus = 'pending' | 'published' | 'rejected' | 'archived';
export type ScheduleKind = 'recurring' | 'onetime';
export type BroadcastKind = 'none' | 'recorded' | 'live' | 'both';

export interface Occurrence {
  weekday: number | null;
  day: string | null;
  time: string | null;
  date: string | null;
  slot: string | null;
  note: string | null;
  next_at: string | null;
}

export interface LessonCard {
  id: string;
  public_no: number;
  title: string | null;
  topic: string | null;
  topic_other: string | null;
  topics: string[];
  lesson_character: string[];
  speech_style: string[];
  description: string | null;

  audience_gender: string | null;
  audience_styles: string[];
  language: string | null;
  language_other: string | null;
  lesson_style: string | null;
  lesson_style_other: string | null;

  teacher_id: string | null;
  teacher_name: string | null;
  organization: string | null;

  venue_id: string | null;
  venue_name: string | null;
  venue_type: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  house_no: string | null;
  location_exact: string | null;
  geo_lat: number | null;
  geo_lng: number | null;

  schedule_kind: ScheduleKind;
  frequency: string | null;
  season_note: string | null;

  broadcast: BroadcastKind;
  broadcast_url: string | null;
  recording_url: string | null;

  logo_url: string | null;
  image_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;

  featured: boolean;
  views: number;
  published_at: string | null;
  status: LessonStatus;

  next_at: string | null;
  schedule: Occurrence[];
}

export interface Teacher {
  id: string;
  slug: string | null;
  full_name: string;
  honorific: string | null;
  suffix: string | null;
  city: string | null;
  neighborhood: string | null;
  photo_url: string | null;
  logo_url: string | null;
  bio: string | null;
  background: string | null;
  occupation: string | null;
  organization: string | null;
  languages: string[];
  topics: string[];
  extra_skills: string[];
  speech_style: string[];
  status: string;
}

export interface Venue {
  id: string;
  slug: string | null;
  name: string;
  kind: string;
  nusach: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  house_no: string | null;
  location_exact: string | null;
  gabbai_name: string | null;
  phone: string | null;
  logo_url: string | null;
  photo_url: string | null;
  about: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  status: string;
}

export interface LessonFilters {
  q?: string;
  city?: string;
  topic?: string;
  gender?: string;
  language?: string;
  style?: string;
  audience?: string;
  day?: string;
  broadcast?: string;
  venue?: string;
  teacher?: string;
}

export type Taxonomy = Record<string, string[]>;
