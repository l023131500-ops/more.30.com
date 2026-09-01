'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/types';
import { publicClient } from '@/lib/supabase';
import { DAY_SLOTS } from '@/lib/nedarim.js';
import {
  ChipMulti, ChipSingle, Section, SelectInput, TextArea, TextInput, Toggle,
} from './form/Fields';
import LogoUpload from './form/LogoUpload';
import {
  IconArrowLeft, IconCheck, IconChevronDown, IconClock, IconPlus,
} from './Icons';

interface DayState { on: boolean; time: string; slot: string }

const emptyDays = (): Record<string, DayState> =>
  Object.fromEntries(DAY_SLOTS.map((d: { label: string }) => [d.label, { on: false, time: '', slot: '' }]));

const STEPS = [
  { id: 'topic', title: 'נושא השיעור' },
  { id: 'audience', title: 'קהל ושפה' },
  { id: 'when', title: 'מתי' },
  { id: 'where', title: 'איפה' },
  { id: 'media', title: 'שידור ולוגו' },
  { id: 'contact', title: 'פרטי קשר' },
];

const BROADCAST_OPTIONS = ['ללא הקלטה', 'שיעור מוקלט', 'שידור חי', 'מוקלט ומשודר בשידור חי'];
const BROADCAST_CODE: Record<string, string> = {
  'ללא הקלטה': 'none',
  'שיעור מוקלט': 'recorded',
  'שידור חי': 'live',
  'מוקלט ומשודר בשידור חי': 'both',
};

export default function AddLessonForm({ taxonomy }: { taxonomy: Taxonomy }) {
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicOther, setTopicOther] = useState('');
  const [lessonCharacter, setLessonCharacter] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const [audienceGender, setAudienceGender] = useState('');
  const [audienceStyles, setAudienceStyles] = useState<string[]>([]);
  const [language, setLanguage] = useState('עברית');
  const [languageOther, setLanguageOther] = useState('');
  const [lessonStyle, setLessonStyle] = useState('');
  const [lessonStyleOther, setLessonStyleOther] = useState('');
  const [speechStyle, setSpeechStyle] = useState<string[]>([]);

  const [recurring, setRecurring] = useState(true);
  const [days, setDays] = useState<Record<string, DayState>>(emptyDays);
  const [sameTime, setSameTime] = useState(true);
  const [uniformTime, setUniformTime] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [frequency, setFrequency] = useState('');
  const [seasonNote, setSeasonNote] = useState('');

  const [venueType, setVenueType] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [locationExact, setLocationExact] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [broadcast, setBroadcast] = useState('ללא הקלטה');
  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');

  const [teacherName, setTeacherName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [organization, setOrganization] = useState('');

  const chosenDays = useMemo(
    () => DAY_SLOTS.filter((d: { label: string }) => days[d.label]?.on),
    [days],
  );

  const setDay = (label: string, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [label]: { ...prev[label], ...patch } }));

  /* ---------------- אימות לפי שלב ---------------- */

  const stepError = (index: number): string => {
    if (index === 0 && !topics.length && !topicOther.trim() && !title.trim()) {
      return 'נא לבחור נושא אחד לפחות, או לכתוב כותרת לשיעור';
    }
    if (index === 1 && !audienceGender) return 'נא לציין למי מיועד השיעור';
    if (index === 2) {
      if (recurring) {
        if (!chosenDays.length) return 'נא לסמן לפחות יום אחד';
        const missing = chosenDays.some(
          (d: { label: string }) => !(sameTime ? uniformTime : days[d.label].time) && !days[d.label].slot,
        );
        if (missing) return 'נא למלא שעה לכל יום שסומן, או לבחור חלק מהיום';
      } else {
        if (!date) return 'נא לבחור תאריך';
        if (!time) return 'נא לבחור שעה';
      }
    }
    if (index === 3 && !city.trim()) return 'נא למלא את שם העיר';
    if (index === 5) {
      if (teacherName.trim().length < 2) return 'נא למלא את שם מגיד השיעור';
      if (contactPhone.replace(/\D/g, '').length < 9) return 'נא למלא מספר טלפון תקין';
    }
    return '';
  };

  const goNext = () => {
    const message = stepError(step);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------------- שליחה ---------------- */

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const message = stepError(i);
      if (message) {
        setStep(i);
        setError(message);
        return;
      }
    }

    setSending(true);
    setError('');

    const occurrences = recurring
      ? chosenDays.map((slot: { label: string; weekday: number }, i: number) => ({
        weekday: slot.weekday,
        day_label: slot.label,
        time_of_day: (sameTime ? uniformTime : days[slot.label].time) || null,
        time_slot: days[slot.label].slot || null,
        sort: i,
      }))
      : [{ specific_date: date, time_of_day: time, sort: 0 }];

    const payload = {
      title: title.trim(),
      topic: topics[0] || null,
      topic_other: topicOther.trim() || null,
      topics: topics.filter((t) => t !== 'אחר'),
      lesson_character: lessonCharacter,
      speech_style: speechStyle,
      description: description.trim(),
      audience_gender: audienceGender,
      audience_styles: audienceStyles,
      language,
      language_other: languageOther.trim(),
      lesson_style: lessonStyle,
      lesson_style_other: lessonStyleOther.trim(),
      teacher_name: teacherName.trim(),
      organization: organization.trim(),
      venue_name: venueName.trim(),
      venue_type: venueType,
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      street: street.trim(),
      house_no: houseNo.trim(),
      location_exact: locationExact.trim(),
      schedule_kind: recurring ? 'recurring' : 'onetime',
      frequency: frequency || (recurring ? 'שיעור קבוע' : 'שיעור בתאריך מסוים'),
      season_note: seasonNote.trim(),
      broadcast: BROADCAST_CODE[broadcast] || 'none',
      broadcast_url: broadcastUrl.trim(),
      recording_url: recordingUrl.trim(),
      logo_url: logoUrl,
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      occurrences,
      source: 'web',
    };

    try {
      const { data, error: rpcError } = await publicClient().rpc('igud_submit_lesson', { payload });
      if (rpcError) throw new Error(rpcError.message);
      setDoneId((data as { id: string })?.id || 'ok');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שליחת הטופס נכשלה');
    } finally {
      setSending(false);
    }
  };

  /* ---------------- מסך אישור ---------------- */

  if (doneId) {
    return (
      <div className="card-surface mx-auto max-w-xl rounded-2xl p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-100 text-gold-700">
          <IconCheck className="h-8 w-8" strokeWidth={2} />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-royal-700">השיעור נקלט</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          תודה. השיעור נשלח לאישור צוות האיגוד, ויתפרסם במאגר לאחר בדיקה.
          אם יידרשו הבהרות, ניצור קשר בטלפון שמסרתם.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">חזרה למאגר</Link>
          <button
            type="button"
            onClick={() => { setDoneId(null); setStep(0); }}
            className="btn btn-quiet"
          >
            <IconPlus className="h-4 w-4" />
            הוספת שיעור נוסף
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- שלבי הטופס ---------------- */

  return (
    <div>
      {/* מד התקדמות */}
      <ol className="mb-7 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1 min-w-[5.5rem]">
            <button
              type="button"
              onClick={() => { if (i <= step) { setStep(i); setError(''); } }}
              disabled={i > step}
              className="w-full text-right"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors ${
                  i < step ? 'bg-gold-500' : i === step ? 'bg-royal-600' : 'bg-parch-300'
                }`}
              />
              <span
                className={`mt-1.5 block text-[0.7rem] font-bold ${
                  i === step ? 'text-royal-700' : 'text-ink-500'
                }`}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section
          title="נושא השיעור"
          description="אפשר לסמן כמה נושאים. אם הנושא אינו ברשימה, בוחרים אחר וכותבים אותו."
        >
          <ChipMulti
            label="נושאים"
            values={topics}
            onChange={setTopics}
            options={taxonomy.topics || []}
            otherValue={topicOther}
            onOtherChange={setTopicOther}
            columns
          />
          <TextInput
            label="כותרת השיעור"
            value={title}
            onChange={setTitle}
            placeholder="לדוגמה: דף היומי במסכת בבא מציעא"
            hint="לא חובה. אם לא תמלאו, תוצג הכותרת לפי הנושא."
          />
          <ChipMulti
            label="אופי השיעור"
            values={lessonCharacter}
            onChange={setLessonCharacter}
            options={taxonomy.lessonCharacter || []}
          />
          <TextArea
            label="תיאור קצר"
            value={description}
            onChange={setDescription}
            placeholder="במה עוסק השיעור, למי הוא מתאים, ומה כדאי לדעת לפני שמגיעים"
            rows={3}
          />
        </Section>
      )}

      {step === 1 && (
        <Section title="קהל היעד והשפה" description="הפרטים האלה עוזרים ללומדים למצוא שיעור שמתאים להם.">
          <ChipSingle
            label="למי מיועד השיעור"
            value={audienceGender}
            onChange={setAudienceGender}
            options={taxonomy.audienceGender || []}
            required
          />
          <ChipMulti
            label="סגנון קהל היעד"
            values={audienceStyles}
            onChange={setAudienceStyles}
            options={taxonomy.audienceStyles || []}
            columns
          />
          <ChipSingle
            label="באיזו שפה נמסר השיעור"
            value={language}
            onChange={setLanguage}
            options={taxonomy.languages || []}
            otherValue={languageOther}
            onOtherChange={setLanguageOther}
          />
          <ChipSingle
            label="סגנון השיעור"
            value={lessonStyle}
            onChange={setLessonStyle}
            options={taxonomy.lessonStyle || []}
            otherValue={lessonStyleOther}
            onOtherChange={setLessonStyleOther}
          />
          <ChipMulti
            label="סגנון הדיבור"
            values={speechStyle}
            onChange={setSpeechStyle}
            options={taxonomy.speechStyle || []}
          />
        </Section>
      )}

      {step === 2 && (
        <Section
          title="מועדי השיעור"
          description="שיעור קבוע נמסר באותם ימים בכל שבוע. שיעור בתאריך מסוים הוא מועד יחיד."
        >
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
              שיעור בתאריך מסוים
            </button>
          </div>

          {recurring ? (
            <>
              <Toggle
                label="אותה שעה בכל הימים"
                checked={sameTime}
                onChange={setSameTime}
                hint="כיבוי המתג מאפשר שעה נפרדת לכל יום"
              />

              {sameTime && (
                <div className="max-w-[12rem]">
                  <TextInput
                    label="שעת השיעור"
                    value={uniformTime}
                    onChange={setUniformTime}
                    type="time"
                    dir="ltr"
                  />
                </div>
              )}

              <div>
                <div className="field-label">ימי השיעור<span className="mr-1 text-royal-500">*</span></div>
                <div className="space-y-2">
                  {DAY_SLOTS.map((slot: { label: string }) => {
                    const state = days[slot.label];
                    return (
                      <div
                        key={slot.label}
                        className={`rounded-xl border p-3 transition-colors ${
                          state.on ? 'border-gold-400 bg-gold-50' : 'border-parch-300 bg-white/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            data-on={state.on}
                            onClick={() => setDay(slot.label, { on: !state.on })}
                            className="chip min-w-[7.5rem] justify-center"
                          >
                            {state.on && <IconCheck className="h-3.5 w-3.5" />}
                            {slot.label}
                          </button>

                          {state.on && !sameTime && (
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
                          )}

                          {state.on && (
                            <div className="relative">
                              <select
                                value={state.slot}
                                onChange={(e) => setDay(slot.label, { slot: e.target.value })}
                                className="field !w-auto appearance-none !py-1.5 !pl-8 !text-[0.82rem]"
                              >
                                <option value="">חלק מהיום (לא חובה)</option>
                                {(taxonomy.timeSlots || []).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <IconChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <SelectInput
                label="תדירות"
                value={frequency}
                onChange={setFrequency}
                options={taxonomy.frequency || []}
                placeholder="שיעור קבוע"
              />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="תאריך" value={date} onChange={setDate} type="date" dir="ltr" required />
              <TextInput label="שעה" value={time} onChange={setTime} type="time" dir="ltr" required />
            </div>
          )}

          <TextArea
            label="הערות על מועדים"
            value={seasonNote}
            onChange={setSeasonNote}
            placeholder="לדוגמה: בחורף השיעור מתחיל ב-21:00. בבין הזמנים אין שיעור."
            rows={2}
          />
        </Section>
      )}

      {step === 3 && (
        <Section title="מקום השיעור" description="ככל שהכתובת מדויקת יותר, כך קל יותר להגיע.">
          <SelectInput
            label="סוג המקום"
            value={venueType}
            onChange={setVenueType}
            options={taxonomy.venueKinds || []}
            placeholder="בית כנסת"
          />
          <TextInput
            label="שם המקום"
            value={venueName}
            onChange={setVenueName}
            placeholder="לדוגמה: בית הכנסת אור החיים"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="עיר" value={city} onChange={setCity} required placeholder="ירושלים" />
            <TextInput label="שכונה" value={neighborhood} onChange={setNeighborhood} />
            <TextInput label="רחוב" value={street} onChange={setStreet} />
            <TextInput label="מספר בית" value={houseNo} onChange={setHouseNo} inputMode="numeric" />
          </div>
          <TextInput
            label="מיקום מדויק"
            value={locationExact}
            onChange={setLocationExact}
            placeholder="לדוגמה: בעזרת נשים, קומה ב׳"
            hint="פרט שיעזור למצוא את החדר או האולם בתוך המקום"
          />
        </Section>
      )}

      {step === 4 && (
        <Section
          title="שידור, הקלטה ולוגו"
          description="השיעורים מסומנים במאגר לפי אופן ההעברה, ואפשר לצרף לוגו של המקום או תמונת הרב."
        >
          <ChipSingle
            label="באיזו צורה השיעור מועבר"
            value={broadcast}
            onChange={setBroadcast}
            options={BROADCAST_OPTIONS}
          />
          {(broadcast === 'שידור חי' || broadcast === 'מוקלט ומשודר בשידור חי') && (
            <TextInput
              label="קישור לשידור החי"
              value={broadcastUrl}
              onChange={setBroadcastUrl}
              dir="ltr"
              placeholder="https://"
            />
          )}
          {(broadcast === 'שיעור מוקלט' || broadcast === 'מוקלט ומשודר בשידור חי') && (
            <TextInput
              label="היכן ניתן לשמוע את ההקלטה"
              value={recordingUrl}
              onChange={setRecordingUrl}
              placeholder="קול הלשון, קו טלפון או קישור"
            />
          )}
          <LogoUpload
            label="לוגו המקום או תמונת הרב"
            value={logoUrl}
            onChange={setLogoUrl}
            hint="אם לא יועלה לוגו, יוצג סמל איגוד השיעורים."
          />
        </Section>
      )}

      {step === 5 && (
        <Section
          title="פרטי מגיד השיעור ואיש הקשר"
          description="הטלפון משמש אותנו לאימות ולעדכונים. הוא יוצג באתר רק אם תבחרו בכך."
        >
          <TextInput
            label="שם מגיד השיעור"
            value={teacherName}
            onChange={setTeacherName}
            required
            placeholder="לדוגמה: הרב ישראל כהן"
          />
          <TextInput
            label="שם הארגון או המוסד"
            value={organization}
            onChange={setOrganization}
            placeholder="לדוגמה: דרשו, עטרת שלמה"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="שם איש הקשר" value={contactName} onChange={setContactName} />
            <TextInput
              label="טלפון"
              value={contactPhone}
              onChange={setContactPhone}
              required
              type="tel"
              dir="ltr"
              inputMode="tel"
              placeholder="050-0000000"
            />
          </div>
          <TextInput
            label="דואר אלקטרוני"
            value={contactEmail}
            onChange={setContactEmail}
            type="email"
            dir="ltr"
            inputMode="email"
            hint="לא יוצג באתר. משמש לעדכונים בלבד."
          />
        </Section>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-royal-300 bg-royal-50 px-4 py-3 text-sm font-bold text-royal-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="btn btn-quiet disabled:opacity-0"
        >
          <IconChevronDown className="h-4 w-4 rotate-90" />
          חזרה
        </button>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="btn btn-primary !px-8">
            המשך
            <IconArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={sending} className="btn btn-primary !px-8">
            {sending ? 'שולח...' : 'שליחת השיעור לאישור'}
            <IconCheck className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
