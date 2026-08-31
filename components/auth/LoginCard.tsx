'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { IconArrowLeft, IconCheck } from '../Icons';

export default function LoginCard({
  title, subtitle, onSubmit, footer,
}: {
  title: string;
  subtitle: string;
  onSubmit: (login: string, password: string) => Promise<void>;
  footer?: React.ReactNode;
}) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(login, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ההתחברות נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex flex-col items-center gap-2">
          <Image
            src={SITE.logoSmall}
            alt={SITE.name}
            width={220}
            height={259}
            className="h-24 w-auto"
          />
          <span className="font-display text-lg font-bold text-wine-700">{SITE.name}</span>
        </Link>

        <form onSubmit={submit} className="card-surface rounded-2xl p-7">
          <h1 className="font-display text-2xl font-bold text-wine-700">{title}</h1>
          <p className="mt-1 text-[0.85rem] text-ink-500">{subtitle}</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="field-label" htmlFor="igud-login">
                שם משתמש
              </label>
              <input
                id="igud-login"
                type="text"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="דוא״ל או מספר טלפון"
                className="field"
                dir="ltr"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="igud-password">
                סיסמה
              </label>
              <input
                id="igud-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-wine-300 bg-wine-50 px-3 py-2 text-[0.82rem] font-bold text-wine-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full !py-3">
            {busy ? 'מתחבר...' : 'כניסה'}
            {!busy && <IconCheck className="h-4 w-4" />}
          </button>

          {footer && <div className="mt-5 text-center text-[0.8rem] text-ink-500">{footer}</div>}
        </form>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-wine-600"
        >
          <IconArrowLeft className="h-4 w-4" />
          חזרה לאתר
        </Link>
      </div>
    </div>
  );
}
