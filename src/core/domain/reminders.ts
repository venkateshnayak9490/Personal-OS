import { datedLabel, type DatedItem } from './collections';
import type { CalendarEvent, EntityRef, Habit, Task } from './types';
import { occurrences } from './events';
import { isScheduled } from './progress';
import { dueInstant, isClosed, toLocalDate } from './tasks';

/** A reminder older than this is no longer worth showing (the app was closed through it). */
export const REMINDER_WINDOW_MS = 6 * 3_600_000;

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
 * target is already met).
 */
export function dueReminders(
  events: CalendarEvent[],
  tasks: Task[],
  now: number,
  defaultTz?: string,
  habits: Habit[] = [],
  quiet: Set<string> = new Set(),
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
    if (t.deletedAt || !t.dueTime || isClosed(t.status)) continue;
    const at = dueInstant(t, defaultTz);
    if (at !== null && at <= now && at > from)
      out.push({ target: { table: 'tasks', id: t.id }, title: t.title, fireAt: at, at });
  }
  const today = toLocalDate(now, defaultTz);
  for (const h of habits) {
    if (h.deletedAt || !h.remindAt || quiet.has(h.id) || !isScheduled(h, today)) continue;
    const at = dueInstant({ dueDate: today, dueTime: h.remindAt }, defaultTz)!;
    if (at <= now && at > from)
      out.push({ target: { table: 'habits', id: h.id }, title: h.title, fireAt: at, at });
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
