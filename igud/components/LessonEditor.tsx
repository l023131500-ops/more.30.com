'use client';

import { useMemo, useState } from 'react';
import type { Taxonomy } from '@/lib/types';
import { browserClient } from '@/lib/supabase';
import { DAY_SLOTS } from '@/lib/nedarim.js';
import {
  ChipMulti, ChipSingle, Section, SelectInput, TextArea, TextInput,
} from './form/Fields';
import LogoUpload from './form/LogoUpload';
import { IconCheck, IconChevronDown, IconClock, IconClose } from './Icons';

export interface EditableLesson {
  id: string;
  title: string | null;
  topic: string | null;
  topic_other: string | null;
  topics: string[] | null;
  lesson_character: string[] | null;
  speech_style: string[] | null;
  description: string | null;
  audience_gender: string | null;
  audience_styles: string[] | null;
  language: string | null;
  lesson_style: string | null;
  teacher_name: string | null;
  organization: string | null;
  venue_name: string | null;
  venue_type: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  house_no: string | null;
  location_exact: string | null;
  schedule_kind: string;
  frequency: string | null;
  season_note: string | null;
  broadcast: string;
  broadcast_url: string | null;
  recording_url: string | null;
  logo_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  occurrences?: {
    weekday: number | null;
    day_label: string | null;
    time_of_day: string | null;
    specific_date: string | null;
    time_slot: string | null;
  }[];
}

interface DayState { on: boolean; time: string; slot: string }

const BROADCAST_OPTIONS = ['ללא הקלטה', 'שיעור מוקלט', 'שידור חי', 'מוקלט ומשודר בשידור חי'];
const BROADCAST_CODE: Record<string, string> = {
  'ללא הקלטה': 'none', 'שיעור מוקלט': 'recorded',
  'שידור חי': 'live', 'מוקלט ומשודר בשידור חי': 'both',
};
const BROADCAST_NAME: Record<string, string> = {
  none: 'ללא הקלטה', recorded: 'שיעור מוקלט',
  live: 'שידור חי', both: 'מוקלט ומשודר בשידור חי',
};

export default function LessonEditor({
  lesson, taxonomy, isAdmin = false, onSaved, onClose,
}: {
  lesson: EditableLesson;
  taxonomy: Taxonomy;
  isAdmin?: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(lesson.title || '');
  const [topics, setTopics] = useState<string[]>(lesson.topics || []);
  const [topicOther, setTopicOther] = useState(lesson.topic_other || '');
  const [lessonCharacter, setLessonCharacter] = useState<string[]>(lesson.lesson_character || []);
  const [speechStyle, setSpeechStyle] = useState<string[]>(lesson.speech_style || []);
  const [description, setDescription] = useState(lesson.description || '');

  const [audienceGender, setAudienceGender] = useState(lesson.audience_gender || '');
  const [audienceStyles, setAudienceStyles] = useState<string[]>(lesson.audience_styles || []);
  const [language, setLanguage] = useState(lesson.language || 'עברית');
  const [lessonStyle, setLessonStyle] = useState(lesson.lesson_style || '');

  const [teacherName, setTeacherName] = useState(lesson.teacher_name || '');
  const [organization, setOrganization] = useState(lesson.organization || '');
  const [venueName, setVenueName] = useState(lesson.venue_name || '');
  const [venueType, setVenueType] = useState(lesson.venue_type || '');
  const [city, setCity] = useState(lesson.city || '');
  const [neighborhood, setNeighborhood] = useState(lesson.neighborhood || '');
  const [street, setStreet] = useState(lesson.street || '');
  const [houseNo, setHouseNo] = useState(lesson.house_no || '');
  const [locationExact, setLocationExact] = useState(lesson.location_exact || '');

  const [recurring, setRecurring] = useState(lesson.schedule_kind !== 'onetime');
  const [frequency, setFrequency] = useState(lesson.frequency || '');
  const [seasonNote, setSeasonNote] = useState(lesson.season_note || '');

  const initialDays = useMemo(() => {
    const base: Record<string, DayState> = Object.fromEntries(
      DAY_SLOTS.map((d: { label: string }) => [d.label, { on: false, time: '', slot: '' }]),
    );
    for (const occ of lesson.occurrences || []) {
      if (!occ.day_label || !base[occ.day_label]) continue;
      base[occ.day_label] = {
        on: true,
        time: (occ.time_of_day || '').slice(0, 5),
        slot: occ.time_slot || '',
      };
    }
    return base;
  }, [lesson.occurrences]);

  const [days, setDays] = useState<Record<string, DayState>>(initialDays);
  const oneTime = (lesson.occurrences || []).find((o) => o.specific_date);
  const [date, setDate] = useState(oneTime?.specific_date || '');
  const [time, setTime] = useState((oneTime?.time_of_day || '').slice(0, 5));

  const [broadcast, setBroadcast] = useState(BROADCAST_NAME[lesson.broadcast] || 'ללא הקלטה');
  const [broadcastUrl, setBroadcastUrl] = useState(lesson.broadcast_url || '');
  const [recordingUrl, setRecordingUrl] = useState(lesson.recording_url || '');
  const [logoUrl, setLogoUrl] = useState(lesson.logo_url || '');

  const [contactName, setContactName] = useState(lesson.contact_name || '');
  const [contactPhone, setContactPhone] = useState(lesson.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(lesson.contact_email || '');
  const [status, setStatus] = useState(lesson.status);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setDay = (label: string, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [label]: { ...prev[label], ...patch } }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const client = browserClient();

      const { error: updateError } = await client.from('igud_lessons').update({
        title: title.trim() || null,
        topic: topics[0] || null,
        topic_other: topicOther.trim() || null,
        topics,
        lesson_character: lessonCharacter,
        speech_style: speechStyle,
        description: description.trim() || null,
        audience_gender: audienceGender || null,
        audience_styles: audienceStyles,
        language: language || null,
        lesson_style: lessonStyle || null,
        teacher_name: teacherName.trim() || null,
        organization: organization.trim() || null,
        venue_name: venueName.trim() || null,
        venue_type: venueType || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        street: street.trim() || null,
        house_no: houseNo.trim() || null,
        location_exact: locationExact.trim() || null,
        schedule_kind: recurring ? 'recurring' : 'onetime',
        frequency: frequency || null,
        season_note: seasonNote.trim() || null,
        broadcast: BROADCAST_CODE[broadcast] || 'none',
        broadcast_url: broadcastUrl.trim() || null,
        recording_url: recordingUrl.trim() || null,
        logo_url: logoUrl || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        ...(isAdmin ? { status } : {}),
      }).eq('id', lesson.id);
      if (updateError) throw new Error(updateError.message);

      await client.from('igud_occurrences').delete().eq('lesson_id', lesson.id);

      const rows = recurring
        ? DAY_SLOTS
          .filter((slot: { label: string }) => days[slot.label].on)
          .map((slot: { label: string; weekday: number }, i: number) => ({
            lesson_id: lesson.id,
            weekday: slot.weekday,
            day_label: slot.label,
            time_of_day: days[slot.label].time || null,
            time_slot: days[slot.label].slot || null,
            sort: i,
          }))
        : date
          ? [{ lesson_id: lesson.id, specific_date: date, time_of_day: time || null, sort: 0 }]
          : [];

      if (rows.length) {
        const { error: occError } = await client.from('igud_occurrences').insert(rows);
        if (occError) throw new Error(occError.message);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-ink-900/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl
                        border-b border-parch-300 bg-parch-100 px-5 py-3">
          <h2 className="font-display text-lg font-bold text-royal-700">עריכת שיעור</h2>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-quiet !py-2 !text-[0.82rem]">
              <IconClose className="h-3.5 w-3.5" />
              סגירה
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn btn-primary !py-2 !text-[0.82rem]">
              <IconCheck className="h-3.5 w-3.5" />
              {busy ? 'שומר...' : 'שמירה'}
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-b-2xl bg-parch-100 p-4 sm:p-5">
          {error && (
            <p className="rounded-lg border border-royal-300 bg-royal-50 px-4 py-3 text-sm font-bold text-royal-700">
              {error}
            </p>
          )}

          {isAdmin && (
            <Section title="מצב הפרסום">
              <ChipSingle
                label="סטטוס"
                value={status}
                onChange={setStatus}
                options={['pending', 'published', 'rejected', 'archived']}
              />
              <p className="text-[0.75rem] text-ink-500">
                pending ממתין לאישור · published מפורסם · rejected נדחה · archived בארכיון
              </p>
            </Section>
          )}

          <Section title="נושא ותוכן">
            <TextInput label="כותרת השיעור" value={title} onChange={setTitle} />
            <ChipMulti
              label="נושאים"
              values={topics}
              onChange={setTopics}
              options={taxonomy.topics || []}
              otherValue={topicOther}
              onOtherChange={setTopicOther}
              columns
            />
            <ChipMulti
              label="אופי השיעור"
              values={lessonCharacter}
              onChange={setLessonCharacter}
              options={taxonomy.lessonCharacter || []}
            />
            <TextArea label="תיאור" value={description} onChange={setDescription} />
          </Section>

          <Section title="קהל ושפה">
            <ChipSingle
              label="למי מיועד השיעור"
              value={audienceGender}
              onChange={setAudienceGender}
              options={taxonomy.audienceGender || []}
            />
            <ChipMulti
              label="סגנון קהל היעד"
              values={audienceStyles}
              onChange={setAudienceStyles}
              options={taxonomy.audienceStyles || []}
              columns
            />
            <ChipSingle
              label="שפה"
              value={language}
              onChange={setLanguage}
              options={taxonomy.languages || []}
            />
            <ChipSingle
              label="סגנון השיעור"
              value={lessonStyle}
              onChange={setLessonStyle}
              options={taxonomy.lessonStyle || []}
            />
            <ChipMulti
              label="סגנון הדיבור"
              values={speechStyle}
              onChange={setSpeechStyle}
              options={taxonomy.speechStyle || []}
            />
          </Section>

          <Section title="מועדים">
            <div className="flex gap-2">
              <button
                type="button"
                data-on={recurring}
                onClick={() => setRecurring(true)}
                className="chip flex-1 justify-center !py-2.5"
              >
                שיעור קבוע
              </button>
              <button
                type="button"
                data-on={!recurring}
                onClick={() => setRecurring(false)}
                className="chip flex-1 justify-center !py-2.5"
              >
                תאריך מסוים
              </button>
            </div>

            {recurring ? (
              <div className="space-y-2">
                {DAY_SLOTS.map((slot: { label: string }) => {
                  const state = days[slot.label];
                  return (
                    <div
                      key={slot.label}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                        state.on ? 'border-gold-400 bg-gold-50' : 'border-parch-300 bg-white/60'
                      }`}
                    >
                      <button
                        type="button"
                        data-on={state.on}
                        onClick={() => setDay(slot.label, { on: !state.on })}
                        className="chip min-w-[7.5rem] justify-center"
                      >
                        {state.on && <IconCheck className="h-3.5 w-3.5" />}
                        {slot.label}
                      </button>
                      {state.on && (
                        <>
                          <label className="flex items-center gap-2">
                            <IconClock className="h-4 w-4 text-gold-600" />
                            <input
                              type="time"
                              dir="ltr"
                              value={state.time}
                              onChange={(e) => setDay(slot.label, { time: e.target.value })}
                              className="field !w-auto !py-1.5"
                            />
                          </label>
                          <div className="relative">
                            <select
                              value={state.slot}
                              onChange={(e) => setDay(slot.label, { slot: e.target.value })}
                              className="field !w-auto appearance-none !py-1.5 !pl-8 !text-[0.82rem]"
                            >
                              <option value="">חלק מהיום</option>
                              {(taxonomy.timeSlots || []).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <IconChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="תאריך" value={date} onChange={setDate} type="date" dir="ltr" />
                <TextInput label="שעה" value={time} onChange={setTime} type="time" dir="ltr" />
              </div>
            )}

            <SelectInput
              label="תדירות"
              value={frequency}
              onChange={setFrequency}
              options={taxonomy.frequency || []}
            />
            <TextArea label="הערות על מועדים" value={seasonNote} onChange={setSeasonNote} rows={2} />
          </Section>

          <Section title="מקום">
            <SelectInput
              label="סוג המקום"
              value={venueType}
              onChange={setVenueType}
              options={taxonomy.venueKinds || []}
            />
            <TextInput label="שם המקום" value={venueName} onChange={setVenueName} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="עיר" value={city} onChange={setCity} />
              <TextInput label="שכונה" value={neighborhood} onChange={setNeighborhood} />
              <TextInput label="רחוב" value={street} onChange={setStreet} />
              <TextInput label="מספר" value={houseNo} onChange={setHouseNo} />
            </div>
            <TextInput label="מיקום מדויק" value={locationExact} onChange={setLocationExact} />
          </Section>

          <Section title="שידור ולוגו">
            <ChipSingle
              label="באיזו צורה השיעור מועבר"
              value={broadcast}
              onChange={setBroadcast}
              options={BROADCAST_OPTIONS}
            />
            <TextInput label="קישור לשידור" value={broadcastUrl} onChange={setBroadcastUrl} dir="ltr" />
            <TextInput label="היכן ניתן לשמוע הקלטה" value={recordingUrl} onChange={setRecordingUrl} />
            <LogoUpload
              label="לוגו או תמונה"
              value={logoUrl}
              onChange={setLogoUrl}
              folder="lessons"
              authenticated
              hint="ללא לוגו יוצג סמל האיגוד."
            />
          </Section>

          <Section title="פרטי קשר">
            <TextInput label="שם מגיד השיעור" value={teacherName} onChange={setTeacherName} />
            <TextInput label="ארגון" value={organization} onChange={setOrganization} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="איש קשר" value={contactName} onChange={setContactName} />
              <TextInput label="טלפון" value={contactPhone} onChange={setContactPhone} dir="ltr" inputMode="tel" />
            </div>
            <TextInput label="דוא״ל" value={contactEmail} onChange={setContactEmail} dir="ltr" inputMode="email" />
          </Section>

          <div className="flex justify-end gap-2 pb-6">
            <button type="button" onClick={onClose} className="btn btn-quiet">ביטול</button>
            <button type="button" onClick={save} disabled={busy} className="btn btn-primary !px-8">
              <IconCheck className="h-4 w-4" />
              {busy ? 'שומר...' : 'שמירת השינויים'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
