import { generateKeyBetween } from 'fractional-indexing';
import {
  dayFor,
  isWaterItem,
  DEFAULT_PLAN,
  planOf,
  routineProblem,
  sleepHours,
  stampAt,
  type HealthRoutine,
} from '@/core/domain/health';
import { newId } from '@/core/domain/entity';
import { updateProfileSettings } from './profile';
import { isFinished, plannedOn, trainingDaysOf, weekDates, weekPlan } from '@/core/domain/fitness';
import { isScheduled, mondayOf } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
import { createHabit, setHabitLog, updateHabit } from './plans';
import { db } from '@/core/db';
import type {
  ChapterStatus,
  Checkin,
  HealthEvent,
  HealthStamp,
  ThesisChapter,
  WorkoutSession,
  WorkoutSet,
  Routine,
  HabitTarget,
  WeekSlot,
  WritingLog,
} from '@/core/domain/types';
import { restoreFromTrash } from './trash';
import { insert, patch, softDeleteBatch } from './write';

/** Thesis writing, workouts and daily check-ins. */

const lastOrder = (rows: { order: string; deletedAt?: number }[]) =>
  generateKeyBetween(
    rows
      .filter((r) => !r.deletedAt)
      .map((r) => r.order)
      .sort()
      .at(-1) ?? null,
    null,
  );

const whole = (n: number, what: string) => {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${what} must be 0 or more`);
  return Math.round(n);
};

/* ---------- Thesis ---------- */

export async function createChapter(title: string, targetWords = 5000): Promise<ThesisChapter> {
  const t = title.trim();
  if (!t) throw new Error('A chapter needs a name');
  return insert<ThesisChapter>('thesisChapters', {
    title: t,
    targetWords: whole(targetWords, 'Target'),
    currentWords: 0,
    status: 'outline',
    order: lastOrder(await db.thesisChapters.toArray()),
  });
}

export async function updateChapter(
  id: string,
  changes: Partial<{ title: string; targetWords: number; status: ChapterStatus }>,
) {
  if (changes.title !== undefined && !changes.title.trim()) throw new Error('A chapter needs a name');
  if (changes.targetWords !== undefined) changes.targetWords = whole(changes.targetWords, 'Target');
  return patch<ThesisChapter>('thesisChapters', id, changes);
}

/** A chapter goes to Trash with its writing log. */
export async function deleteChapter(id: string) {
  const logs = (await db.writingLogs.where('chapterId').equals(id).toArray()).filter((l) => !l.deletedAt);
  return softDeleteBatch([
    { tableName: 'thesisChapters', id },
    ...logs.map((l) => ({ tableName: 'writingLogs' as const, id: l.id })),
  ]);
}

/**
 * Log a writing session by the chapter's new word count (what your editor shows).
 * The change since last time is worked out for you; cutting words counts too (it's editing).
 */
export async function logWriting(chapterId: string, words: number, date: string, minutes?: number) {
  const ch = await db.thesisChapters.get(chapterId);
  if (!ch || ch.deletedAt) throw new Error('This chapter no longer exists');
  const w = whole(words, 'Word count');
  const log = await insert<WritingLog>('writingLogs', {
    date,
    chapterId,
    words: w,
    delta: w - ch.currentWords,
    ...(minutes ? { minutes: whole(minutes, 'Minutes') } : {}),
  });
  await patch<ThesisChapter>('thesisChapters', chapterId, {
    currentWords: w,
    ...(ch.status === 'outline' && w > 0 ? { status: 'drafting' as const } : {}),
  });
  return log;
}

/* ---------- Workouts ---------- */

/** Start a workout: the start time is recorded now. */
export async function createWorkout(
  date: string,
  nodeId?: string,
  title = 'Workout',
  from?: { routineId: string; dayIndex: number },
  startedAt = Date.now(),
): Promise<WorkoutSession> {
  return insert<WorkoutSession>('workoutSessions', {
    date,
    nodeId,
    title: title.trim() || 'Workout',
    startedAt,
    ...from,
  });
}

/**
 * Start workout (from Gym or from the Gym habit in Habits): a workout already in progress that day
 * is picked up again instead of making a second one.
 */
export async function startWorkout(
  date: string,
  nodeId?: string,
  title = 'Workout',
  from?: { routineId: string; dayIndex: number },
) {
  const open = (await db.workoutSessions.where('date').equals(date).toArray()).find(
    (w) => !w.deletedAt && !isFinished(w),
  );
  return open ?? createWorkout(date, nodeId, title, from);
}

type WorkoutChanges = Partial<Pick<WorkoutSession, 'title' | 'date' | 'notes' | 'startedAt' | 'endedAt'>>;

/** Edit a session (also its start and end). The Gym habit follows a change of date or end. */
export async function updateWorkout(id: string, changes: WorkoutChanges) {
  const before = await db.workoutSessions.get(id);
  if (!before || before.deletedAt) throw new Error('This workout no longer exists');
  const start = 'startedAt' in changes ? changes.startedAt : before.startedAt;
  const end = 'endedAt' in changes ? changes.endedAt : before.endedAt;
  if (start && end && end < start) throw new Error('The end can’t be before the start');
  const out = await patch<WorkoutSession>('workoutSessions', id, changes);
  const moved = changes.date !== undefined && changes.date !== before.date;
  if ('endedAt' in changes || moved) {
    await resyncGymDay(before.date);
    if (moved) await resyncGymDay(changes.date!);
  }
  return out;
}

/** End workout: records the end (duration = end - start) and completes that day's Gym habit. */
export const endWorkout = (id: string, at = Date.now()) => updateWorkout(id, { endedAt: at });

export async function deleteWorkout(id: string) {
  const w = await db.workoutSessions.get(id);
  const sets = (await db.workoutSets.where('sessionId').equals(id).toArray()).filter((s) => !s.deletedAt);
  const batch = await softDeleteBatch([
    { tableName: 'workoutSessions', id },
    ...sets.map((s) => ({ tableName: 'workoutSets' as const, id: s.id })),
  ]);
  if (w) await resyncGymDay(w.date);
  return batch;
}

/** Undo of a delete: the session comes back and counts for its day again. */
export async function restoreWorkout(batch: string, id: string) {
  await restoreFromTrash(batch);
  const w = await db.workoutSessions.get(id);
  if (w) await resyncGymDay(w.date);
}

export async function addSet(sessionId: string, exercise: string, reps: number, weight: number) {
  const name = exercise.trim();
  if (!name) throw new Error('Which exercise?');
  if (!(reps >= 1)) throw new Error('At least 1 rep');
  if (!(weight >= 0)) throw new Error('Weight can’t be negative');
  return insert<WorkoutSet>('workoutSets', {
    sessionId,
    exercise: name,
    reps: Math.round(reps),
    weight: Math.round(weight * 100) / 100,
    order: lastOrder(await db.workoutSets.where('sessionId').equals(sessionId).toArray()),
  });
}

export async function addCardio(sessionId: string, activity: string, minutes: number, distanceKm?: number) {
  const name = activity.trim();
  if (!name) throw new Error('Which activity?');
  if (!(minutes > 0)) throw new Error('How many minutes?');
  if (distanceKm !== undefined && !(distanceKm >= 0)) throw new Error('Distance can’t be negative');
  return insert<WorkoutSet>('workoutSets', {
    sessionId,
    exercise: name,
    kind: 'cardio',
    reps: 0,
    weight: 0,
    minutes: Math.round(minutes),
    ...(distanceKm ? { distanceKm: Math.round(distanceKm * 100) / 100 } : {}),
    order: lastOrder(await db.workoutSets.where('sessionId').equals(sessionId).toArray()),
  });
}

/** Correct a logged set or cardio entry. */
export async function updateSet(
  id: string,
  changes: Partial<Pick<WorkoutSet, 'exercise' | 'reps' | 'weight' | 'minutes' | 'distanceKm'>>,
) {
  const c = { ...changes };
  if (c.exercise !== undefined) {
    c.exercise = c.exercise.trim();
    if (!c.exercise) throw new Error('Which exercise?');
  }
  if (c.reps !== undefined) {
    if (!(c.reps >= 1)) throw new Error('At least 1 rep');
    c.reps = Math.round(c.reps);
  }
  if (c.weight !== undefined) {
    if (!(c.weight >= 0)) throw new Error('Weight can’t be negative');
    c.weight = Math.round(c.weight * 100) / 100;
  }
  if (c.minutes !== undefined) {
    if (!(c.minutes > 0)) throw new Error('How many minutes?');
    c.minutes = Math.round(c.minutes);
  }
  if ('distanceKm' in c) {
    if (c.distanceKm !== undefined && !(c.distanceKm >= 0)) throw new Error('Distance can’t be negative');
    c.distanceKm = c.distanceKm ? Math.round(c.distanceKm * 100) / 100 : undefined;
  }
  return patch<WorkoutSet>('workoutSets', id, c);
}

export const deleteSet = (id: string) => softDeleteBatch([{ tableName: 'workoutSets', id }]);

/* ---------- Routines ---------- */

export type NewRoutine = Pick<Routine, 'title' | 'perWeek' | 'days'> &
  Partial<Pick<Routine, 'level' | 'programKey' | 'byWeekday'>>;

/** Save a routine; `active` makes it the one Today's workout follows (and switches the others off). */
export async function saveRoutine(input: NewRoutine, opts: { id?: string; active?: boolean } = {}) {
  const title = input.title.trim();
  if (!title) throw new Error('Name the routine');
  if (!input.days.length) throw new Error('Add at least one workout day');
  if (input.days.some((d) => !d.name.trim())) throw new Error('Each workout day needs a name');
  const fields = { ...input, title, ...(opts.active !== undefined ? { active: opts.active } : {}) };
  let id = opts.id;
  if (id) await patch<Routine>('routines', id, fields);
  else id = (await insert<Routine>('routines', fields)).id;
  if (opts.active) await setActiveRoutine(id);
  else if ((await db.routines.get(id))?.active) await syncGymHabit((await db.routines.get(id))!);
  return id;
}

export async function setActiveRoutine(id: string) {
  for (const r of await db.routines.toArray())
    if (!r.deletedAt && !!r.active !== (r.id === id))
      await patch<Routine>('routines', r.id, { active: r.id === id });
  // The active routine (weekdays or N a week) drives the Gym habit.
  await syncGymHabit((await db.routines.get(id)) ?? null);
}

/**
 * A weekday routine is your Gym habit: it's due on the routine's days (Habits tracks the
 * consistency), and its note is the week's plan. Creates the habit if you don't have one.
 */
/** The habit your weekday routine drives: the linked one, else one called "Gym". */
async function findGymHabit() {
  const habits = (await db.habits.toArray()).filter((h) => !h.deletedAt);
  return habits.find((h) => h.source === 'gym') ?? habits.find((h) => /^gym\b/i.test(h.title.trim()));
}

/**
 * The weekday routine is the source of truth for the Gym habit: its training days become the habit's
 * days (rest days aren't due, so they never count as missed or remind you). A paused routine (or none)
 * means no days due. The old schedule is kept for the past, so editing the plan never rewrites history.
 * Reuses one habit; never makes a second.
 */
export async function syncGymHabit(routine: Routine | null, today = toLocalDate(Date.now())) {
  const live = routine && !routine.deletedAt && !routine.paused ? routine : null;
  const target: HabitTarget = !live
    ? { type: 'days', days: [] }
    : live.byWeekday
      ? {
          type: 'days',
          days: [
            ...new Set(live.days.map((d) => d.weekday).filter((w): w is number => w !== undefined)),
          ].sort(),
        }
      : { type: 'perWeek', n: live.perWeek };
  const gym = await findGymHabit();
  const note = live
    ? live.byWeekday
      ? weekPlan(live)
      : `${live.title}: ${live.days.map((d) => d.name).join(', ')}`
    : routine && !routine.deletedAt
      ? 'Paused'
      : 'No routine';
  // Weeks changed on their own: earlier weeks stay as they were; this week's days already gone too.
  const routines = (await db.routines.toArray()).filter((r) => !r.deletedAt);
  const thisWeek = mondayOf(today);
  const old = gym?.weekDays ?? {};
  const weekDays: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(old)) if (k < thisWeek) weekDays[k] = v;
  if (live?.byWeekday)
    for (const k of Object.keys(live.weeks ?? {}))
      if (k >= thisWeek) weekDays[k] = trainingDaysOf(live, routines, k);
  if (gym && (weekDays[thisWeek] || old[thisWeek])) {
    const future = weekDays[thisWeek] ?? (target.type === 'days' ? target.days : [0, 1, 2, 3, 4, 5, 6]);
    weekDays[thisWeek] = weekDates(today)
      .filter((d) => (d < today ? isScheduled(gym, d) : future.includes(new Date(`${d}T12:00`).getDay())))
      .map((d) => new Date(`${d}T12:00`).getDay())
      .sort();
  }
  const hasWeeks = Object.keys(weekDays).length > 0;
  if (gym) {
    const same = JSON.stringify(gym.target) === JSON.stringify(target);
    await updateHabit(gym.id, {
      target,
      note,
      source: 'gym',
      ...(hasWeeks || gym.weekDays ? { weekDays: hasWeeks ? weekDays : undefined } : {}),
      ...(same
        ? {}
        : { targetHistory: [...(gym.targetHistory ?? []), { until: today, target: gym.target }] }),
    });
  } else if (live) {
    const node = (await db.nodes.toArray()).find((n) => n.moduleKey === 'fitness' && !n.deletedAt);
    await createHabit({ title: 'Gym', target, note, nodeId: node?.id, remindAt: '07:00', source: 'gym' });
  }
}

/* ---------- One week on its own ---------- */

/** A weekday's workout for one week: a routine's day, null for rest, undefined for "as planned". */
export type WeekChange = WeekSlot | null | undefined;

/**
 * Change one week only (the week containing `date`); the routine stays as it is for other weeks.
 * Days already gone are left alone, and past weeks can't be changed, so history stays put.
 */
export async function changeWeek(
  routineId: string,
  date: string,
  changes: Record<number, WeekChange>,
  today = toLocalDate(Date.now()),
) {
  const r = await db.routines.get(routineId);
  if (!r || r.deletedAt) throw new Error('This routine no longer exists');
  if (!r.byWeekday) throw new Error('Give the routine fixed weekdays first');
  const week = mondayOf(date);
  if (week < mondayOf(today)) throw new Error('Past weeks can’t be changed');
  const dates = weekDates(week);
  const cur: Record<string, WeekSlot | null> = { ...(r.weeks?.[week] ?? {}) };
  for (const [k, v] of Object.entries(changes)) {
    const wd = Number(k);
    if (dates[(wd + 6) % 7]! < today) continue;
    const base = r.days.findIndex((d) => d.weekday === wd);
    // Back to the usual plan: no change stored.
    const same =
      v === undefined || (v === null ? base < 0 : v.routineId === r.id && v.dayIndex === base && base >= 0);
    if (same) delete cur[k];
    else cur[k] = v;
  }
  const weeks = { ...r.weeks };
  if (Object.keys(cur).length) weeks[week] = cur;
  else delete weeks[week];
  await patch<Routine>('routines', r.id, { weeks: Object.keys(weeks).length ? weeks : undefined });
  if (r.active) await syncGymHabit((await db.routines.get(r.id))!, today);
}

/** This week back to the routine's usual plan (days already gone stay). */
export const resetWeek = (routineId: string, date: string, today = toLocalDate(Date.now())) =>
  changeWeek(
    routineId,
    date,
    { 0: undefined, 1: undefined, 2: undefined, 3: undefined, 4: undefined, 5: undefined, 6: undefined },
    today,
  );

/**
 * Follow another routine for one week, keeping your active one. A weekday routine brings its own days;
 * one that goes in order fills your usual training days with its days in turn.
 */
export async function followRoutineForWeek(
  activeId: string,
  otherId: string,
  date: string,
  today = toLocalDate(Date.now()),
) {
  if (activeId === otherId) return resetWeek(activeId, date, today);
  const [active, other] = await Promise.all([db.routines.get(activeId), db.routines.get(otherId)]);
  if (!active || !other || other.deletedAt) throw new Error('This routine no longer exists');
  const changes: Record<number, WeekChange> = {};
  let k = 0;
  for (const d of weekDates(date)) {
    const wd = new Date(`${d}T12:00`).getDay();
    if (other.byWeekday) {
      const i = other.days.findIndex((x) => x.weekday === wd);
      changes[wd] = i >= 0 ? { routineId: other.id, dayIndex: i } : null;
    } else {
      const training = active.days.some((x) => x.weekday === wd);
      changes[wd] = training ? { routineId: other.id, dayIndex: k++ % other.days.length } : null;
    }
  }
  return changeWeek(activeId, date, changes, today);
}

/** What's planned today for the active routine, week changes included (rest: no routine). */
export async function plannedToday(date: string) {
  const routines = (await db.routines.toArray()).filter((r) => !r.deletedAt);
  const active = routines.find((r) => r.active);
  return active?.byWeekday ? plannedOn(active, routines, date) : undefined;
}

/* ---------- The Gym habit ---------- */

/**
 * Link a habit to your Gym routine (its days and weekly count then come from Gym & Fitness), or
 * unlink it (it keeps its current schedule). Only one habit can be linked.
 */
export async function linkGymHabit(habitId: string, link: boolean) {
  const habits = (await db.habits.toArray()).filter((h) => !h.deletedAt);
  if (!link) return updateHabit(habitId, { source: undefined });
  const other = habits.find((h) => h.source === 'gym' && h.id !== habitId);
  if (other) throw new Error(`“${other.title}” already follows your Gym routine`);
  await updateHabit(habitId, { source: 'gym' });
  const active = (await db.routines.toArray()).find((r) => r.active && !r.deletedAt);
  await syncGymHabit(active ?? null);
}

/** Pause (no workouts due, no reminders) or resume a routine. */
export async function setRoutinePaused(id: string, paused: boolean) {
  await patch<Routine>('routines', id, { paused });
  const r = await db.routines.get(id);
  if (r?.active) await syncGymHabit(r);
}

/** Deleting the active routine leaves nothing due (past days keep their schedule). */
export async function deleteRoutine(id: string) {
  const r = await db.routines.get(id);
  const batch = await softDeleteBatch([{ tableName: 'routines', id }]);
  if (r?.active) await syncGymHabit(null);
  return batch;
}

/** Undo of a delete: it comes back and, if it was active, drives the habit again. */
export async function restoreRoutine(batch: string, id: string) {
  await restoreFromTrash(batch);
  const r = await db.routines.get(id);
  if (r?.active && !r.deletedAt) await syncGymHabit(r);
}

/* ---------- Check-ins ---------- */

export const checkinId = (date: string) => `c:${date}`;

type CheckinFields = Partial<
  Pick<
    Checkin,
    | 'sleepH'
    | 'energy'
    | 'waterGlasses'
    | 'weightKg'
    | 'meals'
    | 'bedTime'
    | 'wakeTime'
    | 'stamps'
    | 'waterAt'
    | 'routineDone'
  >
>;

// One at a time: tapping water twice quickly must count twice.
let chain: Promise<unknown> = Promise.resolve();

/** Set any of the day's numbers; undefined clears one. One check-in per day. */
export function setCheckin(
  date: string,
  changes: CheckinFields | ((c: Checkin | undefined) => CheckinFields),
) {
  const run = chain.then(async () => {
    const id = checkinId(date);
    const existing = await db.checkins.get(id);
    const c = { ...(typeof changes === 'function' ? changes(existing) : changes) };
    // Bed and wake times give the hours slept; with both times, a typed figure can't override them.
    const bed = 'bedTime' in c ? c.bedTime : existing?.bedTime;
    const wake = 'wakeTime' in c ? c.wakeTime : existing?.wakeTime;
    if (('bedTime' in c || 'wakeTime' in c || 'sleepH' in c) && bed && wake) c.sleepH = sleepHours(bed, wake);
    // A time cleared: sleep worked out from the two times goes too (sleep you typed in stays).
    else if (
      ('bedTime' in c || 'wakeTime' in c) &&
      existing?.bedTime &&
      existing.wakeTime &&
      existing.sleepH === sleepHours(existing.bedTime, existing.wakeTime)
    )
      c.sleepH = undefined;
    if (!existing) return insert<Checkin>('checkins', { id, date, ...c });
    return patch<Checkin>('checkins', id, c);
  });
  chain = run.catch(() => {});
  return run;
}

/** One-tap health logs. Bedtime goes on the next morning's check-in ("last night"). */
export const logMeal = (date: string, meal: 'breakfast' | 'lunch' | 'dinner', time: string | undefined) =>
  setCheckin(date, (c) => ({ meals: { ...c?.meals, [meal]: time } }));

/** A glass of water (or one back off), with the time it was logged. */
export const addWater = (date: string, delta = 1, at = Date.now()) =>
  setCheckin(date, (c) => ({
    waterGlasses: Math.max(0, (c?.waterGlasses ?? 0) + delta),
    waterAt: delta > 0 ? [...(c?.waterAt ?? []), at] : (c?.waterAt ?? []).slice(0, -1),
  }));

/** The HH:mm field a health event is shown from (kept for older data, analytics and sync). */
function legacy(event: HealthEvent, c: Checkin | undefined, time: string | undefined): CheckinFields {
  if (event === 'wake') return { wakeTime: time };
  if (event === 'bed') return { bedTime: time };
  return { meals: { ...c?.meals, [event]: time } };
}
const loggedTime = (event: HealthEvent, c?: Checkin) =>
  event === 'wake' ? c?.wakeTime : event === 'bed' ? c?.bedTime : c?.meals?.[event];

/**
 * One tap: records the device clock now. Idempotent: if it's already logged for that day, nothing
 * is overwritten (double taps, retries, two tabs) and you get `{ logged: false }` to offer a correction.
 */
export async function logHealthEvent(event: HealthEvent, at = Date.now(), tz?: string) {
  const stamp = stampAt(at, tz);
  const date = dayFor(event, stamp);
  let logged = false;
  await setCheckin(date, (c) => {
    if (c?.stamps?.[event] || loggedTime(event, c)) return {};
    logged = true;
    return { stamps: { ...c?.stamps, [event]: stamp }, ...legacy(event, c, stamp.time) };
  });
  return { logged, date, stamp };
}

/* ---------- Health plan items (interval or exact times) ---------- */

/** Change the plan's items. Without a plan yet, one is made with the built-in reminders off. */
function editHealthRoutines(change: (list: HealthRoutine[]) => HealthRoutine[]) {
  return updateProfileSettings((cur) => {
    const plan = planOf(cur) ?? { ...DEFAULT_PLAN, remind: { meals: false, water: false, bed: false } };
    return { healthPlan: { ...plan, routines: change(plan.routines ?? []) } };
  });
}

/** Add a plan item, or replace one (`id`). Checked first: see `routineProblem`. */
export async function saveHealthRoutine(input: Omit<HealthRoutine, 'id'>, id?: string) {
  const problem = routineProblem(input);
  if (problem) throw new Error(problem);
  const item: HealthRoutine = { ...input, title: input.title.trim(), id: id ?? newId() };
  await editHealthRoutines((list) =>
    id && list.some((r) => r.id === id) ? list.map((r) => (r.id === id ? item : r)) : [...list, item],
  );
  return item.id;
}

export const setHealthRoutinePaused = (id: string, paused: boolean) =>
  editHealthRoutines((list) => list.map((r) => (r.id === id ? { ...r, paused } : r)));

/** Removes it from the plan (what you marked done stays in your check-ins). Returns it, for Undo. */
export async function deleteHealthRoutine(id: string) {
  let removed: HealthRoutine | undefined;
  await editHealthRoutines((list) => {
    removed = list.find((r) => r.id === id);
    return list.filter((r) => r.id !== id);
  });
  return removed;
}

export const restoreHealthRoutine = (r: HealthRoutine) =>
  editHealthRoutines((list) => (list.some((x) => x.id === r.id) ? list : [...list, r]));

/** Mark one occurrence of a health plan item done (or not). Idempotent: done twice is done once. */
export async function markRoutineSlot(date: string, routineId: string, time: string, done = true) {
  // One water count: a water plan item ("Drink water every 2 hours") adds or takes back a glass too.
  const profile = await db.profile.toCollection().first();
  const item = planOf(profile?.settings)?.routines?.find((r) => r.id === routineId);
  const water = !!item && isWaterItem(item);
  return setCheckin(date, (c) => {
    const had = c?.routineDone?.[routineId] ?? [];
    if (had.includes(time) === done) return {};
    const next = done ? [...had, time].sort() : had.filter((t) => t !== time);
    return {
      routineDone: { ...c?.routineDone, [routineId]: next },
      ...(water && {
        waterGlasses: Math.max(0, (c?.waterGlasses ?? 0) + (done ? 1 : -1)),
        waterAt: done ? [...(c?.waterAt ?? []), Date.now()] : (c?.waterAt ?? []).slice(0, -1),
      }),
    };
  });
}

/**
 * Undo an accidental one-tap log ("I'm up", a meal, bed): back to how it was, as if never tapped.
 * Only that tap is undone: if it was corrected or logged again since, nothing changes.
 */
export const undoHealthEvent = (date: string, event: HealthEvent, at: number) =>
  setCheckin(date, (c) => {
    const s = c?.stamps?.[event];
    if (!s || s.at !== at || s.corrected) return {};
    const stamps = { ...c?.stamps };
    delete stamps[event];
    return { stamps, ...legacy(event, c, undefined) };
  });

/** What a reset took away, so Undo can put it back. */
export interface HealthSaved {
  stamp?: HealthStamp;
  time?: string;
}

/**
 * Reset a log at any time (not just right after the tap): as if it was never logged, on any day.
 * Returns what was there, for Undo.
 */
export async function resetHealthEvent(date: string, event: HealthEvent): Promise<HealthSaved> {
  let saved: HealthSaved = {};
  await setCheckin(date, (c) => {
    saved = { stamp: c?.stamps?.[event], time: loggedTime(event, c) };
    if (!saved.stamp && !saved.time) return {};
    const stamps = { ...c?.stamps };
    delete stamps[event];
    return { stamps, ...legacy(event, c, undefined) };
  });
  return saved;
}

/** Undo a reset. If it was logged again since, that newer log stays. */
export const restoreHealthEvent = (date: string, event: HealthEvent, saved: HealthSaved) =>
  setCheckin(date, (c) => {
    if (!saved.time || loggedTime(event, c)) return {};
    return {
      ...(saved.stamp ? { stamps: { ...c?.stamps, [event]: saved.stamp } } : {}),
      ...legacy(event, c, saved.time),
    };
  });

/** Water back to none for a day; returns what was there, for Undo (glasses added since are kept). */
export async function resetWater(date: string) {
  let saved = { glasses: 0, at: [] as number[] };
  await setCheckin(date, (c) => {
    saved = { glasses: c?.waterGlasses ?? 0, at: c?.waterAt ?? [] };
    return { waterGlasses: undefined, waterAt: undefined };
  });
  return saved;
}
export const restoreWater = (date: string, saved: { glasses: number; at: number[] }) =>
  setCheckin(date, (c) => ({
    waterGlasses: (c?.waterGlasses ?? 0) + saved.glasses,
    waterAt: [...saved.at, ...(c?.waterAt ?? [])].sort((a, b) => a - b),
  }));

/** Correct a logged time (the original tap stays recorded), or clear it with `undefined`. */
export function correctHealthTime(date: string, event: HealthEvent, time: string | undefined) {
  return setCheckin(date, (c) => {
    const s = c?.stamps?.[event];
    if (!time) {
      const stamps = { ...c?.stamps };
      delete stamps[event];
      return { stamps, ...legacy(event, c, undefined) };
    }
    return {
      ...(s ? { stamps: { ...c?.stamps, [event]: { ...s, corrected: time, correctedAt: Date.now() } } } : {}),
      ...legacy(event, c, time),
    };
  });
}

/**
 * The Gym habit for a day follows your workouts (Gym is the source of truth): a session you ended
 * completes it, linked to that session; if no ended session is left (deleted, moved, end cleared),
 * a check-in the app made is removed. Only the linked habit (source "gym") is ever touched.
 * Skips, explained misses and check-ins made by hand stay unless a workout completes the day.
 */
export async function resyncGymDay(date: string) {
  const gym = (await db.habits.toArray()).find((h) => !h.deletedAt && h.source === 'gym');
  if (!gym) return;
  const ended = (await db.workoutSessions.where('date').equals(date).toArray())
    .filter((w) => !w.deletedAt && isFinished(w))
    .sort((a, b) => (a.endedAt ?? a.createdAt) - (b.endedAt ?? b.createdAt));
  const log = (await db.habitLogs.where('[habitId+date]').equals([gym.id, date]).toArray()).find(
    (l) => !l.deletedAt,
  );
  const first = ended[0];
  if (first) {
    const stillLinked =
      log?.status === 'done' && (!log.workoutId || ended.some((w) => w.id === log.workoutId));
    if (!stillLinked)
      await setHabitLog(gym.id, date, 'done', undefined, { workoutId: first.id, planned: first.title });
  } else if (log?.status === 'done' && log.workoutId) await setHabitLog(gym.id, date, null);
}
