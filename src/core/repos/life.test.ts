import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import {
  bests,
  cardioTotals,
  e1rm,
  lastTime,
  nextDayIndex,
  plannedOn,
  prSets,
  PROGRAMS,
} from '@/core/domain/fitness';
import { resetDb } from '@/test/db-reset';
import {
  addCardio,
  addSet,
  checkinId,
  deleteRoutine,
  deleteWorkout,
  endWorkout,
  restoreWorkout,
  updateSet,
  updateWorkout,
  changeWeek,
  followRoutineForWeek,
  resetWeek,
  startWorkout,
  linkGymHabit,
  undoHealthEvent,
  resetHealthEvent,
  restoreHealthEvent,
  resetWater,
  restoreWater,
  addWater,
  correctHealthTime,
  logHealthEvent,
  markRoutineSlot,
  saveHealthRoutine,
  deleteHealthRoutine,
  restoreHealthRoutine,
  createChapter,
  createWorkout,
  deleteChapter,
  logWriting,
  saveRoutine,
  setActiveRoutine,
  setRoutinePaused,
  syncGymHabit,
  setCheckin,
} from './life';
import { createHabit, setHabitLog, updateHabit } from './plans';
import { adherence, isScheduled, logsByDate, targetLabel } from '@/core/domain/progress';
import { restoreFromTrash } from './trash';
import { completeOnboarding } from './profile';

beforeEach(resetDb);

describe('thesis', () => {
  it('logging a new word count records the change and starts drafting', async () => {
    const ch = await createChapter('Introduction', 6000);
    const a = await logWriting(ch.id, 1200, '2026-11-17', 90);
    const b = await logWriting(ch.id, 1100, '2026-11-18'); // edited down
    expect([a.delta, b.delta]).toEqual([1200, -100]);
    expect(await db.thesisChapters.get(ch.id)).toMatchObject({ currentWords: 1100, status: 'drafting' });
    await expect(logWriting(ch.id, -5, '2026-11-18')).rejects.toThrow(/0 or more/);
  });

  it('a chapter goes to Trash with its log, and comes back with it', async () => {
    const ch = await createChapter('Method');
    await logWriting(ch.id, 300, '2026-11-18');
    const b = await deleteChapter(ch.id);
    expect((await db.writingLogs.toArray()).every((l) => l.deletedAt)).toBe(true);
    await restoreFromTrash(b!);
    expect((await db.writingLogs.toArray()).every((l) => !l.deletedAt)).toBe(true);
  });
});

describe('workouts', () => {
  it('flags sets that beat earlier ones as personal records', async () => {
    const mon = await createWorkout('2026-11-16');
    const wed = await createWorkout('2026-11-18');
    const s1 = await addSet(mon.id, 'Bench press', 5, 60);
    const s2 = await addSet(mon.id, 'bench  Press', 5, 60); // same exercise, same weight: no PR
    const s3 = await addSet(wed.id, 'Bench press', 8, 60); // more reps at 60: higher estimated max
    const s4 = await addSet(wed.id, 'Bench press', 3, 65); // heavier
    const s5 = await addSet(wed.id, 'Squat', 5, 80); // first ever: not a PR, just a start
    const prs = prSets(await db.workoutSessions.toArray(), await db.workoutSets.toArray());
    expect([s1, s2, s3, s4, s5].map((s) => prs.has(s.id))).toEqual([false, false, true, true, false]);
    expect(bests(await db.workoutSets.toArray()).get('bench press')).toMatchObject({ heaviest: 65 });
    expect(Math.round(e1rm({ reps: 5, weight: 100 }))).toBe(117);
    await expect(addSet(mon.id, ' ', 5, 60)).rejects.toThrow(/Which exercise/);
  });
});

describe('gym', () => {
  it('a program becomes your active routine; its days come round in order', async () => {
    const p = PROGRAMS.find((x) => x.programKey === 'upper-lower-4')!;
    const id = await saveRoutine(p, { active: true });
    const other = await saveRoutine({ title: 'Mine', perWeek: 2, days: [{ name: 'A', exercises: [] }] });
    let r = (await db.routines.get(id))!;
    expect(r.active).toBe(true);
    expect(nextDayIndex(r, [])).toBe(0);
    const w1 = await createWorkout('2026-11-16', undefined, 'Upper A', { routineId: id, dayIndex: 0 });
    const w2 = await createWorkout('2026-11-17', undefined, 'Lower A', { routineId: id, dayIndex: 1 });
    expect(nextDayIndex(r, [w1, w2])).toBe(2);
    const w4 = await createWorkout('2026-11-19', undefined, 'Lower B', { routineId: id, dayIndex: 3 });
    expect(nextDayIndex(r, [w1, w2, w4])).toBe(0); // wraps round
    await setActiveRoutine(other);
    r = (await db.routines.get(id))!;
    expect([r.active, (await db.routines.get(other))!.active]).toEqual([false, true]);
    await expect(saveRoutine({ title: ' ', perWeek: 3, days: [] })).rejects.toThrow(/Name/);
  });

  it('cardio is logged in minutes and km, and never counts as a lift', async () => {
    const w = await createWorkout('2026-11-18');
    await addSet(w.id, 'Bench press', 5, 60);
    const c = await addCardio(w.id, 'Running', 25, 4.2);
    expect(c).toMatchObject({ kind: 'cardio', minutes: 25, distanceKm: 4.2 });
    await expect(addCardio(w.id, 'Running', 0)).rejects.toThrow(/minutes/);
    const sessions = await db.workoutSessions.toArray();
    const sets = await db.workoutSets.toArray();
    expect(cardioTotals(sets, sessions, '2026-11-16', '2026-11-22')).toEqual({ minutes: 25, km: 4.2 });
    expect([...bests(sets).keys()]).toEqual(['bench press']);
  });

  it('pre-fills from the last time you did an exercise', async () => {
    const a = await createWorkout('2026-11-16');
    await addSet(a.id, 'Squat', 5, 80);
    await addSet(a.id, 'Squat', 5, 85);
    const b = await createWorkout('2026-11-18');
    const sessions = await db.workoutSessions.toArray();
    const sets = await db.workoutSets.toArray();
    expect(lastTime('squat', sets, sessions, b.id).map((s) => s.weight)).toEqual([80, 85]);
  });

  it('ending a workout completes only the linked Gym habit, never one that just mentions gym', async () => {
    const gym = await createHabit({ title: 'Gym', target: { type: 'perWeek', n: 4 }, source: 'gym' });
    const other = await createHabit({ title: 'Gym stretches at home', target: { type: 'daily' } });
    const workout = await createHabit({ title: 'Morning workout', target: { type: 'daily' } });
    const w = await createWorkout('2026-11-18', undefined, 'Legs', undefined, 1000);
    await addSet(w.id, 'Squat', 5, 80);
    // Started, not ended: nothing is complete yet.
    expect((await db.habitLogs.toArray()).filter((l) => !l.deletedAt)).toHaveLength(0);
    await endWorkout(w.id, 1000 + 50 * 60_000);
    await endWorkout(w.id, 1000 + 50 * 60_000); // twice is fine
    const logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    expect(logs.map((l) => [l.habitId, l.date, l.status, l.workoutId])).toEqual([
      [gym.id, '2026-11-18', 'done', w.id],
    ]);
    expect(logs.some((l) => l.habitId === other.id || l.habitId === workout.id)).toBe(false);
    expect(await db.workoutSessions.get(w.id)).toMatchObject({ startedAt: 1000, endedAt: 1000 + 3_000_000 });
    await expect(updateWorkout(w.id, { endedAt: 500 })).rejects.toThrow(/before the start/);
  });

  it('editing or deleting a session updates the Gym habit; hand-made check-ins and skips stay', async () => {
    const gym = await createHabit({ title: 'Gym', target: { type: 'daily' }, source: 'gym' });
    const log = async (date: string) =>
      (await db.habitLogs.where('[habitId+date]').equals([gym.id, date]).toArray()).find((l) => !l.deletedAt);
    const a = await createWorkout('2026-11-18', undefined, 'Push', undefined, 1);
    const b = await createWorkout('2026-11-18', undefined, 'Cardio', undefined, 2);
    await endWorkout(a.id, 10);
    await endWorkout(b.id, 20);
    expect(await log('2026-11-18')).toMatchObject({ status: 'done', workoutId: a.id });
    // Delete the linked one: relinked to the other session that day.
    const batch = (await deleteWorkout(a.id))!;
    expect(await log('2026-11-18')).toMatchObject({ status: 'done', workoutId: b.id });
    // Move the other to the 17th: the 18th has nothing left, the 17th is done.
    await updateWorkout(b.id, { date: '2026-11-17' });
    expect(await log('2026-11-18')).toBeUndefined();
    expect(await log('2026-11-17')).toMatchObject({ status: 'done', workoutId: b.id });
    // Undo the delete: the 18th is done again.
    await restoreWorkout(batch, a.id);
    expect(await log('2026-11-18')).toMatchObject({ status: 'done', workoutId: a.id });
    // "Not finished" removes the app's check-in.
    await updateWorkout(b.id, { endedAt: undefined });
    expect(await log('2026-11-17')).toBeUndefined();
    // A check-in you made by hand, and a skip, are left alone when a session goes.
    await setHabitLog(gym.id, '2026-11-16', 'done');
    const c = await createWorkout('2026-11-16', undefined, 'Legs', undefined, 1);
    await deleteWorkout(c.id);
    expect(await log('2026-11-16')).toMatchObject({ status: 'done' });
    await setHabitLog(gym.id, '2026-11-15', 'skipped');
    expect(await log('2026-11-15')).toMatchObject({ status: 'skipped' });
  });

  it('logged sets can be corrected', async () => {
    const w = await createWorkout('2026-11-18');
    const s = await addSet(w.id, 'Bench press', 8, 60);
    await updateSet(s.id, { reps: 6, weight: 62.5, exercise: ' Incline bench ' });
    expect(await db.workoutSets.get(s.id)).toMatchObject({
      reps: 6,
      weight: 62.5,
      exercise: 'Incline bench',
    });
    await expect(updateSet(s.id, { reps: 0 })).rejects.toThrow(/1 rep/);
    await expect(updateSet(s.id, { weight: -1 })).rejects.toThrow(/negative/);
    const c = await addCardio(w.id, 'Running', 20, 3);
    await updateSet(c.id, { minutes: 25, distanceKm: undefined });
    const run = (await db.workoutSets.get(c.id))!;
    expect(run.minutes).toBe(25);
    expect(run.distanceKm).toBeUndefined();
  });
});

describe('check-ins', () => {
  it('repeating health plan items: saved in the plan, marked done once, deleted with undo', async () => {
    await completeOnboarding({ profileTypes: ['other'] });
    const id = await saveHealthRoutine({
      title: ' Walk ',
      mode: 'interval',
      every: 60,
      unit: 'min',
      start: '09:00',
      end: '18:00',
      from: '2026-11-18',
      remind: true,
    });
    const plan = () =>
      (db.profile.toArray() as Promise<{ settings: Record<string, unknown> }[]>).then(
        (p) =>
          p[0]!.settings.healthPlan as {
            routines: { id: string; title: string }[];
            remind: { meals: boolean };
          },
      );
    expect((await plan()).routines).toMatchObject([{ id, title: 'Walk' }]);
    expect((await plan()).remind.meals).toBe(false); // a new plan doesn't switch on meal reminders
    await expect(
      saveHealthRoutine({
        title: 'Walk',
        mode: 'interval',
        every: 5,
        unit: 'min',
        start: '09:00',
        from: '2026-11-18',
        remind: true,
      }),
    ).rejects.toThrow(/15 minutes/);
    await Promise.all([
      markRoutineSlot('2026-11-18', id, '10:00'),
      markRoutineSlot('2026-11-18', id, '10:00'),
    ]);
    await markRoutineSlot('2026-11-18', id, '09:00');
    expect((await db.checkins.get(checkinId('2026-11-18')))!.routineDone).toEqual({
      [id]: ['09:00', '10:00'],
    });
    await markRoutineSlot('2026-11-18', id, '10:00', false);
    expect((await db.checkins.get(checkinId('2026-11-18')))!.routineDone).toEqual({ [id]: ['09:00'] });
    const removed = (await deleteHealthRoutine(id))!;
    expect((await plan()).routines).toEqual([]);
    await restoreHealthRoutine(removed);
    expect((await plan()).routines).toMatchObject([{ id }]);
  });

  it('one per day; quick taps on water all count', async () => {
    const more = (c?: { waterGlasses?: number }) => ({ waterGlasses: (c?.waterGlasses ?? 0) + 1 });
    await Promise.all([
      setCheckin('2026-11-18', more),
      setCheckin('2026-11-18', more),
      setCheckin('2026-11-18', more),
    ]);
    await setCheckin('2026-11-18', { sleepH: 7.5, energy: 4 });
    expect(await db.checkins.count()).toBe(1);
    expect(await db.checkins.get(checkinId('2026-11-18'))).toMatchObject({
      waterGlasses: 3,
      sleepH: 7.5,
      energy: 4,
    });
  });

  it('one-tap health logs: device time recorded once, corrections keep the original', async () => {
    const at = Date.UTC(2026, 10, 18, 2, 12); // 07:42 IST
    const a = await logHealthEvent('wake', at, 'Asia/Kolkata');
    const b = await logHealthEvent('wake', at + 5_000, 'Asia/Kolkata'); // double tap
    expect([a.logged, b.logged]).toEqual([true, false]);
    let c = (await db.checkins.get(checkinId('2026-11-18')))!;
    expect(c.wakeTime).toBe('07:42');
    expect(c.stamps?.wake).toMatchObject({ at, tz: 'Asia/Kolkata', date: '2026-11-18', time: '07:42' });
    await correctHealthTime('2026-11-18', 'wake', '07:15');
    c = (await db.checkins.get(checkinId('2026-11-18')))!;
    expect(c.wakeTime).toBe('07:15');
    expect(c.stamps?.wake).toMatchObject({ time: '07:42', corrected: '07:15' });
    // Going to bed after midnight goes on that morning's check-in, with sleep worked out.
    await logHealthEvent('bed', Date.UTC(2026, 10, 18, 19, 0), 'Asia/Kolkata'); // 00:30 on the 19th
    await logHealthEvent('wake', Date.UTC(2026, 10, 19, 1, 30), 'Asia/Kolkata'); // 07:00
    expect(await db.checkins.get(checkinId('2026-11-19'))).toMatchObject({ bedTime: '00:30', sleepH: 6.5 });
  });

  it('weekly routine drives one Gym habit; edits and pauses never rewrite the past', async () => {
    const week = (wds: number[]) => wds.map((w) => ({ name: `Day ${w}`, weekday: w, exercises: [] }));
    const id = await saveRoutine(
      { title: 'Split', perWeek: 3, byWeekday: true, days: week([1, 3, 5]) },
      { active: true },
    );
    let gym = (await db.habits.toArray()).filter((h) => !h.deletedAt);
    expect(gym).toHaveLength(1);
    expect(gym[0]).toMatchObject({ title: 'Gym', source: 'gym', target: { type: 'days', days: [1, 3, 5] } });
    // Change the plan from Thursday 19 Nov: Wed 18 Nov stays a training day in the past.
    await saveRoutine({ title: 'Split', perWeek: 2, byWeekday: true, days: week([2, 4]) }, { id });
    await syncGymHabit((await db.routines.get(id))!, '2026-11-19');
    gym = (await db.habits.toArray()).filter((h) => !h.deletedAt);
    expect(gym).toHaveLength(1); // reused, not duplicated
    expect(isScheduled(gym[0]!, '2026-11-18')).toBe(true); // Wed, old plan
    expect(isScheduled(gym[0]!, '2026-11-25')).toBe(false); // Wed, new plan
    expect(isScheduled(gym[0]!, '2026-11-26')).toBe(true); // Thu, new plan
    // Paused: nothing due.
    await setRoutinePaused(id, true);
    const paused = (await db.habits.toArray()).find((h) => h.source === 'gym')!;
    expect(isScheduled(paused, '2026-12-03')).toBe(false);
  });

  it('a workout checks in the planned day once and links it; skips keep their time and reason', async () => {
    const h = await createHabit({
      title: 'Gym',
      target: { type: 'days', days: [1, 2, 3, 4, 5, 6] },
      source: 'gym',
    });
    const w1 = await createWorkout('2026-11-18', undefined, 'Legs', undefined, 1);
    const w2 = await createWorkout('2026-11-18', undefined, 'Legs', undefined, 2);
    await endWorkout(w1.id, 10);
    await endWorkout(w2.id, 20); // second workout that day
    let logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'done', workoutId: w1.id, planned: 'Legs' });
    await setHabitLog(h.id, '2026-11-17', 'skipped', 'Feeling unwell', { planned: 'Back and biceps' });
    const first = (await db.habitLogs.toArray()).find((l) => l.date === '2026-11-17')!;
    await setHabitLog(h.id, '2026-11-17', 'skipped', 'Feeling unwell, fever', { planned: 'Back and biceps' });
    logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    const edited = logs.find((l) => l.date === '2026-11-17')!;
    expect(edited).toMatchObject({
      note: 'Feeling unwell, fever',
      planned: 'Back and biceps',
      skippedAt: first.skippedAt,
    });
    // The reason is optional; a missed day can be explained later and counts as missed.
    await setHabitLog(h.id, '2026-11-14', 'skipped');
    await setHabitLog(h.id, '2026-11-13', 'missed', 'Busy with work/studies');
    logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    expect(logs.find((l) => l.date === '2026-11-14')).toMatchObject({ status: 'skipped' });
    expect(logs.find((l) => l.date === '2026-11-14')!.note).toBeUndefined();
    const habit = (await db.habits.get(h.id))!;
    expect(adherence(habit, logsByDate(logs, h.id), '2026-11-13', '2026-11-13', '2026-11-19')).toMatchObject({
      missed: 1,
      planned: 1,
    });
  });

  it('the active routine drives the habit: any kind, and deleting it leaves nothing due', async () => {
    const id = await saveRoutine(
      { title: 'Full body', perWeek: 3, days: [{ name: 'A', exercises: [] }] },
      { active: true },
    );
    let gym = (await db.habits.toArray()).find((h) => h.source === 'gym')!;
    expect(gym.target).toEqual({ type: 'perWeek', n: 3 });
    await deleteRoutine(id);
    gym = (await db.habits.toArray()).find((h) => h.source === 'gym')!;
    expect(gym.target).toEqual({ type: 'days', days: [] });
    expect(gym.targetHistory?.at(-1)?.target).toEqual({ type: 'perWeek', n: 3 }); // the past keeps it
  });

  it('adherence: planned days are the denominator; rest never counts; missed and skipped stay apart', async () => {
    const h = await createHabit({ title: 'Gym', target: { type: 'days', days: [1, 2, 3, 5] } }); // Mon Tue Wed Fri
    await setHabitLog(h.id, '2026-11-16', 'done'); // Mon
    await setHabitLog(h.id, '2026-11-17', 'skipped', 'Work'); // Tue
    // Wed 18: nothing (today, still pending). Thu 19 is rest. A workout on rest Sun 15 is extra.
    await setHabitLog(h.id, '2026-11-15', 'done');
    const logs = logsByDate(await db.habitLogs.toArray(), h.id);
    const habit = (await db.habits.get(h.id))!;
    expect(adherence(habit, logs, '2026-11-16', '2026-11-22', '2026-11-18')).toEqual({
      planned: 2,
      done: 1,
      skipped: 1,
      missed: 0,
      rest: 0,
      extra: 0,
      pct: 50,
    });
    expect(adherence(habit, logs, '2026-11-15', '2026-11-22', '2026-11-20')).toMatchObject({
      planned: 3, // Fri 20 is today and not logged yet: not counted
      done: 1,
      skipped: 1,
      missed: 1, // Wed 18
      rest: 2,
      extra: 1,
      pct: 33,
    });
  });
});

describe('one week on its own', () => {
  const week = (wds: number[]) => wds.map((w) => ({ name: `Day ${w}`, weekday: w, exercises: [] }));
  const gymHabit = async () => (await db.habits.toArray()).find((h) => h.source === 'gym')!;

  it('changes one week only: the routine, other weeks and days already gone stay as they were', async () => {
    // Mon, Wed, Fri. Today is Wed 18 Nov 2026.
    const id = await saveRoutine(
      { title: 'Split', perWeek: 3, byWeekday: true, days: week([1, 3, 5]) },
      { active: true },
    );
    const today = '2026-11-18';
    // This week: Friday is rest, Saturday gets Monday's workout; Monday (gone) can't be changed.
    await changeWeek(id, today, { 5: null, 6: { routineId: id, dayIndex: 0 }, 1: null }, today);
    const r = (await db.routines.get(id))!;
    expect(r.days.map((d) => d.weekday)).toEqual([1, 3, 5]); // the routine itself is unchanged
    const all = await db.routines.toArray();
    expect(plannedOn(r, all, '2026-11-16').routine).toBeDefined(); // Mon kept
    expect(plannedOn(r, all, '2026-11-20')).toMatchObject({ dayIndex: -1, changed: true }); // Fri rest
    expect(plannedOn(r, all, '2026-11-21')).toMatchObject({ dayIndex: 0, changed: true }); // Sat
    expect(plannedOn(r, all, '2026-11-27').routine).toBeDefined(); // next Fri as usual
    // The Gym habit follows this week (3 workouts: Mon, Wed, Sat), and only this week.
    const h = await gymHabit();
    expect(isScheduled(h, '2026-11-20')).toBe(false);
    expect(isScheduled(h, '2026-11-21')).toBe(true);
    expect(isScheduled(h, '2026-11-27')).toBe(true);
    expect(h.weekDays?.['2026-11-16']).toEqual([1, 3, 6]);
    // The habit card shows that week's actual days; other weeks show the routine's.
    expect(targetLabel(h, today)).toBe('Mon, Wed, Sat (this week)');
    expect(targetLabel(h, '2026-11-25')).toBe('Mon, Wed, Fri');
    // Past weeks can't be changed.
    await expect(changeWeek(id, '2026-11-10', { 2: null }, today)).rejects.toThrow(/Past weeks/);
    // Reset: back to the plan.
    await resetWeek(id, today, today);
    expect((await db.routines.get(id))!.weeks).toBeUndefined();
    expect(isScheduled(await gymHabit(), '2026-11-20')).toBe(true);
  });

  it('follow another routine for a week, keeping the active one', async () => {
    const id = await saveRoutine(
      { title: 'Split', perWeek: 3, byWeekday: true, days: week([1, 3, 5]) },
      { active: true },
    );
    const other = await saveRoutine({ title: 'Deload', perWeek: 2, byWeekday: true, days: week([2, 4]) });
    await followRoutineForWeek(id, other, '2026-11-23', '2026-11-18'); // next week
    const routines = await db.routines.toArray();
    expect(routines.find((r) => r.id === id)!.active).toBe(true);
    expect(routines.find((r) => r.id === other)!.active).toBeFalsy();
    const h = await gymHabit();
    expect(h.weekDays?.['2026-11-23']).toEqual([2, 4]);
    expect(isScheduled(h, '2026-11-18')).toBe(true); // this week as usual
    expect(isScheduled(h, '2026-11-24')).toBe(true);
    expect(isScheduled(h, '2026-11-23')).toBe(false);
  });

  it('start picks up a workout in progress instead of making a second one', async () => {
    const a = await startWorkout('2026-11-18', undefined, 'Legs');
    const b = await startWorkout('2026-11-18', undefined, 'Legs');
    expect(b.id).toBe(a.id);
    expect(await db.workoutSessions.count()).toBe(1);
  });

  it('a habit added in Habits can follow the Gym routine; only one can', async () => {
    await saveRoutine(
      { title: 'Split', perWeek: 3, byWeekday: true, days: week([1, 3, 5]) },
      { active: true },
    );
    const auto = await gymHabit();
    await linkGymHabit(auto.id, false);
    const mine = await createHabit({ title: 'Gym', target: { type: 'perWeek', n: 4 } });
    await expect(linkGymHabit(mine.id, true)).resolves.toBeUndefined();
    const linked = (await db.habits.get(mine.id))!;
    expect(linked).toMatchObject({ source: 'gym', target: { type: 'days', days: [1, 3, 5] } });
    await expect(linkGymHabit(auto.id, true)).rejects.toThrow(/already follows/);
  });

  it('undo an accidental "I\'m up": as if never tapped; tapping again works once', async () => {
    const at = Date.UTC(2026, 10, 18, 2, 12); // 07:42 IST
    await logHealthEvent('bed', Date.UTC(2026, 10, 17, 17, 30), 'Asia/Kolkata'); // 23:00 the night before
    const a = await logHealthEvent('wake', at, 'Asia/Kolkata');
    expect((await db.checkins.get(checkinId('2026-11-18')))!.sleepH).toBeCloseTo(8.7, 1);
    await undoHealthEvent(a.date, 'wake', a.stamp.at);
    let c = (await db.checkins.get(checkinId('2026-11-18')))!;
    expect(c.wakeTime).toBeUndefined();
    expect(c.stamps?.wake).toBeUndefined();
    expect(c.sleepH).toBeUndefined(); // it came from the two times
    expect(c.bedTime).toBe('23:00'); // the rest stays
    const b = await logHealthEvent('wake', at + 60_000, 'Asia/Kolkata');
    expect(b.logged).toBe(true);
    await undoHealthEvent(a.date, 'wake', a.stamp.at); // an old undo does nothing to the new tap
    c = (await db.checkins.get(checkinId('2026-11-18')))!;
    expect(c.wakeTime).toBe('07:43');
    expect(await db.checkins.count()).toBe(1);
  });
});

describe('health reset, any time later', () => {
  it('resets a log on any day as if never logged; Undo restores it unless logged again', async () => {
    const at = Date.UTC(2026, 10, 16, 2, 0); // 07:30 IST on Mon 16
    await logHealthEvent('wake', at, 'Asia/Kolkata');
    const was = await resetHealthEvent('2026-11-16', 'wake'); // days later
    let c = (await db.checkins.get(checkinId('2026-11-16')))!;
    expect([c.wakeTime, c.stamps?.wake]).toEqual([undefined, undefined]);
    await restoreHealthEvent('2026-11-16', 'wake', was);
    c = (await db.checkins.get(checkinId('2026-11-16')))!;
    expect(c.wakeTime).toBe('07:30');
    expect(c.stamps?.wake?.at).toBe(at);
    // Reset, log again, then an old Undo leaves the newer log alone.
    const again = await resetHealthEvent('2026-11-16', 'wake');
    await logHealthEvent('wake', at + 600_000, 'Asia/Kolkata');
    await restoreHealthEvent('2026-11-16', 'wake', again);
    expect((await db.checkins.get(checkinId('2026-11-16')))!.wakeTime).toBe('07:40');
    // Water: reset to none; Undo brings it back and keeps glasses added since.
    await addWater('2026-11-16', 1, 1);
    await addWater('2026-11-16', 1, 2);
    const water = await resetWater('2026-11-16');
    expect((await db.checkins.get(checkinId('2026-11-16')))!.waterGlasses).toBeUndefined();
    await addWater('2026-11-16', 1, 3);
    await restoreWater('2026-11-16', water);
    c = (await db.checkins.get(checkinId('2026-11-16')))!;
    expect([c.waterGlasses, c.waterAt]).toEqual([3, [1, 2, 3]]);
    expect(await db.checkins.count()).toBe(1);
  });
});

describe('ordinary habits keep their old schedule for the past', () => {
  it('changing the days applies from today; earlier days keep the old plan', async () => {
    const h = await createHabit({ title: 'Read', target: { type: 'days', days: [1, 3, 5] } }); // Mon Wed Fri
    const today = '2099-01-07'; // a Wednesday, well after the habit was made
    await updateHabit(h.id, { target: { type: 'days', days: [2, 4] } }, today);
    const after = (await db.habits.get(h.id))!;
    expect(isScheduled(after, '2099-01-05')).toBe(true); // Mon before the change: old plan
    expect(isScheduled(after, '2099-01-06')).toBe(false); // Tue before the change
    expect(isScheduled(after, '2099-01-08')).toBe(true); // Thu, new plan
    expect(isScheduled(after, '2099-01-12')).toBe(false); // Mon, new plan
    // Saving without a schedule change adds nothing; a change on the day it was made keeps no history.
    await updateHabit(h.id, { title: 'Read 20 pages', target: { type: 'days', days: [2, 4] } }, today);
    expect((await db.habits.get(h.id))!.targetHistory).toHaveLength(1);
    const fresh = await createHabit({ title: 'Walk', target: { type: 'daily' } });
    await updateHabit(fresh.id, { target: { type: 'perWeek', n: 3 } });
    expect((await db.habits.get(fresh.id))!.targetHistory).toBeUndefined();
  });
});
