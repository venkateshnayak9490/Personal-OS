import { TZDate } from '@date-fns/tz';
import type { LocalDate, Priority, Task, TaskKind, TaskStatus } from './types';

/** "Anywhere on Earth" (UTC−12). IANA's Etc/GMT+12 means UTC−12 (the sign is inverted by POSIX convention). */
export const AOE_TZ = 'Etc/GMT+12';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };

export const KIND_LABEL: Record<TaskKind, string> = {
  general: 'General',
  daily: 'Daily',
  deadline: 'Deadline',
  learning: 'Learning',
  long_term: 'Long-term',
};

/** Statuses that close a task. Only `completed` counts as done (build.md §11.1). */
export function isClosed(status: TaskStatus): boolean {
  return status === 'completed' || status === 'skipped' || status === 'cancelled';
}

/** Local calendar date of an instant, in a timezone (default: the device's). */
export function toLocalDate(ms: number, timeZone?: string): LocalDate {
  const d = timeZone ? new TZDate(ms, timeZone) : new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The instant a task becomes overdue.
 * - With a time: that wall-clock time in the task's timezone (or the given default zone).
 * - Date only: the end of that day (i.e. the start of the next day).
 */
export function dueInstant(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'timezone'>,
  defaultTz?: string,
): number | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split('-').map(Number) as [number, number, number];
  const tz = task.timezone ?? defaultTz;
  if (task.dueTime) {
    const [hh, mm] = task.dueTime.split(':').map(Number) as [number, number];
    return tz ? new TZDate(y, m - 1, d, hh, mm, tz).getTime() : new Date(y, m - 1, d, hh, mm).getTime();
  }
  return tz ? new TZDate(y, m - 1, d + 1, 0, 0, tz).getTime() : new Date(y, m - 1, d + 1).getTime();
}

/** Overdue is DERIVED, never stored: past due and not completed/skipped/cancelled. */
export function isOverdue(task: Task, now: number = Date.now(), defaultTz?: string): boolean {
  if (isClosed(task.status) || task.deletedAt) return false;
  const due = dueInstant(task, defaultTz);
  return due !== null && now >= due;
}

/**
 * Sort for task lists: open tasks first (overdue → soonest due → priority → oldest),
 * then closed tasks (most recently closed first).
 */
export function compareTasks(a: Task, b: Task, now: number = Date.now()): number {
  const ac = isClosed(a.status);
  const bc = isClosed(b.status);
  if (ac !== bc) return ac ? 1 : -1;
  if (ac && bc) return (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt);
  const ao = isOverdue(a, now);
  const bo = isOverdue(b, now);
  if (ao !== bo) return ao ? -1 : 1;
  const ad = dueInstant(a) ?? Infinity;
  const bd = dueInstant(b) ?? Infinity;
  if (ad !== bd) return ad - bd;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.createdAt - b.createdAt;
}

/** Human label for a due date relative to today: "Today", "Tomorrow", "Yesterday", "Fri 20 Nov", "20 Nov 2027". */
export function dueLabel(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'timezone'>,
  now: number = Date.now(),
): string | null {
  if (!task.dueDate) return null;
  const today = toLocalDate(now);
  const [y, m, d] = task.dueDate.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const t = new Date(now);
  const startToday = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const days = Math.round((date.getTime() - startToday.getTime()) / 86_400_000);
  let label: string;
  if (task.dueDate === today) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else if (days === -1) label = 'Yesterday';
  else if (days > 1 && days < 7)
    label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  else
    label = date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      ...(y !== t.getFullYear() ? { year: 'numeric' } : {}),
    });
  if (task.dueTime) label += ` ${task.dueTime}`;
  if (task.timezone === AOE_TZ) label += ' AoE';
  return label;
}
