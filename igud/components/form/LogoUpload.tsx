'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { browserClient, mediaUrl, publicClient } from '@/lib/supabase';
import { FALLBACK_LOGO } from '@/lib/site';
import { IconClose, IconImage } from '../Icons';
import { Field } from './Fields';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/**
 * העלאת לוגו או תמונה לדלי המדיה.
 * הגשה ציבורית נשמרת תחת submissions/, ומשתמש מחובר שומר תחת התיקייה שלו.
 */
export default function LogoUpload({
  label, value, onChange, hint, folder = 'submissions', authenticated = false,
}: {
  label: string;
  value: string;
  onChange: (path: string) => void;
  hint?: string;
  folder?: string;
  authenticated?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = mediaUrl(value) || FALLBACK_LOGO;

  const pick = async (file: File) => {
    setError('');
    if (!ALLOWED.includes(file.type)) {
      setError('אפשר להעלות תמונה בלבד (PNG, JPG, WEBP או SVG)');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('הקובץ גדול מדי. הגודל המרבי הוא 5 מגה-בייט');
      return;
    }

    setBusy(true);
    try {
      const client = authenticated ? browserClient() : publicClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await client.storage
        .from('igud-media')
        .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'העלאת הקובץ נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-4">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl
                         border border-parch-300 bg-white/70 p-1.5">
          <Image
            src={preview}
            alt=""
            width={160}
            height={160}
            className="h-full w-full object-contain"
            unoptimized={preview.startsWith('http')}
          />
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn btn-quiet !py-2 !text-[0.82rem]"
          >
            <IconImage className="h-4 w-4" />
            {busy ? 'מעלה...' : value ? 'החלפת התמונה' : 'העלאת תמונה'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="btn btn-quiet !py-2 !text-[0.82rem]"
            >
              <IconClose className="h-3.5 w-3.5" />
              הסרה
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
            e.target.value = '';
          }}
        />
      </div>
    </Field>
  );
}
