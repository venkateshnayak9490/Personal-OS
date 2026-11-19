import { occurrences } from './events';
import { isScheduled } from './progress';
import { dueInstant, isClosed, toLocalDate } from './tasks';
import type { CalendarEvent, Habit, HabitLog, Task } from './types';

/** Away for longer than this (app closed or tab hidden), and opening it shows what you missed. */
export const AWAY_AFTER_MS = 30 * 60_000;

export interface Missed {
  kind: 'event' | 'task' | 'habit';
  id: string;
  title: string;
  at: number;
}

/**
 * What came due while the app was closed, between `from` and `to`: events that started, tasks that
 * fell due and are still open, and habit reminders (today) not yet checked in. Oldest first.
 */
export function missedWhileAway(
  gap: { from: number; to: number },
  data: { events: CalendarEvent[]; tasks: Task[]; habits: Habit[]; logs: HabitLog[] },
  tz?: string,
): Missed[] {
  const inGap = (t: number | null) => t !== null && t > gap.from && t <= gap.to;
  const out: Missed[] = [];
  for (const ev of data.events) {
    if (ev.deletedAt) continue;
    for (const o of occurrences(ev, gap.from + 1, gap.to + 1))
      if (inGap(o.start)) out.push({ kind: 'event', id: ev.id, title: ev.title, at: o.start });
  }
  for (const t of data.tasks) {
    if (t.deletedAt || isClosed(t.status) || t.parentTaskId) continue;
    const at = dueInstant(t, tz);
    if (inGap(at)) out.push({ kind: 'task', id: t.id, title: t.title, at: at! });
  }
  const today = toLocalDate(gap.to, tz);
  for (const h of data.habits) {
    if (h.deletedAt || !h.remindAt || !isScheduled(h, today)) continue;
    if (data.logs.some((l) => l.habitId === h.id && l.date === today && !l.deletedAt)) continue;
    const at = dueInstant({ dueDate: today, dueTime: h.remindAt }, tz);
    if (inGap(at)) out.push({ kind: 'habit', id: h.id, title: h.title, at: at! });
  }
  return out.sort((a, b) => a.at - b.at);
}
