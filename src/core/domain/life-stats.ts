import { cardioTotals, isFinished } from './fitness';
import { onTimeStats, routineSlots, type HealthPlan } from './health';
import { adherence, logsByDate } from './progress';
import type {
  Checkin,
  Habit,
  HabitLog,
  LocalDate,
  ThesisChapter,
  WorkoutSession,
  WorkoutSet,
  WritingLog,
} from './types';

/**
 * Analytics for the life sections, over a period [from, to] (inclusive local dates). Plain numbers
 * from stored history; nothing is recomputed into the records.
 */

const inPeriod = (d: LocalDate, from: LocalDate, to: LocalDate) => d >= from && d <= to;

/** Gym: workouts done (ended), time trained, cardio, and the plan (planned/done/skipped/missed). */
export function gymStats(
  sessions: WorkoutSession[],
  sets: WorkoutSet[],
  gymHabit: Habit | undefined,
  logs: HabitLog[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
) {
  const done = sessions.filter((w) => !w.deletedAt && isFinished(w) && inPeriod(w.date, from, to));
  const minutes = Math.round(
    done.reduce((m, w) => m + (w.startedAt && w.endedAt ? (w.endedAt - w.startedAt) / 60_000 : 0), 0),
  );
  const perDay = new Map<LocalDate, number>();
  for (const w of done) perDay.set(w.date, (perDay.get(w.date) ?? 0) + 1);
  const plan = gymHabit ? adherence(gymHabit, logsByDate(logs, gymHabit.id), from, to, today) : null;
  return { workouts: done.length, minutes, perDay, cardio: cardioTotals(sets, sessions, from, to), plan };
}

/** Health: on-time record, average sleep, water target days, and repeating plan items done. */
export function healthStats(plan: HealthPlan, checkins: Checkin[], from: LocalDate, to: LocalDate) {
  const inside = checkins.filter((c) => !c.deletedAt && inPeriod(c.date, from, to));
  const onTime = onTimeStats(plan, inside);
  const slept = inside.filter((c) => typeof c.sleepH === 'number' && c.sleepH > 0);
  const sleepAvg = slept.length
    ? Math.round((slept.reduce((s, c) => s + c.sleepH!, 0) / slept.length) * 10) / 10
    : null;
  let due = 0;
  let marked = 0;
  for (const c of inside)
    for (const r of plan.routines ?? []) {
      const slots = routineSlots(r, c.date);
      due += slots.length;
      marked += (c.routineDone?.[r.id] ?? []).filter((t) => slots.includes(t)).length;
    }
  const meals = {
    logged: onTime.breakfast.logged + onTime.lunch.logged + onTime.dinner.logged,
    onTime: onTime.breakfast.onTime + onTime.lunch.onTime + onTime.dinner.onTime,
  };
  return { days: inside.length, sleepAvg, onTime, meals, routines: { due, marked } };
}

/** Thesis: words written (net change, edits that cut words count too), sessions, time, overall. */
export function thesisStats(logs: WritingLog[], chapters: ThesisChapter[], from: LocalDate, to: LocalDate) {
  const inside = logs.filter((l) => !l.deletedAt && inPeriod(l.date, from, to));
  const live = chapters.filter((c) => !c.deletedAt);
  const perDay = new Map<LocalDate, number>();
  for (const l of inside) perDay.set(l.date, (perDay.get(l.date) ?? 0) + l.delta);
  return {
    words: inside.reduce((s, l) => s + l.delta, 0),
    sessions: inside.length,
    days: perDay.size,
    minutes: inside.reduce((s, l) => s + (l.minutes ?? 0), 0),
    perDay,
    current: live.reduce((s, c) => s + c.currentWords, 0),
    target: live.reduce((s, c) => s + c.targetWords, 0),
  };
}
