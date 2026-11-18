import { deadlineInstant, isDeadline, isDone } from './collections';
import { dueInstant, isClosed, toLocalDate } from './tasks';
import type { CalendarEvent, Collection, CollectionRecord, Habit, Task } from './types';

/**
 * iCalendar (.ics) export (build.md P5): import it into Google Calendar or your phone's calendar,
 * which can then remind you even while Personal OS is closed (challenge C1).
 */

const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
const utc = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const day = (d: string) => d.replace(/-/g, '');
const nextDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const n = new Date(Date.UTC(y, m - 1, dd + 1));
  return n.toISOString().slice(0, 10).replace(/-/g, '');
};

/** Lines longer than 75 octets are folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

interface Item {
  uid: string;
  title: string;
  start: { ms: number } | { date: string };
  end?: { ms: number } | { date: string };
  rrule?: string;
  description?: string;
  location?: string;
  /** Minutes before the start to remind. */
  alarms?: number[];
}

function vevent(i: Item, stamp: string): string[] {
  const when = (k: 'DTSTART' | 'DTEND', v: Item['start']) =>
    'ms' in v ? `${k}:${utc(v.ms)}` : `${k};VALUE=DATE:${day(v.date)}`;
  const end = i.end ?? ('date' in i.start ? { date: '' } : { ms: i.start.ms });
  const lines = [
    'BEGIN:VEVENT',
    `UID:${i.uid}@personal-os`,
    `DTSTAMP:${stamp}`,
    when('DTSTART', i.start),
    // All-day ends are exclusive: the day after.
    'date' in end
      ? `DTEND;VALUE=DATE:${end.date ? day(end.date) : nextDay((i.start as { date: string }).date)}`
      : when('DTEND', end),
    `SUMMARY:${esc(i.title)}`,
  ];
  if (i.rrule) lines.push(`RRULE:${i.rrule}`);
  if (i.location) lines.push(`LOCATION:${esc(i.location)}`);
  if (i.description) lines.push(`DESCRIPTION:${esc(i.description)}`);
  for (const m of i.alarms ?? [])
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(i.title)}`,
      `TRIGGER:-PT${m}M`,
      'END:VALARM',
    );
  lines.push('END:VEVENT');
  return lines;
}

export function toICS(
  data: {
    events: CalendarEvent[];
    tasks: Task[];
    collections: Collection[];
    records: CollectionRecord[];
    habits?: Habit[];
  },
  now = Date.now(),
  defaultTz?: string,
): string {
  const items: Item[] = [];
  for (const e of data.events) {
    if (e.deletedAt) continue;
    items.push({
      uid: e.id,
      title: e.title,
      start: e.allDay ? { date: toLocalDate(e.start) } : { ms: e.start },
      end: e.allDay ? { date: toLocalDate(e.end) } : { ms: e.end },
      rrule: e.rrule,
      location: e.location,
      description: e.description,
      alarms: e.reminderOffsetsMin,
    });
  }
  // Habits with a reminder time: a repeating 15-minute slot with an alarm, so the phone's calendar
  // reminds even when this app is closed (it can't know whether you've already done it).
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  for (const h of data.habits ?? []) {
    if (h.deletedAt || !h.remindAt) continue;
    const at = dueInstant({ dueDate: toLocalDate(now, defaultTz), dueTime: h.remindAt }, defaultTz)!;
    items.push({
      uid: `habit-${h.id}`,
      title: `↻ ${h.title}`,
      start: { ms: at },
      end: { ms: at + 15 * 60_000 },
      rrule:
        h.target.type === 'days'
          ? `FREQ=WEEKLY;BYDAY=${h.target.days.map((d) => BYDAY[d]).join(',')}`
          : 'FREQ=DAILY',
      alarms: [0],
      description: h.note,
    });
  }
  // Open tasks with a due date: timed ones remind at the due time.
  for (const t of data.tasks) {
    if (t.deletedAt || t.parentTaskId || isClosed(t.status) || !t.dueDate) continue;
    const at = t.dueTime ? dueInstant(t, defaultTz) : null;
    items.push({
      uid: `task-${t.id}`,
      title: `☐ ${t.title}`,
      start: at !== null ? { ms: at } : { date: t.dueDate },
      ...(at !== null ? { end: { ms: at + 15 * 60_000 }, alarms: [0] } : {}),
      description: t.description,
    });
  }
  // List dates and deadlines; birthdays repeat every year.
  const byId = new Map(data.collections.map((c) => [c.id, c]));
  for (const r of data.records) {
    const c = byId.get(r.collectionId);
    if (!c || c.deletedAt || r.deletedAt || isDone(c, r)) continue;
    for (const f of c.fields) {
      const v = r.custom[f.key];
      const title = `${r.title} · ${f.name}`;
      if (f.type === 'deadline' && isDeadline(v)) {
        const at = deadlineInstant(v, defaultTz);
        items.push({
          uid: `rec-${r.id}-${f.key}`,
          title,
          start: { ms: at },
          end: { ms: at },
          alarms: [24 * 60, 120],
        });
      } else if (f.type === 'date' && typeof v === 'string' && v)
        items.push({
          uid: `rec-${r.id}-${f.key}`,
          title,
          start: { date: v },
          ...(f.yearly ? { rrule: 'FREQ=YEARLY' } : {}),
        });
    }
  }
  const stamp = utc(now);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal OS//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Personal OS',
    ...items.flatMap((i) => vevent(i, stamp)),
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')
    .concat('\r\n');
}
