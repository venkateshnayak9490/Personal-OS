/**
 * The Actual layer (docs/proposals/ADAPTIVE_DAY_AND_PUSH.md §4): when timed tasks really started,
 * against the plan and against the adjusted plan. Only what you recorded counts (Start, or a focus
 * session on the task); a time passing never marks anything.
 */
import { parseISO } from 'date-fns';
import { adjustedOf } from './day-input';
import { toMin } from './health';
import type { DayPlan, FocusSession, LocalDate, Task } from './types';

/** Started up to this late still counts as on time. */
export const START_SLACK_MIN = 15;

export interface StartStats {
  /** Timed tasks with a recorded start on their day. */
  started: number;
  onTimePlan: number;
  /** Against the adjusted time where the day was adjusted, else the plan. */
  onTimeAdjusted: number;
  /** Average start minus planned time (minutes; negative is early), or null. */
  avgLateMin: number | null;
  partly: number;
  deferred: number;
}

export function startStats(
  tasks: Task[],
  sessions: FocusSession[],
  dayPlans: DayPlan[],
  from: LocalDate,
  to: LocalDate,
): StartStats {
  const s: StartStats = {
    started: 0,
    onTimePlan: 0,
    onTimeAdjusted: 0,
    avgLateMin: null,
    partly: 0,
    deferred: 0,
  };
  let late = 0;
  for (const t of tasks) {
    if (t.deletedAt) continue;
    for (const o of t.outcomes ?? []) if (o.date >= from && o.date <= to) s[o.kind]++;
    if (!t.dueDate || !t.dueTime || t.parentTaskId || t.dueDate < from || t.dueDate > to) continue;
    const dayStart = parseISO(t.dueDate).getTime();
    const dayEnd = dayStart + 86_400_000;
    const inDay = (at?: number) => at !== undefined && at >= dayStart && at < dayEnd;
    const focus = sessions
      .filter((f) => f.taskId === t.id && !f.deletedAt && inDay(f.start))
      .map((f) => f.start);
    const starts = [...(inDay(t.startedAt) ? [t.startedAt!] : []), ...focus];
    if (!starts.length) continue;
    const actual = (Math.min(...starts) - dayStart) / 60_000;
    const planned = toMin(t.dueTime);
    const adjusted = adjustedOf(dayPlans.find((d) => d.date === t.dueDate)).get(`tasks:${t.id}`) ?? planned;
    s.started++;
    late += actual - planned;
    if (actual - planned <= START_SLACK_MIN) s.onTimePlan++;
    if (actual - adjusted <= START_SLACK_MIN) s.onTimeAdjusted++;
  }
  if (s.started) s.avgLateMin = Math.round(late / s.started);
  return s;
}
