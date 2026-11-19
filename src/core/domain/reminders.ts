import { datedLabel, type DatedItem } from './collections';
import type { CalendarEvent, EntityRef, Habit, Task } from './types';
import { occurrences } from './events';
import { isScheduled } from './progress';
import { dueInstant, isClosed, toLocalDate } from './tasks';

/** A reminder older than this is no longer worth showing (the app was closed through it). */
export const REMINDER_WINDOW_MS = 6 * 3_600_000;

/**
 * Reminding again until it's done: every `everyMin` minutes after the first reminder, outside quiet
 * hours ("HH:mm" from–to, e.g. 22:30–07:00). Only the latest round is returned, so they never pile up.
 */
export interface Repeat {
  everyMin: number;
  quiet: [string, string];
}

/** Default repeat: every hour until done. */
export const DEFAULT_REPEAT_MIN = 60;

/** The repeat settings from the profile (older profiles stored hours). */
export function repeatOf(
  settings: Record<string, unknown> | undefined,
  quietFallback: [string, string],
): Repeat {
  const min =
    (settings?.remindEveryMin as number | undefined) ??
    (settings?.remindEveryH !== undefined ? Number(settings.remindEveryH) * 60 : DEFAULT_REPEAT_MIN);
  const q = settings?.remindQuiet as [string, string] | undefined;
  return { everyMin: min, quiet: q ?? quietFallback };
}

const minutesOf = (ms: number, tz?: string) => {
  const d = tz ? new Date(new Date(ms).toLocaleString('en-US', { timeZone: tz })) : new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
function inQuiet(ms: number, [from, to]: [string, string], tz?: string) {
  const m = minutesOf(ms, tz);
  const a = hm(from);
  const b = hm(to);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

/** The latest reminder round at or before `now` for something first due at `base`, or null. */
export function latestRound(base: number, now: number, r: Repeat, tz?: string): number | null {
  if (base > now) return null;
  if (r.everyMin <= 0) return base > now - REMINDER_WINDOW_MS && !inQuiet(base, r.quiet, tz) ? base : null;
  const every = r.everyMin * 60_000;
  const round = base + Math.floor((now - base) / every) * every;
  return inQuiet(round, r.quiet, tz) ? null : round;
}

/** Morning reminder time for tasks with only a date. */
export const DATE_ONLY_AT = '09:00';

export interface DueReminder {
  target: EntityRef;
  title: string;
  fireAt: number;
  /** When the thing itself happens: event start or task due time. */
  at: number;
}

/**
 * Reminders that should have fired by `now` (and not too long ago).
 * Events: each `reminderOffsetsMin` before each occurrence's start, until it ends.
 * Tasks: at their due time, if they have one and are still open.
 * Habits: at `remindAt` on days they're scheduled, unless in `quiet` (checked in today, or the week's
 * target is already met). A habit's own `remindRepeatMin` (0 = just once) beats the default.
 * Tasks may also remind `remindBeforeMin` minutes before they're due (once each).
 */
export function dueReminders(
  events: CalendarEvent[],
  tasks: Task[],
  now: number,
  defaultTz?: string,
  habits: Habit[] = [],
  quiet: Set<string> = new Set(),
  repeat?: Repeat,
): DueReminder[] {
  const out: DueReminder[] = [];
  const from = now - REMINDER_WINDOW_MS;
  for (const ev of events) {
    if (ev.deletedAt || !ev.reminderOffsetsMin.length) continue;
    const lead = Math.max(...ev.reminderOffsetsMin) * 60_000;
    for (const o of occurrences(ev, now, now + lead + 1)) {
      for (const off of ev.reminderOffsetsMin) {
        const fireAt = o.start - off * 60_000;
        if (fireAt <= now && fireAt > from)
          out.push({ target: { table: 'events', id: ev.id }, title: ev.title, fireAt, at: o.start });
      }
    }
  }
  for (const t of tasks) {
    if (t.deletedAt || isClosed(t.status) || !t.dueDate || t.parentTaskId) continue;
    if (!t.dueTime) {
      // Date-only deadlines: with repeating on, a morning reminder from the due day until done.
      if (!repeat) continue;
      const base = dueInstant({ dueDate: t.dueDate, dueTime: DATE_ONLY_AT }, t.timezone ?? defaultTz)!;
      const round = latestRound(base, now, repeat, defaultTz);
      if (round !== null)
        out.push({ target: { table: 'tasks', id: t.id }, title: t.title, fireAt: round, at: base });
      continue;
    }
    const at = dueInstant(t, defaultTz)!;
    // Advance reminders ("1 hour before"): once each, while still ahead of the deadline.
    for (const before of t.remindBeforeMin ?? []) {
      const fireAt = at - before * 60_000;
      if (fireAt <= now && now < at && fireAt > from)
        out.push({ target: { table: 'tasks', id: t.id }, title: t.title, fireAt, at });
    }
    const round = repeat ? latestRound(at, now, repeat, defaultTz) : at <= now && at > from ? at : null;
    if (round !== null) out.push({ target: { table: 'tasks', id: t.id }, title: t.title, fireAt: round, at });
  }
  const today = toLocalDate(now, defaultTz);
  for (const h of habits) {
    if (h.deletedAt || !h.remindAt || quiet.has(h.id) || !isScheduled(h, today)) continue;
    const at = dueInstant({ dueDate: today, dueTime: h.remindAt }, defaultTz)!;
    const own =
      h.remindRepeatMin !== undefined && repeat ? { ...repeat, everyMin: h.remindRepeatMin } : repeat;
    const round = own ? latestRound(at, now, own, defaultTz) : at <= now && at > from ? at : null;
    if (round !== null)
      out.push({ target: { table: 'habits', id: h.id }, title: h.title, fireAt: round, at });
  }
  return out;
}

/** Yearly dates (birthdays, anniversaries, occasions) happening today: a reminder at 9:00. */
export function occasionReminders(today: DatedItem[], date: string, now: number, tz?: string): DueReminder[] {
  const at = dueInstant({ dueDate: date, dueTime: '09:00' }, tz)!;
  if (at > now || at <= now - REMINDER_WINDOW_MS) return [];
  return today
    .filter((d) => d.field.yearly)
    .map((d) => ({
      target: { table: 'records', id: `${d.record.id}:${d.field.key}` },
      title: `Today: ${d.record.title} · ${datedLabel(d)}`,
      fireAt: at,
      at,
    }));
}

export const reminderKey = (r: { target: EntityRef; fireAt: number }) =>
  `${r.target.table}:${r.target.id}:${r.fireAt}`;
