import { isFinished } from './fitness';
import { focusMinutes } from './focus';
import { toLocalDate } from './tasks';
import type {
  CollectionRecord,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  WorkoutSession,
  WritingLog,
} from './types';

/** Everything a goal can count from. */
export interface GoalData {
  habits: Habit[];
  habitLogs: HabitLog[];
  workouts: WorkoutSession[];
  writing: WritingLog[];
  focus: FocusSession[];
  records: CollectionRecord[];
}

/** Does this goal count itself (from habits or another source), rather than by hand? */
export const isAutomatic = (g: Pick<Goal, 'measure'>) => !!(g.measure?.fromHabits || g.measure?.source);

/**
 * What a self-counting goal is at now. Everything counts from the day the goal was made, except a
 * list status ("Papers in Read"), which is the items in that status now. Hand-counted: as typed.
 */
export function measuredCurrent(g: Goal, d: GoalData): number {
  const m = g.measure;
  if (!m) return 0;
  const from = toLocalDate(g.createdAt);
  if (m.fromHabits) {
    const ids = new Set(d.habits.filter((h) => h.goalId === g.id).map((h) => h.id));
    return d.habitLogs.filter(
      (l) => ids.has(l.habitId) && l.status === 'done' && l.date >= from && !l.deletedAt,
    ).length;
  }
  const s = m.source;
  if (!s) return m.current;
  if (s.kind === 'workouts')
    return d.workouts.filter((w) => !w.deletedAt && isFinished(w) && w.date >= from).length;
  if (s.kind === 'words')
    return Math.max(
      0,
      d.writing.filter((l) => !l.deletedAt && l.date >= from).reduce((sum, l) => sum + l.delta, 0),
    );
  if (s.kind === 'focus') return Math.floor(focusMinutes(d.focus, g.createdAt, Infinity) / 60);
  return d.records.filter((r) => !r.deletedAt && r.collectionId === s.collectionId && r.status === s.status)
    .length;
}
