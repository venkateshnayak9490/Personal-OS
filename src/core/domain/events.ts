import { format } from 'date-fns';
import type { CalendarEvent } from './types';
import { nextDate, parseRRule } from './recurrence';

export interface Occurrence {
  event: CalendarEvent;
  start: number;
  end: number;
}

const dayOf = (ms: number) => format(ms, 'yyyy-MM-dd');

/** Same wall-clock time as `ms`, moved to `date` (keeps 9:00 at 9:00 across DST). */
function onDate(ms: number, date: string): number {
  const src = new Date(ms);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, src.getHours(), src.getMinutes()).getTime();
}

/** Occurrences of an event that overlap [from, to). Recurring events repeat from their first start. */
export function occurrences(ev: CalendarEvent, from: number, to: number): Occurrence[] {
  const len = ev.end - ev.start;
  if (!ev.rrule) return ev.start < to && ev.end > from ? [{ event: ev, start: ev.start, end: ev.end }] : [];
  const rule = parseRRule(ev.rrule);
  const out: Occurrence[] = [];
  let date = dayOf(ev.start);
  for (let i = 0; i < 5000; i++) {
    const start = onDate(ev.start, date);
    if (start >= to) break;
    if (start + len > from) out.push({ event: ev, start, end: start + len });
    date = nextDate(rule, date);
  }
  return out;
}
