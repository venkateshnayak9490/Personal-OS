import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { bests, cardioTotals, e1rm, lastTime, nextDayIndex, prSets, PROGRAMS } from '@/core/domain/fitness';
import { resetDb } from '@/test/db-reset';
import {
  addCardio,
  addSet,
  checkInGym,
  checkinId,
  correctHealthTime,
  logHealthEvent,
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
import { createHabit, setHabitLog } from './plans';
import { adherence, isScheduled, logsByDate } from '@/core/domain/progress';
import { restoreFromTrash } from './trash';

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

  it('a workout checks in the gym habit for that day', async () => {
    const gym = await createHabit({ title: 'Gym', target: { type: 'perWeek', n: 4 } });
    const read = await createHabit({ title: 'Read a book', target: { type: 'daily' } });
    await checkInGym('2026-11-18');
    await checkInGym('2026-11-18'); // twice is fine
    const logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    expect(logs.map((l) => [l.habitId, l.date, l.status])).toEqual([[gym.id, '2026-11-18', 'done']]);
    expect(logs.some((l) => l.habitId === read.id)).toBe(false);
  });
});

describe('check-ins', () => {
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
    const h = await createHabit({ title: 'Gym', target: { type: 'days', days: [1, 2, 3, 4, 5, 6] } });
    await checkInGym('2026-11-18', undefined, { id: 'w1', planned: 'Legs' });
    await checkInGym('2026-11-18', undefined, { id: 'w2', planned: 'Legs' }); // second workout that day
    let logs = (await db.habitLogs.toArray()).filter((l) => !l.deletedAt);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'done', workoutId: 'w1', planned: 'Legs' });
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
