import { generateKeyBetween } from 'fractional-indexing';
import { dayFor, sleepHours, stampAt } from '@/core/domain/health';
import { weekPlan } from '@/core/domain/fitness';
import { toLocalDate } from '@/core/domain/tasks';
import { createHabit, setHabitLog, updateHabit } from './plans';
import { db } from '@/core/db';
import type {
  ChapterStatus,
  Checkin,
  HealthEvent,
  ThesisChapter,
  WorkoutSession,
  WorkoutSet,
  Routine,
  WritingLog,
} from '@/core/domain/types';
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

export async function createWorkout(
  date: string,
  nodeId?: string,
  title = 'Workout',
  from?: { routineId: string; dayIndex: number },
): Promise<WorkoutSession> {
  return insert<WorkoutSession>('workoutSessions', {
    date,
    nodeId,
    title: title.trim() || 'Workout',
    ...from,
  });
}

export const updateWorkout = (
  id: string,
  changes: Partial<Pick<WorkoutSession, 'title' | 'date' | 'notes'>>,
) => patch<WorkoutSession>('workoutSessions', id, changes);

export async function deleteWorkout(id: string) {
  const sets = (await db.workoutSets.where('sessionId').equals(id).toArray()).filter((s) => !s.deletedAt);
  return softDeleteBatch([
    { tableName: 'workoutSessions', id },
    ...sets.map((s) => ({ tableName: 'workoutSets' as const, id: s.id })),
  ]);
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
  else if (input.byWeekday && (await db.routines.get(id))?.active)
    await syncGymHabit((await db.routines.get(id))!);
  return id;
}

export async function setActiveRoutine(id: string) {
  for (const r of await db.routines.toArray())
    if (!r.deletedAt && !!r.active !== (r.id === id))
      await patch<Routine>('routines', r.id, { active: r.id === id });
  const active = await db.routines.get(id);
  // A weekday routine drives the Gym habit; switching to another kind leaves the habit as it is.
  if (active?.byWeekday) await syncGymHabit(active);
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
  const days =
    routine && routine.byWeekday && !routine.paused
      ? [...new Set(routine.days.map((d) => d.weekday).filter((w): w is number => w !== undefined))].sort()
      : [];
  const target = { type: 'days' as const, days };
  const gym = await findGymHabit();
  const note = routine && !routine.paused ? weekPlan(routine) : 'Paused';
  if (gym) {
    const same =
      gym.target.type === 'days' &&
      gym.target.days.length === days.length &&
      days.every((d) => (gym.target as { days: number[] }).days.includes(d));
    await updateHabit(gym.id, {
      target,
      note,
      source: 'gym',
      ...(same
        ? {}
        : { targetHistory: [...(gym.targetHistory ?? []), { until: today, target: gym.target }] }),
    });
  } else if (days.length) {
    const node = (await db.nodes.toArray()).find((n) => n.moduleKey === 'fitness' && !n.deletedAt);
    await createHabit({ title: 'Gym', target, note, nodeId: node?.id, remindAt: '07:00', source: 'gym' });
  }
}

/** Pause (no workouts due, no reminders) or resume a routine. */
export async function setRoutinePaused(id: string, paused: boolean) {
  await patch<Routine>('routines', id, { paused });
  const r = await db.routines.get(id);
  if (r?.active && r.byWeekday) await syncGymHabit(r);
}

export const deleteRoutine = (id: string) => softDeleteBatch([{ tableName: 'routines', id }]);

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
    // Bed and wake times give the hours slept.
    const bed = 'bedTime' in c ? c.bedTime : existing?.bedTime;
    const wake = 'wakeTime' in c ? c.wakeTime : existing?.wakeTime;
    if (('bedTime' in c || 'wakeTime' in c) && bed && wake) c.sleepH = sleepHours(bed, wake);
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

/** A workout counts as a check-in for your gym habit(s): those in this section, or named like "Gym". */
export async function checkInGym(date: string, nodeId?: string, workout?: { id: string; planned?: string }) {
  const linked = await findGymHabit();
  const habits = (await db.habits.toArray()).filter(
    (h) =>
      !h.deletedAt &&
      (h.id === linked?.id || (nodeId && h.nodeId === nodeId) || /\b(gym|workout|exercise)\b/i.test(h.title)),
  );
  for (const h of habits) {
    const log = (await db.habitLogs.where('[habitId+date]').equals([h.id, date]).toArray()).find(
      (l) => !l.deletedAt,
    );
    // Once a day: more workouts that day don't check it in again.
    if (log?.status !== 'done')
      await setHabitLog(
        h.id,
        date,
        'done',
        undefined,
        workout ? { workoutId: workout.id, planned: workout.planned } : {},
      );
  }
}
