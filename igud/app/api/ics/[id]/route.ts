import { NextResponse } from 'next/server';
import { publicClient, supabaseConfigured } from '@/lib/supabase';
import { fetchLesson } from '@/lib/queries';
import { addressLine, lessonTitle, placeName, rabbiName } from '@/lib/format';
import { SITE } from '@/lib/site';

export const revalidate = 300;

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function fold(line: string): string {
  // תקן iCalendar: שורה עד 75 בתים, המשך בשורה עם רווח מוביל
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 74) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > 72) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n ');
}

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** מועד מקומי בירושלים בתבנית ICS. */
function localStamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!supabaseConfigured) {
    return NextResponse.json({ error: 'המאגר אינו מחובר' }, { status: 503 });
  }

  const lesson = await fetchLesson(publicClient(), id).catch(() => null);
  if (!lesson) return NextResponse.json({ error: 'השיעור לא נמצא' }, { status: 404 });

  const title = `${lessonTitle(lesson)} · ${rabbiName(lesson.teacher_name)}`;
  const location = [placeName(lesson), addressLine(lesson)].filter(Boolean).join(', ');
  const url = `${SITE.url}/lesson/${lesson.id}`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//igud-hashiurim//NONSGML v1.0//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(title)}`,
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Jerusalem',
    'X-LIC-LOCATION:Asia/Jerusalem',
    'END:VTIMEZONE',
  ];

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  (lesson.schedule || []).forEach((occ, index) => {
    const time = occ.time ? String(occ.time).slice(0, 5) : null;
    if (!time) return;

    let start: string;
    let rrule: string | null = null;

    if (occ.date) {
      start = localStamp(occ.date, time);
    } else if (occ.weekday !== null && occ.weekday !== undefined) {
      // המופע הקרוב של אותו יום בשבוע
      const base = new Date(`${today}T00:00:00Z`);
      const diff = (occ.weekday - base.getUTCDay() + 7) % 7;
      base.setUTCDate(base.getUTCDate() + diff);
      start = localStamp(base.toISOString().slice(0, 10), time);
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[occ.weekday]}`;
    } else {
      return;
    }

    const endHour = String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, '0');
    const end = `${start.slice(0, 9)}${endHour}${start.slice(11)}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${lesson.id}-${index}@igud-hashiurim`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;TZID=Asia/Jerusalem:${start}`);
    lines.push(`DTEND;TZID=Asia/Jerusalem:${end}`);
    if (rrule) lines.push(rrule);
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (location) lines.push(fold(`LOCATION:${esc(location)}`));
    lines.push(fold(`DESCRIPTION:${esc([lesson.description, url].filter(Boolean).join('\n'))}`));
    lines.push(`URL:${url}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="igud-${lesson.public_no}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
