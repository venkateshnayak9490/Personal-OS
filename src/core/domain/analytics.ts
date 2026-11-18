import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { isScheduled } from './progress';
import { toLocalDate } from './tasks';
import type { ActivityLogEntry, Habit, HabitLog, LocalDate, Task } from './types';

/**
 * Honest-progress numbers (build.md §11), computed from what is stored.
 * Days are local dates ("YYYY-MM-DD"); ranges include both ends.
 */

export type PeriodKind = 'day' | 'week' | 'month' | 'year';

export interface Period {
  kind: PeriodKind;
  from: LocalDate;
  to: LocalDate;
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/** The period of `kind` containing `date`, moved by `offset` periods. */
export function periodOf(kind: PeriodKind, date: Date, offset = 0, weekStartsOn: 0 | 1 = 1): Period {
  let start: Date;
  let end: Date;
  if (kind === 'day') {
    start = addDays(date, offset);
    end = start;
  } else if (kind === 'week') {
    start = addWeeks(startOfWeek(date, { weekStartsOn }), offset);
    end = addDays(start, 6);
  } else if (kind === 'month') {
    start = addMonths(startOfMonth(date), offset);
    end = addDays(addMonths(start, 1), -1);
  } else {
    start = addYears(startOfYear(date), offset);
    end = addDays(addYears(start, 1), -1);
  }
  return { kind, from: ymd(start), to: ymd(end) };
}

export function periodLabel(p: Period): string {
  const f = parseISO(p.from);
  if (p.kind === 'day') return format(f, 'EEEE d MMMM yyyy');
  if (p.kind === 'week') return `${format(f, 'd MMM')} – ${format(parseISO(p.to), 'd MMM yyyy')}`;
  if (p.kind === 'month') return format(f, 'MMMM yyyy');
  return format(f, 'yyyy');
}

export const inRange = (d: LocalDate | undefined, from: LocalDate, to: LocalDate) =>
  !!d && d >= from && d <= to;

export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = differenceInCalendarDays(parseISO(to), parseISO(from));
  return Array.from({ length: n + 1 }, (_, i) => ymd(addDays(parseISO(from), i)));
}

/** When each task was closed, from its current status (reopened tasks don't count). */
export interface Closed {
  task: Task;
  status: 'completed' | 'skipped';
  date: LocalDate;
}

export function closedTasks(tasks: Task[], log: ActivityLogEntry[]): Closed[] {
  // Skips have no timestamp on the task; the history has it.
  const skippedAt = new Map<string, number>();
  for (const e of log)
    if (e.entityTable === 'tasks' && e.action === 'skipped')
      skippedAt.set(e.entityId, Math.max(skippedAt.get(e.entityId) ?? 0, e.ts));
  const out: Closed[] = [];
  for (const t of tasks) {
    if (t.deletedAt || t.parentTaskId) continue;
    if (t.status === 'completed' && t.completedAt)
      out.push({ task: t, status: 'completed', date: toLocalDate(t.completedAt) });
    else if (t.status === 'skipped')
      out.push({ task: t, status: 'skipped', date: toLocalDate(skippedAt.get(t.id) ?? t.updatedAt) });
  }
  return out;
}

export interface TaskStats {
  completed: number;
  skipped: number;
  /** Open tasks whose due date in the period has already passed. */
  missed: number;
  /** completed ÷ (completed + skipped + missed); null when there's nothing to judge. */
  rate: number | null;
}

/**
 * Completion rate (build.md §11.2): completed ÷ (completed + skipped + still open and due).
 * Cancelled tasks are left out. A task due today isn't "missed" until the day is over.
 */
export function taskStats(
  tasks: Task[],
  closed: Closed[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): TaskStats {
  const completed = closed.filter((c) => c.status === 'completed' && inRange(c.date, from, to)).length;
  const skipped = closed.filter((c) => c.status === 'skipped' && inRange(c.date, from, to)).length;
  const missed = tasks.filter(
    (t) =>
      !t.deletedAt &&
      !t.parentTaskId &&
      (t.status === 'not_started' || t.status === 'in_progress') &&
      inRange(t.dueDate, from, to) &&
      t.dueDate! < today,
  ).length;
  const all = completed + skipped + missed;
  return { completed, skipped, missed, rate: all ? completed / all : null };
}

/** Completed tasks per day. */
export function completionsByDay(closed: Closed[]): Map<LocalDate, number> {
  const m = new Map<LocalDate, number>();
  for (const c of closed) if (c.status === 'completed') m.set(c.date, (m.get(c.date) ?? 0) + 1);
  return m;
}

/**
 * Habit consistency = done ÷ target over the period, up to today (build.md §11.2).
 * Planned rest days are taken out of the target. Per-week habits ask n per week;
 * the current week only asks what's already been done, so it never counts against you early.
 */
export function habitConsistency(
  habit: Habit,
  logs: Map<LocalDate, HabitLog>,
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): { done: number; target: number } {
  const created = toLocalDate(habit.createdAt);
  const start = from > created ? from : created;
  const end = to < today ? to : today;
  if (start > end) return { done: 0, target: 0 };
  const days = eachDay(start, end);
  const done = days.filter((d) => logs.get(d)?.status === 'done').length;
  if (habit.target.type === 'perWeek') {
    const n = habit.target.n;
    const weeks = new Map<string, number>();
    for (const d of days) {
      const w = ymd(startOfWeek(parseISO(d), { weekStartsOn }));
      weeks.set(w, (weeks.get(w) ?? 0) + (logs.get(d)?.status === 'done' ? 1 : 0));
    }
    const thisWeek = ymd(startOfWeek(parseISO(today), { weekStartsOn }));
    let target = 0;
    for (const [w, c] of weeks) target += w === thisWeek ? Math.min(c, n) : n;
    return { done: Math.min(done, target), target };
  }
  // Today isn't over: it only counts once it's done.
  const target = days.filter(
    (d) =>
      isScheduled(habit, d) &&
      logs.get(d)?.status !== 'rest' &&
      (d !== today || logs.get(d)?.status === 'done'),
  ).length;
  return { done: Math.min(done, target), target };
}

export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/** Questions per review period. Keys are stable; the wording can change. */
export const REVIEW_QUESTIONS: Record<PeriodKind, { key: string; q: string }[]> = {
  day: [
    { key: 'well', q: 'What went well today?' },
    { key: 'blocked', q: 'What got in the way?' },
    { key: 'next', q: 'The one thing that matters most tomorrow?' },
  ],
  week: [
    { key: 'well', q: 'What went well this week?' },
    { key: 'blocked', q: 'What didn’t go as planned, and why?' },
    { key: 'learned', q: 'What did you learn?' },
    { key: 'next', q: 'Top three priorities for next week?' },
  ],
  month: [
    { key: 'well', q: 'Biggest wins this month?' },
    { key: 'change', q: 'What needs to change?' },
    { key: 'next', q: 'Focus for next month?' },
  ],
  year: [
    { key: 'well', q: 'What are you proud of this year?' },
    { key: 'change', q: 'What would you do differently?' },
    { key: 'next', q: 'Themes for next year?' },
  ],
};
