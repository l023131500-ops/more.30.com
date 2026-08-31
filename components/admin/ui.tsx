'use client';

import { useState } from 'react';
import { IconCheck, IconClose } from '../Icons';

export function Panel({
  title, description, actions, children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface rounded-2xl p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-wine-700">{title}</h2>
          {description && <p className="mt-0.5 text-[0.82rem] text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Badge({
  tone = 'neutral', children,
}: {
  tone?: 'neutral' | 'gold' | 'green' | 'wine';
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'border-parch-300 bg-parch-200 text-ink-500',
    gold: 'border-gold-400 bg-gold-50 text-gold-700',
    green: 'border-green-600/40 bg-green-50 text-green-800',
    wine: 'border-wine-400 bg-wine-50 text-wine-700',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.66rem] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'neutral' | 'gold' | 'green' | 'wine'; label: string }> = {
    pending: { tone: 'gold', label: 'ממתין לאישור' },
    published: { tone: 'green', label: 'מפורסם' },
    rejected: { tone: 'wine', label: 'נדחה' },
    archived: { tone: 'neutral', label: 'בארכיון' },
    hidden: { tone: 'neutral', label: 'מוסתר' },
    new: { tone: 'gold', label: 'חדש' },
    in_progress: { tone: 'gold', label: 'בטיפול' },
    matched: { tone: 'green', label: 'שודך' },
    closed: { tone: 'neutral', label: 'סגור' },
    spam: { tone: 'wine', label: 'זבל' },
  };
  const item = map[status] || { tone: 'neutral' as const, label: status };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

/** כפתור שדורש אישור שני לפני פעולה בלתי הפיכה. */
export function ConfirmButton({
  label, confirmLabel = 'לאשר?', onConfirm, className = 'btn btn-quiet !py-1.5 !text-[0.76rem]',
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
        }}
        className="btn !border !border-wine-600 !bg-wine-600 !py-1.5 !text-[0.76rem] !text-gold-100"
      >
        <IconCheck className="h-3 w-3" />
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="btn btn-quiet !py-1.5 !px-2 !text-[0.76rem]"
      >
        <IconClose className="h-3 w-3" />
      </button>
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-parch-300 bg-white/50 p-10 text-center text-sm text-ink-500">
      {text}
    </div>
  );
}

export function Toast({ message, tone = 'ok' }: { message: string; tone?: 'ok' | 'error' }) {
  if (!message) return null;
  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm font-bold ${
        tone === 'ok'
          ? 'border-green-600/40 bg-green-50 text-green-800'
          : 'border-wine-300 bg-wine-50 text-wine-700'
      }`}
    >
      {message}
    </p>
  );
}

export function Stat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'gold' | 'wine' }) {
  const border = tone === 'gold' ? 'border-gold-400' : tone === 'wine' ? 'border-wine-400' : 'border-parch-300';
  return (
    <div className={`rounded-xl border bg-white/70 px-4 py-3 ${border}`}>
      <div className="font-display text-2xl font-bold tabular-nums text-wine-700">{value}</div>
      <div className="text-[0.72rem] text-ink-500">{label}</div>
    </div>
  );
}
