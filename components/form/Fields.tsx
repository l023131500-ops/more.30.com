'use client';

import { useId } from 'react';
import { IconCheck, IconChevronDown } from '../Icons';

/* ---------------- מעטפת שדה ---------------- */

export function Field({
  label, hint, required, error, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="field-label">
        {label}
        {required && <span className="mr-1 text-wine-500">*</span>}
      </div>
      {children}
      {hint && !error && <p className="mt-1 text-[0.72rem] text-ink-500">{hint}</p>}
      {error && <p className="mt-1 text-[0.72rem] font-bold text-wine-600">{error}</p>}
    </div>
  );
}

/* ---------------- טקסט ---------------- */

export function TextInput({
  label, value, onChange, placeholder, hint, required, error, type = 'text', dir, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  type?: string;
  dir?: 'rtl' | 'ltr';
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
}) {
  return (
    <Field label={label} hint={hint} required={required} error={error}>
      <input
        type={type}
        dir={dir}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`field ${error ? '!border-wine-500' : ''}`}
      />
    </Field>
  );
}

export function TextArea({
  label, value, onChange, placeholder, hint, rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field resize-y"
      />
    </Field>
  );
}

/* ---------------- רשימה נפתחת ---------------- */

export function SelectInput({
  label, value, onChange, options, placeholder = 'בחירה', hint, required, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} required={required} error={error}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`field appearance-none !pl-9 ${error ? '!border-wine-500' : ''}`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <IconChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      </div>
    </Field>
  );
}

/* ---------------- בחירה באסימונים ---------------- */

const OTHER = 'אחר';

export function ChipSingle({
  label, value, onChange, options, otherValue, onOtherChange, hint, required, error, columns,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  otherValue?: string;
  onOtherChange?: (v: string) => void;
  hint?: string;
  required?: boolean;
  error?: string;
  columns?: boolean;
}) {
  const showOther = onOtherChange && value === OTHER;
  return (
    <Field label={label} hint={hint} required={required} error={error}>
      <div className={columns ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'flex flex-wrap gap-2'}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            data-on={value === option}
            onClick={() => onChange(value === option ? '' : option)}
            className={`chip ${columns ? 'justify-center' : ''}`}
          >
            {value === option && <IconCheck className="h-3.5 w-3.5" />}
            {option}
          </button>
        ))}
      </div>
      {showOther && (
        <input
          type="text"
          value={otherValue || ''}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="נא לפרט"
          className="field mt-2"
        />
      )}
    </Field>
  );
}

export function ChipMulti({
  label, values, onChange, options, otherValue, onOtherChange, hint, error, max, columns,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  otherValue?: string;
  onOtherChange?: (v: string) => void;
  hint?: string;
  error?: string;
  max?: number;
  columns?: boolean;
}) {
  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((v) => v !== option));
    } else if (!max || values.length < max) {
      onChange([...values, option]);
    }
  };
  const showOther = onOtherChange && values.includes(OTHER);

  return (
    <Field
      label={label}
      hint={hint || (max ? `אפשר לבחור עד ${max}` : 'אפשר לבחור כמה אפשרויות')}
      error={error}
    >
      <div className={columns ? 'grid grid-cols-2 gap-2 sm:grid-cols-3' : 'flex flex-wrap gap-2'}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            data-on={values.includes(option)}
            onClick={() => toggle(option)}
            className={`chip ${columns ? 'justify-center' : ''}`}
          >
            {values.includes(option) && <IconCheck className="h-3.5 w-3.5" />}
            {option}
          </button>
        ))}
      </div>
      {showOther && (
        <input
          type="text"
          value={otherValue || ''}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="נא לפרט"
          className="field mt-2"
        />
      )}
    </Field>
  );
}

/* ---------------- מתג ---------------- */

export function Toggle({
  label, checked, onChange, hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-wine-700 bg-wine-600' : 'border-parch-300 bg-parch-200'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? '-translate-x-[1.25rem]' : '-translate-x-0.5'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-bold text-ink-900">{label}</span>
        {hint && <span className="block text-[0.72rem] text-ink-500">{hint}</span>}
      </label>
    </div>
  );
}

/* ---------------- מקטע בטופס ---------------- */

export function Section({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface rounded-2xl p-5 sm:p-7">
      <h2 className="font-display text-xl font-bold text-wine-700">{title}</h2>
      {description && <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-500">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
