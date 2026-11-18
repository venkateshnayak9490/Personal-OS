import { generateKeyBetween } from 'fractional-indexing';
import { setHabitLog } from './plans';
import { db } from '@/core/db';
import type {
  ChapterStatus,
  Checkin,
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
  Partial<Pick<Routine, 'level' | 'programKey'>>;

/** Save a routine; `active` makes it the one Today's workout follows (and switches the others off). */
export async function saveRoutine(input: NewRoutine, opts: { id?: string; active?: boolean } = {}) {
  const title = input.title.trim();
  if (!title) throw new Error('Name the routine');
  if (!input.days.length || input.days.some((d) => !d.name.trim())) throw new Error('Each day needs a name');
  const fields = { ...input, title, ...(opts.active !== undefined ? { active: opts.active } : {}) };
  let id = opts.id;
  if (id) await patch<Routine>('routines', id, fields);
  else id = (await insert<Routine>('routines', fields)).id;
  if (opts.active) await setActiveRoutine(id);
  return id;
}

export async function setActiveRoutine(id: string) {
  for (const r of await db.routines.toArray())
    if (!r.deletedAt && !!r.active !== (r.id === id))
      await patch<Routine>('routines', r.id, { active: r.id === id });
}

export const deleteRoutine = (id: string) => softDeleteBatch([{ tableName: 'routines', id }]);

/* ---------- Check-ins ---------- */

export const checkinId = (date: string) => `c:${date}`;

type CheckinFields = Partial<Pick<Checkin, 'sleepH' | 'energy' | 'waterGlasses' | 'weightKg'>>;

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
    const c = typeof changes === 'function' ? changes(existing) : changes;
    if (!existing) return insert<Checkin>('checkins', { id, date, ...c });
    return patch<Checkin>('checkins', id, c);
  });
  chain = run.catch(() => {});
  return run;
}

/** A workout counts as a check-in for your gym habit(s): those in this section, or named like "Gym". */
export async function checkInGym(date: string, nodeId?: string) {
  const habits = (await db.habits.toArray()).filter(
    (h) => !h.deletedAt && ((nodeId && h.nodeId === nodeId) || /\b(gym|workout|exercise)\b/i.test(h.title)),
  );
  for (const h of habits) {
    const log = (await db.habitLogs.where('[habitId+date]').equals([h.id, date]).toArray()).find(
      (l) => !l.deletedAt,
    );
    if (log?.status !== 'done') await setHabitLog(h.id, date, 'done');
  }
}
