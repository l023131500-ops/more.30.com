'use client';

import { useState } from 'react';
import type { LessonCard } from '@/lib/types';
import { drawLessonCard, jpegToPdf, lessonAsText } from '@/lib/lesson-card-image';
import { lessonTitle } from '@/lib/format';
import { IconCheck, IconCopy, IconDownload, IconImage, IconPdf, IconShare } from './Icons';

type Busy = 'png' | 'pdf' | 'copy' | 'share' | null;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(lesson: LessonCard) {
  return `${lessonTitle(lesson)} - ${lesson.teacher_name || ''}`
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'שיעור';
}

export default function LessonActions({ lesson }: { lesson: LessonCard }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [done, setDone] = useState<Busy>(null);
  const [error, setError] = useState('');

  const flash = (which: Busy) => {
    setDone(which);
    window.setTimeout(() => setDone(null), 2200);
  };

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  const savePng = async () => {
    setBusy('png');
    setError('');
    try {
      const canvas = await drawLessonCard(lesson);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('יצירת התמונה נכשלה');
      download(blob, `${safeName(lesson)}.png`);
      flash('png');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה ביצירת התמונה');
    } finally {
      setBusy(null);
    }
  };

  const savePdf = async () => {
    setBusy('pdf');
    setError('');
    try {
      const canvas = await drawLessonCard(lesson);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.94));
      if (!blob) throw new Error('יצירת הקובץ נכשלה');
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      download(jpegToPdf(jpeg, canvas.width, canvas.height), `${safeName(lesson)}.pdf`);
      flash('pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה ביצירת ה-PDF');
    } finally {
      setBusy(null);
    }
  };

  const copyText = async () => {
    setError('');
    const text = lessonAsText(lesson, pageUrl);
    try {
      await navigator.clipboard.writeText(text);
      flash('copy');
    } catch {
      // דפדפנים שחוסמים גישה ללוח: נופלים לשיטה הישנה
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        flash('copy');
      } catch {
        setError('לא ניתן להעתיק בדפדפן הזה');
      }
      area.remove();
    }
  };

  const share = async () => {
    setError('');
    const text = lessonAsText(lesson, pageUrl);
    if (navigator.share) {
      try {
        await navigator.share({ title: lessonTitle(lesson), text, url: pageUrl });
        flash('share');
        return;
      } catch {
        return; // המשתמש ביטל
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const Button = ({
    onClick, icon, label, kind,
  }: { onClick: () => void; icon: React.ReactNode; label: string; kind: Busy }) => (
    <button type="button" onClick={onClick} disabled={busy !== null} className="btn btn-quiet !py-2 !text-[0.82rem]">
      {done === kind ? <IconCheck className="h-4 w-4 text-green-700" /> : icon}
      {busy === kind ? 'רגע...' : label}
    </button>
  );

  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-2">
        <Button onClick={savePng} icon={<IconImage className="h-4 w-4" />} label="שמירה כתמונה" kind="png" />
        <Button onClick={savePdf} icon={<IconPdf className="h-4 w-4" />} label="הורדה כ-PDF" kind="pdf" />
        <Button onClick={copyText} icon={<IconCopy className="h-4 w-4" />} label="העתקת הפרטים" kind="copy" />
        <Button onClick={share} icon={<IconShare className="h-4 w-4" />} label="שיתוף" kind="share" />
        <a
          href={`/api/ics/${lesson.id}`}
          className="btn btn-quiet !py-2 !text-[0.82rem]"
          title="הוספה ליומן"
        >
          <IconDownload className="h-4 w-4" />
          הוספה ליומן
        </a>
      </div>
      {error && <p className="mt-2 text-xs text-wine-600">{error}</p>}
    </div>
  );
}
