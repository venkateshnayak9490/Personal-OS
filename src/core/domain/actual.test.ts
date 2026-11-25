import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { createTask, recordOutcome, restoreOutcome, setTaskStatus } from '@/core/repos/tasks';
import { resetDb } from '@/test/db-reset';
import { startStats } from './actual';
import type { DayPlan, FocusSession, Task } from './types';

const D = '2026-11-25';
const at = (hhmm: string, d = D) => new Date(`${d}T${hhmm}`).getTime();
const task = (id: string, dueTime: string, more: Partial<Task> = {}) =>
  ({ id, title: id, status: 'in_progress', dueDate: D, dueTime, ...more }) as Task;

describe('planned vs actual start', () => {
  it('counts only recorded starts, against the plan and the adjusted plan', () => {
    const tasks = [
      task('onTime', '09:00', { startedAt: at('09:10') }),
      task('late', '10:00', { startedAt: at('11:00') }), // an hour late, but the day moved it to 10:50
      task('focus', '14:00', { status: 'completed' }), // started through a focus session
      task('never', '16:00'), // no start recorded: not counted, not inferred
      task('otherDay', '08:00', { startedAt: at('08:00', '2026-11-24') }),
    ];
    const sessions = [{ taskId: 'focus', start: at('14:30') }] as FocusSession[];
    const plans = [
      { date: D, items: [{ ref: 'tasks:late', state: 'accepted', adjustedStart: 10 * 60 + 50 }] },
    ] as DayPlan[];
    expect(startStats(tasks, sessions, plans, D, D)).toEqual({
      started: 3,
      onTimePlan: 1,
      onTimeAdjusted: 2,
      avgLateMin: Math.round((10 + 60 + 30) / 3),
      partly: 0,
      deferred: 0,
    });
  });

  it('counts partly done and deferred days in the period', () => {
    const t = task('t', '09:00', {
      outcomes: [
        { date: D, kind: 'partly' },
        { date: '2026-11-26', kind: 'deferred' },
      ],
    });
    expect(startStats([t], [], [], D, D)).toMatchObject({ partly: 1, deferred: 0, avgLateMin: null });
  });
});

describe('recording the actual', () => {
  beforeEach(resetDb);
  it('Start records when; back to not started clears it; finishing keeps it', async () => {
    const t = await createTask({ title: 'Write', dueDate: D, dueTime: '09:00' });
    await setTaskStatus(t.id, 'in_progress');
    const started = (await db.tasks.get(t.id))!.startedAt;
    expect(started).toBeTypeOf('number');
    await setTaskStatus(t.id, 'completed');
    expect((await db.tasks.get(t.id))!.startedAt).toBe(started);
    await setTaskStatus(t.id, 'not_started');
    expect((await db.tasks.get(t.id))!.startedAt).toBeUndefined();
  });

  it('partly done moves it on in progress, with the outcome; Undo puts it back', async () => {
    const t = await createTask({ title: 'Write', dueDate: D, dueTime: '09:00' });
    const before = await recordOutcome(t.id, 'partly', D, '2026-11-26');
    expect(await db.tasks.get(t.id)).toMatchObject({
      dueDate: '2026-11-26',
      status: 'in_progress',
      outcomes: [{ date: D, kind: 'partly' }],
      dueTime: '09:00',
    });
    await restoreOutcome(before);
    const back = (await db.tasks.get(t.id))!;
    expect([back.dueDate, back.status, back.outcomes]).toEqual([D, 'not_started', undefined]);
  });
});
