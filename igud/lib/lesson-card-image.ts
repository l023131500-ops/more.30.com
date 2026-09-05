import type { LessonCard } from './types';
import {
  addressLine, dayLabel, lessonTitle, placeName, rabbiName, timeLabel,
} from './format';
import { SITE } from './site';

const W = 1080;
const H = 1350;

const WINE = '#4A1818';
const WINE_DEEP = '#360F10';
const GOLD = '#C6A75C';
const GOLD_LIGHT = '#E4D8B4';
const PARCH = '#FAF6EC';
const INK = '#2A1512';
const INK_SOFT = '#6B5A55';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** שובר שורה לפי רוחב, בעברית מימין לשמאל. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * מצייר כרטיס שיעור מעוצב על קנבס, בשפה העיצובית של האיגוד.
 * מוחזר קנבס שממנו אפשר להפיק PNG או PDF.
 */
export async function drawLessonCard(lesson: LessonCard): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('הדפדפן אינו תומך בציור על קנבס');

  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ממשיכים עם פונט ברירת מחדל */ }
  }

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  const display = '"Frank Ruhl Libre", "David Libre", Georgia, serif';
  const body = 'Alef, "Segoe UI", system-ui, sans-serif';

  // ---------- רקע ----------
  ctx.fillStyle = PARCH;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.75, 0, 40, W * 0.75, 0, 760);
  glow.addColorStop(0, 'rgba(255,253,247,1)');
  glow.addColorStop(1, 'rgba(250,246,236,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---------- כותרת עליונה ----------
  const header = ctx.createLinearGradient(0, 0, W, 210);
  header.addColorStop(0, WINE_DEEP);
  header.addColorStop(1, WINE);
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, W, 200);

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 200, W, 4);

  const mark = await loadImage(`${window.location.origin}/brand/mark-256.webp`);
  if (mark) ctx.drawImage(mark, W - 178, 30, 140, 140);

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `700 52px ${display}`;
  ctx.fillText(SITE.name, W - 202, 100);
  ctx.fillStyle = 'rgba(228,216,180,0.72)';
  ctx.font = `400 26px ${body}`;
  ctx.fillText(SITE.tagline, W - 202, 144);

  // ---------- גוף ----------
  const right = W - 72;
  const maxW = W - 144;
  let y = 296;

  // נושא
  ctx.fillStyle = WINE;
  ctx.font = `700 66px ${display}`;
  for (const line of wrap(ctx, lessonTitle(lesson), maxW).slice(0, 2)) {
    ctx.fillText(line, right, y);
    y += 80;
  }

  // שם הרב
  y += 6;
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${body}`;
  ctx.fillText(rabbiName(lesson.teacher_name), right, y);
  y += 34;

  ctx.fillStyle = GOLD;
  ctx.fillRect(right - 150, y, 150, 3);
  y += 66;

  // ---------- שורות פרטים ----------
  const rows: { label: string; value: string }[] = [];
  const place = placeName(lesson);
  const address = addressLine(lesson);
  if (place) rows.push({ label: 'מקום', value: place });
  if (address) rows.push({ label: 'כתובת', value: address });

  const schedule = (lesson.schedule || [])
    .map((o) => `${dayLabel(o)} ${timeLabel(o)}`.trim())
    .filter(Boolean);
  if (schedule.length) {
    rows.push({ label: schedule.length > 1 ? 'מועדים' : 'מועד', value: schedule.join('  ·  ') });
  }
  if (lesson.audience_gender) rows.push({ label: 'קהל', value: lesson.audience_gender });
  if (lesson.language) rows.push({ label: 'שפה', value: lesson.language });
  if (lesson.lesson_style) rows.push({ label: 'סגנון', value: lesson.lesson_style });
  if (lesson.organization) rows.push({ label: 'ארגון', value: lesson.organization });
  if (lesson.contact_phone) rows.push({ label: 'לפרטים', value: lesson.contact_phone });

  for (const row of rows) {
    if (y > H - 300) break;
    ctx.fillStyle = INK_SOFT;
    ctx.font = `700 26px ${body}`;
    ctx.fillText(row.label, right, y);

    ctx.fillStyle = INK;
    ctx.font = `400 34px ${body}`;
    const lines = wrap(ctx, row.value, maxW - 20).slice(0, 2);
    y += 40;
    for (const line of lines) {
      ctx.fillText(line, right, y);
      y += 42;
    }
    y += 16;
  }

  // ---------- סימוני שידור ----------
  const marks: string[] = [];
  if (lesson.broadcast === 'recorded' || lesson.broadcast === 'both') marks.push('שיעור מוקלט');
  if (lesson.broadcast === 'live' || lesson.broadcast === 'both') marks.push('שידור חי');

  if (marks.length) {
    let x = right;
    const markY = Math.min(y + 8, H - 250);
    ctx.font = `700 28px ${body}`;
    for (const mark2 of marks) {
      const w = ctx.measureText(mark2).width + 56;
      ctx.fillStyle = '#F8F0D9';
      roundRect(ctx, x - w, markY - 38, w, 56, 28);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#85642B';
      ctx.fillText(mark2, x - 28, markY);
      x -= w + 16;
    }
  }

  // ---------- כותרת תחתונה ----------
  ctx.fillStyle = WINE;
  ctx.fillRect(0, H - 132, W, 132);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - 136, W, 4);

  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `700 30px ${body}`;
  ctx.fillText(SITE.url.replace(/^https?:\/\//, ''), right, H - 74);

  ctx.fillStyle = 'rgba(228,216,180,0.75)';
  ctx.font = `400 26px ${body}`;
  ctx.fillText(`מערכת קולית ${SITE.voiceLine}`, right, H - 34);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(228,216,180,0.6)';
  ctx.font = `400 24px ${body}`;
  ctx.fillText(`שיעור מספר ${lesson.public_no}`, 72, H - 54);

  return canvas;
}

/* ============================================================
   הפקת PDF עם התמונה, ללא ספריות חיצוניות
   ============================================================ */

function bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

/** עוטף JPEG בקובץ PDF בעל עמוד יחיד בגודל התמונה. */
export function jpegToPdf(jpeg: Uint8Array, width: number, height: number): Blob {
  const objects: number[][] = [];

  objects.push(bytes('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  objects.push(bytes(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
    `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  ));

  const imageHeader = bytes(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  objects.push([...imageHeader, ...Array.from(jpeg), ...bytes('\nendstream')]);

  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  objects.push(bytes(`<< /Length ${content.length} >>\nstream\n${content}endstream`));

  const out: number[] = [];
  const push = (arr: number[]) => { for (const b of arr) out.push(b); };

  push(bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));

  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    push(bytes(`${i + 1} 0 obj\n`));
    push(obj);
    push(bytes('\nendobj\n'));
  });

  const xrefOffset = out.length;
  push(bytes(`xref\n0 ${objects.length + 1}\n`));
  push(bytes('0000000000 65535 f \n'));
  for (const offset of offsets) {
    push(bytes(`${String(offset).padStart(10, '0')} 00000 n \n`));
  }
  push(bytes(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ));

  return new Blob([new Uint8Array(out)], { type: 'application/pdf' });
}

/** טקסט השיעור להעתקה או לשיתוף. */
export function lessonAsText(lesson: LessonCard, url: string): string {
  const lines = [
    `${lessonTitle(lesson)}`,
    rabbiName(lesson.teacher_name),
  ];

  const place = placeName(lesson);
  const address = addressLine(lesson);
  if (place) lines.push(`מקום: ${place}`);
  if (address) lines.push(`כתובת: ${address}`);

  const schedule = (lesson.schedule || [])
    .map((o) => `${dayLabel(o)} ${timeLabel(o)}`.trim())
    .filter(Boolean);
  if (schedule.length) lines.push(`מועדים: ${schedule.join(' · ')}`);

  if (lesson.audience_gender) lines.push(`קהל: ${lesson.audience_gender}`);
  if (lesson.language && lesson.language !== 'עברית') lines.push(`שפה: ${lesson.language}`);
  if (lesson.broadcast === 'recorded' || lesson.broadcast === 'both') lines.push('השיעור מוקלט');
  if (lesson.broadcast === 'live' || lesson.broadcast === 'both') lines.push('משודר בשידור חי');
  if (lesson.contact_phone) lines.push(`לפרטים: ${lesson.contact_phone}`);

  lines.push('', url, `${SITE.name} · מערכת קולית ${SITE.voiceLine}`);
  return lines.join('\n');
}
