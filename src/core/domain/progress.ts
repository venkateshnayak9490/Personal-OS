import { addDays, format, getDay, parseISO, startOfWeek } from 'date-fns';
import type { Goal, Habit, HabitLog, HabitTarget, LocalDate, Milestone, Project, Task } from './types';

/**
 * Honest progress (build.md §11): only Completed counts as done. Skipped counts against the total
 * (it was planned and didn't happen); Cancelled is removed from the total (no longer planned).
 */
export interface Progress {
  done: number;
  total: number;
  /** 0..100 */
  pct: number;
}

const pctOf = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

export function taskProgress(tasks: Task[]): Progress {
  const counted = tasks.filter((t) => !t.deletedAt && !t.parentTaskId && t.status !== 'cancelled');
  const done = counted.filter((t) => t.status === 'completed').length;
  return { done, total: counted.length, pct: pctOf(done, counted.length) };
}

export function projectProgress(project: Project, tasks: Task[], milestones: Milestone[]): Progress {
  if (project.progressMode === 'manual') {
    const pct = Math.max(0, Math.min(100, project.manualProgress ?? 0));
    return { done: pct, total: 100, pct };
  }
  if (project.progressMode === 'milestones') {
    const ms = milestones.filter((m) => !m.deletedAt && m.projectId === project.id);
    const total = ms.reduce((s, m) => s + (m.weight || 1), 0);
    const done = ms.filter((m) => m.doneAt).reduce((s, m) => s + (m.weight || 1), 0);
    return { done, total, pct: pctOf(done, total) };
  }
  return taskProgress(tasks.filter((t) => t.projectId === project.id));
}

/** A goal's progress: its own measure if it has one, otherwise the average of its projects. */
export function goalProgress(goal: Goal, projectPcts: number[]): Progress {
  if (goal.measure && goal.measure.target > 0) {
    const { current, target } = goal.measure;
    return { done: current, total: target, pct: Math.min(100, pctOf(current, target)) };
  }
  if (!projectPcts.length) return { done: 0, total: 0, pct: 0 };
  const pct = Math.round(projectPcts.reduce((a, b) => a + b, 0) / projectPcts.length);
  return { done: pct, total: 100, pct };
}

/* ---------- Habits ---------- */

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/** The schedule a habit had on a date (plans can change; the past keeps its old plan). */
export function targetOn(habit: Habit, date: LocalDate): HabitTarget {
  for (const h of habit.targetHistory ?? []) if (date < h.until) return h.target;
  return habit.target;
}

/** The Monday of a date's week ("yyyy-MM-dd"): the key for week-only changes. */
export const mondayOf = (date: LocalDate) => ymd(startOfWeek(parseISO(date), { weekStartsOn: 1 }));

/** Is the habit expected on this date? (Per-week habits: any day counts.) */
export function isScheduled(habit: Habit, date: LocalDate): boolean {
  const week = habit.weekDays?.[mondayOf(date)];
  if (week) return week.includes(getDay(parseISO(date)));
  const t = targetOn(habit, date);
  if (t.type === 'days') return t.days.includes(getDay(parseISO(date)));
  return true;
}

/**
 * "Mon, Wed, Fri", "Every day", "3× a week". With `date`, a week changed on its own (Gym: Friday made
 * a rest day this week) shows that week's actual days, e.g. "Mon, Wed (this week)".
 */
export function targetLabel(habit: Habit, date?: LocalDate): string {
  const week = date ? habit.weekDays?.[mondayOf(date)] : undefined;
  if (week) return week.length ? `${dayList(week)} (this week)` : 'Rest this week';
  const t = habit.target;
  if (t.type === 'days' && !t.days.length) return 'Paused';
  if (t.type === 'daily') return 'Every day';
  if (t.type === 'perWeek') return `${t.n}× a week`;
  return dayList(t.days);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayList = (days: number[]) =>
  [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d])
    .join(', ');

/** logs for one habit, keyed by date. */
export function logsByDate(logs: HabitLog[], habitId: string): Map<LocalDate, HabitLog> {
  const m = new Map<LocalDate, HabitLog>();
  for (const l of logs) if (l.habitId === habitId && !l.deletedAt) m.set(l.date, l);
  return m;
}

/**
 * Current streak. Gentle by design: rest days never break it, and today doesn't count against you
 * until it's over. Daily/specific-days habits count scheduled days; per-week habits count weeks.
 */
export function streak(
  habit: Habit,
  logs: Map<LocalDate, HabitLog>,
  today: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): number {
  const ok = (d: LocalDate) => {
    const s = logs.get(d)?.status;
    return s === 'done' || s === 'rest';
  };
  if (habit.target.type === 'perWeek') {
    const n = habit.target.n;
    const doneIn = (weekStart: Date) => {
      let c = 0;
      for (let i = 0; i < 7; i++) if (logs.get(ymd(addDays(weekStart, i)))?.status === 'done') c++;
      return c;
    };
    let week = startOfWeek(parseISO(today), { weekStartsOn });
    let count = doneIn(week) >= n ? 1 : 0; // this week counts only once it's met
    for (let i = 0; i < 520; i++) {
      week = addDays(week, -7);
      if (doneIn(week) >= n) count++;
      else break;
    }
    return count;
  }
  let count = 0;
  let d = parseISO(today);
  // Today: counts if done, doesn't break the streak if not yet.
  if (isScheduled(habit, today) && ok(today) && logs.get(today)?.status === 'done') count++;
  for (let i = 0; i < 3650; i++) {
    d = addDays(d, -1);
    const day = ymd(d);
    if (habit.createdAt && d.getTime() < new Date(habit.createdAt).setHours(0, 0, 0, 0)) break;
    if (!isScheduled(habit, day)) continue;
    if (!ok(day)) break;
    if (logs.get(day)?.status === 'done') count++;
  }
  return count;
}

/** Done this week vs. what the target asks for this week. */
export function weekProgress(
  habit: Habit,
  logs: Map<LocalDate, HabitLog>,
  today: LocalDate,
  weekStartsOn: 0 | 1 = 1,
): { done: number; target: number } {
  const start = startOfWeek(parseISO(today), { weekStartsOn });
  let done = 0;
  let scheduled = 0;
  for (let i = 0; i < 7; i++) {
    const day = ymd(addDays(start, i));
    if (logs.get(day)?.status === 'done') done++;
    if (isScheduled(habit, day)) scheduled++;
  }
  const target = habit.target.type === 'perWeek' ? habit.target.n : scheduled;
  return { done, target };
}

/**
 * Adherence over a period, for plan-driven habits like the gym: planned days are the denominator.
 * Done and skipped count against planned days; a planned day in the past with nothing logged is
 * missed; days off the plan (and explicit rest) are rest and never count. Today counts once logged.
 */
export function adherence(
  habit: Habit,
  logs: Map<LocalDate, HabitLog>,
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  weekStartsOn: 0 | 1 = 1,
) {
  const s = { planned: 0, done: 0, skipped: 0, missed: 0, rest: 0, extra: 0 };
  // Days before the habit existed were never planned, so they can't be missed.
  const created = habit.createdAt ? ymd(new Date(habit.createdAt)) : from;
  const start = from > created ? from : created;
  // "N times a week" days are counted per week below, not as N planned days each.
  const weeks = new Map<LocalDate, { n: number; days: number; done: number; skipped: number }>();
  for (let d = parseISO(start); ymd(d) <= to && ymd(d) <= today; d = addDays(d, 1)) {
    const day = ymd(d);
    const l = logs.get(day);
    const t = targetOn(habit, day);
    if (t.type === 'perWeek' && !habit.weekDays?.[mondayOf(day)]) {
      const w = ymd(startOfWeek(d, { weekStartsOn }));
      const g = weeks.get(w) ?? { n: t.n, days: 0, done: 0, skipped: 0 };
      g.days++;
      if (l?.status === 'done') g.done++;
      else if (l?.status === 'skipped') g.skipped++;
      weeks.set(w, g);
      continue;
    }
    if (!isScheduled(habit, day) || l?.status === 'rest') {
      s.rest++;
      if (l?.status === 'done') s.extra++;
      continue;
    }
    const kind =
      l?.status === 'done'
        ? 'done'
        : l?.status === 'skipped'
          ? 'skipped'
          : l?.status === 'missed' || day < today
            ? 'missed'
            : null;
    if (!kind) continue; // today, not logged yet
    s.planned++;
    s[kind]++;
  }
  const thisWeek = ymd(startOfWeek(parseISO(today), { weekStartsOn }));
  for (const [w, g] of weeks) {
    // A week asks n (fewer when only part of it is in range); the current week can't be missed yet.
    const ask = Math.min(g.n, g.days);
    const target = w === thisWeek ? Math.min(g.done + g.skipped, ask) : ask;
    const done = Math.min(g.done, target);
    const skipped = Math.min(g.skipped, target - done);
    s.planned += target;
    s.done += done;
    s.skipped += skipped;
    s.missed += target - done - skipped;
    s.extra += g.done - done;
  }
  return { ...s, pct: s.planned ? Math.round((s.done / s.planned) * 100) : null };
}
