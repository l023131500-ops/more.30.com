'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/types';
import { publicClient } from '@/lib/supabase';
import {
  ChipMulti, ChipSingle, Section, SelectInput, TextArea, TextInput,
} from './form/Fields';
import { IconArrowLeft, IconCheck, IconChevronDown } from './Icons';

/** טופס 4018 — רישום כמגיד שיעור. */

const STEPS = ['פרטים אישיים', 'רקע תורני', 'מה תרצו למסור', 'זמינות וסיום'];

export default function JoinMaggidForm({ taxonomy }: { taxonomy: Taxonomy }) {
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');

  const [pastYeshiva, setPastYeshiva] = useState('');
  const [background, setBackground] = useState('');
  const [occupation, setOccupation] = useState('');
  const [occupationOther, setOccupationOther] = useState('');
  const [hasTraining, setHasTraining] = useState('');
  const [hasPublicSpeaking, setHasPublicSpeaking] = useState('');
  const [extraSkills, setExtraSkills] = useState<string[]>([]);
  const [extraSkillsOther, setExtraSkillsOther] = useState('');

  const [topics, setTopics] = useState<string[]>([]);
  const [topicOther, setTopicOther] = useState('');
  const [audienceGender, setAudienceGender] = useState('');
  const [languages, setLanguages] = useState<string[]>(['עברית']);
  const [languageOther, setLanguageOther] = useState('');
  const [audienceStyles, setAudienceStyles] = useState<string[]>([]);
  const [lessonCharacter, setLessonCharacter] = useState<string[]>([]);
  const [speechStyle, setSpeechStyle] = useState<string[]>([]);
  const [venueTypes, setVenueTypes] = useState<string[]>([]);

  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredSlots, setPreferredSlots] = useState<string[]>([]);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [travelRange, setTravelRange] = useState('');
  const [travel, setTravel] = useState('');
  const [payExpectation, setPayExpectation] = useState('');

  const [ref1Name, setRef1Name] = useState('');
  const [ref1Role, setRef1Role] = useState('');
  const [ref1Phone, setRef1Phone] = useState('');
  const [ref2Name, setRef2Name] = useState('');
  const [ref2Role, setRef2Role] = useState('');
  const [ref2Phone, setRef2Phone] = useState('');
  const [notes, setNotes] = useState('');

  const stepError = (index: number): string => {
    if (index === 0) {
      if (fullName.trim().length < 2) return 'נא למלא שם מלא';
      if (phone.replace(/\D/g, '').length < 9) return 'נא למלא מספר טלפון תקין';
      if (!city.trim()) return 'נא למלא עיר מגורים';
    }
    if (index === 2) {
      if (!topics.length && !topicOther.trim()) return 'נא לבחור נושא אחד לפחות';
      if (!audienceGender) return 'נא לציין למי מתאים לכם למסור שיעור';
    }
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
      contact_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      source: 'web',
      details: {
        birthDate,
        maritalStatus,
        pastYeshiva: pastYeshiva.trim(),
        background,
        occupation,
        occupationOther: occupationOther.trim(),
        hasTraining,
        hasPublicSpeaking,
        extraSkills,
        extraSkillsOther: extraSkillsOther.trim(),
        topics,
        topicOther: topicOther.trim(),
        audienceGender,
        languages,
        languageOther: languageOther.trim(),
        audienceStyles,
        lessonCharacter,
        speechStyle,
        venueTypes,
        preferredDays,
        preferredSlots,
        availabilityNote: availabilityNote.trim(),
        travelRange,
        travel,
        payExpectation,
        references: [
          { name: ref1Name.trim(), role: ref1Role.trim(), phone: ref1Phone.trim() },
          { name: ref2Name.trim(), role: ref2Role.trim(), phone: ref2Phone.trim() },
        ].filter((r) => r.name),
        notes: notes.trim(),
      },
    };

    try {
      const { error: rpcError } = await publicClient()
        .rpc('igud_submit_request', { p_kind: 'maggid', payload });
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
        <h2 className="mt-5 font-display text-2xl font-bold text-royal-700">הרישום נקלט</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          תודה. הפרטים נשמרו במאגר מגידי השיעור של האיגוד. כשיימצא מקום שמתאים
          לסגנון ולזמינות שלכם, ניצור קשר.
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
                  i < step ? 'bg-gold-500' : i === step ? 'bg-royal-600' : 'bg-parch-300'
                }`}
              />
              <span className={`mt-1.5 block text-[0.7rem] font-bold ${i === step ? 'text-royal-700' : 'text-ink-500'}`}>
                {title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section title="פרטים אישיים">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="שם מלא" value={fullName} onChange={setFullName} required />
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
            <TextInput label="עיר מגורים" value={city} onChange={setCity} required />
            <TextInput
              label="דואר אלקטרוני"
              value={email}
              onChange={setEmail}
              type="email"
              dir="ltr"
              inputMode="email"
            />
            <TextInput label="תאריך לידה" value={birthDate} onChange={setBirthDate} type="date" dir="ltr" />
            <SelectInput
              label="מצב אישי"
              value={maritalStatus}
              onChange={setMaritalStatus}
              options={taxonomy.maritalStatus || []}
            />
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section title="רקע תורני" description="הפרטים האלה עוזרים לנו להתאים אתכם לקהל המתאים.">
          <TextInput
            label="מקום לימודים"
            value={pastYeshiva}
            onChange={setPastYeshiva}
            placeholder="ישיבה, כולל או מוסד"
          />
          <ChipSingle
            label="רקע"
            value={background}
            onChange={setBackground}
            options={(taxonomy.rabbiBackground || []).filter((v) => v !== 'לא משנה')}
          />
          <ChipSingle
            label="עיסוק ותפקיד"
            value={occupation}
            onChange={setOccupation}
            options={taxonomy.occupation || []}
            otherValue={occupationOther}
            onOtherChange={setOccupationOther}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipSingle
              label="הכשרה מקצועית תורנית"
              value={hasTraining}
              onChange={setHasTraining}
              options={taxonomy.trainingYesNo || ['כן', 'לא']}
            />
            <ChipSingle
              label="ניסיון בדיבור בציבור"
              value={hasPublicSpeaking}
              onChange={setHasPublicSpeaking}
              options={taxonomy.trainingYesNo || ['כן', 'לא']}
            />
          </div>
          <ChipMulti
            label="כישורים נוספים"
            values={extraSkills}
            onChange={setExtraSkills}
            options={taxonomy.rabbiExtraSkills || []}
            otherValue={extraSkillsOther}
            onOtherChange={setExtraSkillsOther}
          />
        </Section>
      )}

      {step === 2 && (
        <Section title="מה תרצו למסור" description="הנושאים, הקהל והסגנון שמתאימים לכם.">
          <ChipMulti
            label="נושאים שאתם מוסרים"
            values={topics}
            onChange={setTopics}
            options={taxonomy.topics || []}
            otherValue={topicOther}
            onOtherChange={setTopicOther}
            columns
          />
          <ChipSingle
            label="למי מתאים לכם למסור שיעור"
            value={audienceGender}
            onChange={setAudienceGender}
            options={taxonomy.audienceGender || []}
            required
          />
          <ChipMulti
            label="באילו שפות"
            values={languages}
            onChange={setLanguages}
            options={taxonomy.languages || []}
            otherValue={languageOther}
            onOtherChange={setLanguageOther}
          />
          <ChipMulti
            label="סגנון קהל היעד"
            values={audienceStyles}
            onChange={setAudienceStyles}
            options={taxonomy.audienceStyles || []}
            columns
          />
          <ChipMulti
            label="אופי השיעורים"
            values={lessonCharacter}
            onChange={setLessonCharacter}
            options={taxonomy.lessonCharacter || []}
          />
          <ChipMulti
            label="סגנון הדיבור שלכם"
            values={speechStyle}
            onChange={setSpeechStyle}
            options={taxonomy.speechStyle || []}
          />
          <ChipMulti
            label="מקומות שמתאים לכם למסור בהם"
            values={venueTypes}
            onChange={setVenueTypes}
            options={taxonomy.venueTypes || []}
          />
        </Section>
      )}

      {step === 3 && (
        <Section title="זמינות והמלצות">
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
          <TextInput
            label="פירוט הזמינות"
            value={availabilityNote}
            onChange={setAvailabilityNote}
            placeholder="לדוגמה: בין 20:00 ל-22:00, למעט ימי שישי"
          />
          <ChipSingle
            label="היכן תרצו למסור שיעורים"
            value={travelRange}
            onChange={setTravelRange}
            options={taxonomy.travelRange || []}
          />
          <ChipSingle
            label="איך אתם מתניידים"
            value={travel}
            onChange={setTravel}
            options={taxonomy.travel || []}
          />
          <ChipSingle
            label="מה התגמול שהייתם מצפים לקבל"
            value={payExpectation}
            onChange={setPayExpectation}
            options={taxonomy.rabbiPayExpectation || []}
          />

          <div>
            <div className="field-label">ממליצים</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextInput label="שם" value={ref1Name} onChange={setRef1Name} />
              <TextInput label="תפקיד" value={ref1Role} onChange={setRef1Role} />
              <TextInput label="טלפון" value={ref1Phone} onChange={setRef1Phone} dir="ltr" inputMode="tel" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <TextInput label="שם" value={ref2Name} onChange={setRef2Name} />
              <TextInput label="תפקיד" value={ref2Role} onChange={setRef2Role} />
              <TextInput label="טלפון" value={ref2Phone} onChange={setRef2Phone} dir="ltr" inputMode="tel" />
            </div>
          </div>

          <TextArea label="הערות נוספות" value={notes} onChange={setNotes} />
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
            {sending ? 'שולח...' : 'שליחת הרישום'}
            <IconCheck className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
