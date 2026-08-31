'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/types';
import { publicClient } from '@/lib/supabase';
import {
  ChipMulti, ChipSingle, Section, SelectInput, TextArea, TextInput,
} from './form/Fields';
import { IconArrowLeft, IconCheck, IconChevronDown } from './Icons';

/** טופס 4063 — מקום שמחפש מגיד שיעור. */

const STEPS = ['מי אתם', 'המקום', 'השיעור המבוקש', 'מועדים וסיום'];

export default function JoinHostForm({ taxonomy }: { taxonomy: Taxonomy }) {
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [requesterType, setRequesterType] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [locationExact, setLocationExact] = useState('');
  const [synagogueName, setSynagogueName] = useState('');
  const [gabbaiName, setGabbaiName] = useState('');
  const [nusach, setNusach] = useState('');
  const [congregants, setCongregants] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [activityDetail, setActivityDetail] = useState('');
  const [existingLessons, setExistingLessons] = useState('');
  const [needsServices, setNeedsServices] = useState('');
  const [religiousServices, setReligiousServices] = useState<string[]>([]);
  const [familyStyle, setFamilyStyle] = useState('');

  const [audienceGender, setAudienceGender] = useState('');
  const [language, setLanguage] = useState('עברית');
  const [languageOther, setLanguageOther] = useState('');
  const [audienceStyles, setAudienceStyles] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicOther, setTopicOther] = useState('');
  const [rabbiBackground, setRabbiBackground] = useState('');
  const [lessonCharacter, setLessonCharacter] = useState<string[]>([]);
  const [speechStyle, setSpeechStyle] = useState<string[]>([]);

  const [venueTypes, setVenueTypes] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredSlots, setPreferredSlots] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [payerOffer, setPayerOffer] = useState('');
  const [notes, setNotes] = useState('');

  const isSynagogue = requesterType === 'בית כנסת' || requesterType === 'מרכז תורני' || requesterType === 'ארגון';

  const stepError = (index: number): string => {
    if (index === 0) {
      if (!requesterType) return 'נא לבחור עבור מי מבקשים את השיעור';
      if (contactName.trim().length < 2) return 'נא למלא שם מלא';
      if (phone.replace(/\D/g, '').length < 9) return 'נא למלא מספר טלפון תקין';
    }
    if (index === 1 && !city.trim()) return 'נא למלא את שם העיר';
    if (index === 2 && !audienceGender) return 'נא לציין למי מיועד השיעור';
    return '';
  };

  const goNext = () => {
    const message = stepError(step);
    if (message) { setError(message); return; }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const message = stepError(i);
      if (message) { setStep(i); setError(message); return; }
    }
    setSending(true);
    setError('');

    const payload = {
      contact_name: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      source: 'web',
      details: {
        requesterType,
        neighborhood: neighborhood.trim(),
        street: street.trim(),
        locationExact: locationExact.trim(),
        synagogueName: synagogueName.trim(),
        gabbaiName: gabbaiName.trim(),
        nusach,
        congregants: congregants.trim(),
        activityLevel,
        activityDetail: activityDetail.trim(),
        existingLessons,
        needsServices,
        religiousServices,
        familyStyle,
        audienceGender,
        language,
        languageOther: languageOther.trim(),
        audienceStyles,
        topics,
        topicOther: topicOther.trim(),
        rabbiBackground,
        lessonCharacter,
        speechStyle,
        venueTypes,
        frequency,
        preferredDays,
        preferredSlots,
        date,
        time,
        payerOffer,
        notes: notes.trim(),
      },
    };

    try {
      const { error: rpcError } = await publicClient()
        .rpc('igud_submit_request', { p_kind: 'open_lesson', payload });
      if (rpcError) throw new Error(rpcError.message);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שליחת הטופס נכשלה');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="card-surface mx-auto max-w-xl rounded-2xl p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-100 text-gold-700">
          <IconCheck className="h-8 w-8" strokeWidth={2} />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-wine-700">הבקשה נקלטה</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          תודה. צוות האיגוד יעבור על הפרטים ויחפש מגיד שיעור שמתאים לקהל שתיארתם.
          ניצור קשר בטלפון שמסרתם.
        </p>
        <Link href="/" className="btn btn-primary mt-6">חזרה למאגר</Link>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-7 flex gap-1.5">
        {STEPS.map((title, i) => (
          <li key={title} className="flex-1">
            <button
              type="button"
              onClick={() => { if (i <= step) { setStep(i); setError(''); } }}
              disabled={i > step}
              className="w-full text-right"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors ${
                  i < step ? 'bg-gold-500' : i === step ? 'bg-wine-600' : 'bg-parch-300'
                }`}
              />
              <span className={`mt-1.5 block text-[0.7rem] font-bold ${i === step ? 'text-wine-700' : 'text-ink-500'}`}>
                {title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section title="עבור מי השיעור" description="כדי שנוכל להתאים מגיד שיעור לקהל הנכון.">
          <ChipSingle
            label="עבור מי אתם מעוניינים לקבוע שיעור"
            value={requesterType}
            onChange={setRequesterType}
            options={taxonomy.requesterType || []}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="שם מלא" value={contactName} onChange={setContactName} required />
            <TextInput
              label="טלפון"
              value={phone}
              onChange={setPhone}
              required
              type="tel"
              dir="ltr"
              inputMode="tel"
              placeholder="050-0000000"
            />
          </div>
          <TextInput
            label="דואר אלקטרוני"
            value={email}
            onChange={setEmail}
            type="email"
            dir="ltr"
            inputMode="email"
          />
        </Section>
      )}

      {step === 1 && (
        <Section title="פרטי המקום" description="היכן יתקיים השיעור, ומי הציבור שמתפלל או לומד שם.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="עיר" value={city} onChange={setCity} required />
            <TextInput label="שכונה" value={neighborhood} onChange={setNeighborhood} />
            <TextInput label="רחוב" value={street} onChange={setStreet} />
            <TextInput label="מיקום מדויק" value={locationExact} onChange={setLocationExact} />
          </div>

          {isSynagogue ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="שם בית הכנסת או המרכז" value={synagogueName} onChange={setSynagogueName} />
                <TextInput label="שם הגבאי או רב בית הכנסת" value={gabbaiName} onChange={setGabbaiName} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectInput
                  label="נוסח התפילה"
                  value={nusach}
                  onChange={setNusach}
                  options={taxonomy.synagogueNusach || []}
                />
                <TextInput
                  label="כמות המתפללים"
                  value={congregants}
                  onChange={setCongregants}
                  inputMode="numeric"
                />
              </div>
              <ChipSingle
                label="רמת הפעילות בבית הכנסת"
                value={activityLevel}
                onChange={setActivityLevel}
                options={taxonomy.synagogueActivity || []}
              />
              {activityLevel === 'פעילות חלקית ביום חול' && (
                <TextInput label="נא לפרט את הפעילות" value={activityDetail} onChange={setActivityDetail} />
              )}
              <ChipSingle
                label="האם מתקיימים כבר שיעורים במקום"
                value={existingLessons}
                onChange={setExistingLessons}
                options={taxonomy.trainingYesNo || ['כן', 'לא']}
              />
              <ChipSingle
                label="האם דרושים שירותי דת נוספים"
                value={needsServices}
                onChange={setNeedsServices}
                options={taxonomy.trainingYesNo || ['כן', 'לא']}
              />
              {needsServices === 'כן' && (
                <ChipMulti
                  label="אילו שירותים"
                  values={religiousServices}
                  onChange={setReligiousServices}
                  options={taxonomy.religiousServices || []}
                />
              )}
            </>
          ) : (
            <ChipSingle
              label="סגנון המשפחה או הקבוצה"
              value={familyStyle}
              onChange={setFamilyStyle}
              options={taxonomy.familyStyle || []}
              columns
            />
          )}
        </Section>
      )}

      {step === 2 && (
        <Section title="השיעור שאתם מחפשים" description="ככל שתפרטו יותר, כך ההתאמה תהיה מדויקת יותר.">
          <ChipSingle
            label="למי מיועד השיעור"
            value={audienceGender}
            onChange={setAudienceGender}
            options={taxonomy.audienceGender || []}
            required
          />
          <ChipMulti
            label="סגנון הלומדים"
            values={audienceStyles}
            onChange={setAudienceStyles}
            options={taxonomy.audienceStyles || []}
            columns
          />
          <ChipMulti
            label="נושאים ללימוד"
            values={topics}
            onChange={setTopics}
            options={taxonomy.topics || []}
            otherValue={topicOther}
            onOtherChange={setTopicOther}
            columns
          />
          <ChipSingle
            label="שפת השיעור"
            value={language}
            onChange={setLanguage}
            options={taxonomy.languages || []}
            otherValue={languageOther}
            onOtherChange={setLanguageOther}
          />
          <ChipSingle
            label="רקע מגיד השיעור המבוקש"
            value={rabbiBackground}
            onChange={setRabbiBackground}
            options={taxonomy.rabbiBackground || []}
          />
          <ChipMulti
            label="אופי השיעור"
            values={lessonCharacter}
            onChange={setLessonCharacter}
            options={taxonomy.lessonCharacter || []}
          />
          <ChipMulti
            label="סגנון הדיבור המועדף"
            values={speechStyle}
            onChange={setSpeechStyle}
            options={taxonomy.speechStyle || []}
          />
        </Section>
      )}

      {step === 3 && (
        <Section title="מועדים ותנאים" description="מתי נוח לכם, ומה אתם יכולים להציע למגיד השיעור.">
          <ChipMulti
            label="סוג המסגרת"
            values={venueTypes}
            onChange={setVenueTypes}
            options={taxonomy.venueTypes || []}
          />
          <ChipSingle
            label="קביעות השיעור"
            value={frequency}
            onChange={setFrequency}
            options={taxonomy.frequency || []}
          />
          <ChipMulti
            label="ימים מועדפים"
            values={preferredDays}
            onChange={setPreferredDays}
            options={taxonomy.days || []}
            columns
          />
          <ChipMulti
            label="שעות מועדפות"
            values={preferredSlots}
            onChange={setPreferredSlots}
            options={taxonomy.timeSlots || []}
          />
          {(frequency === 'חד פעמי / לפי מאורע' || frequency === 'שיעור בתאריך מסוים') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="תאריך" value={date} onChange={setDate} type="date" dir="ltr" />
              <TextInput label="שעה" value={time} onChange={setTime} type="time" dir="ltr" />
            </div>
          )}
          <ChipSingle
            label="מה תוכלו לשלם למגיד השיעור"
            value={payerOffer}
            onChange={setPayerOffer}
            options={taxonomy.payerOffer || []}
          />
          <TextArea
            label="הערות נוספות"
            value={notes}
            onChange={setNotes}
            placeholder="כל פרט שיעזור לנו למצוא את ההתאמה הנכונה"
          />
        </Section>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-wine-300 bg-wine-50 px-4 py-3 text-sm font-bold text-wine-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => { setError(''); setStep((s) => Math.max(s - 1, 0)); }}
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
            {sending ? 'שולח...' : 'שליחת הבקשה'}
            <IconCheck className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
