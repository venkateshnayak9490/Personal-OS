import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { bests, e1rm, prSets } from '@/core/domain/fitness';
import { resetDb } from '@/test/db-reset';
import {
  addSet,
  checkinId,
  createChapter,
  createWorkout,
  deleteChapter,
  logWriting,
  setCheckin,
} from './life';
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
});
