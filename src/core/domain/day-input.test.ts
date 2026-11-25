import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { restorePlanned, saveDayPlan, dayPlanId } from '@/core/repos/day-plans';
import { resetDb } from '@/test/db-reset';
import { DEFAULT_ADAPT, planDay } from './adapt';
import { dayItems, withAdjusted, type DaySource } from './day-input';
import { DEFAULT_PLAN } from './health';
import type { CalendarEvent, DayPlan, Habit, Task } from './types';

const D = '2026-11-25'; // a Wednesday
const task = (id: string, more: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    status: 'not_started',
    priority: 3,
    kind: 'general',
    dueDate: D,
    dueTime: '10:00',
    ...more,
  }) as Task;
const habit = (id: string, more: Partial<Habit> = {}) =>
  ({ id, title: id, target: { type: 'daily' }, remindAt: '18:00', ...more }) as Habit;
const src = (more: Partial<DaySource>): DaySource => ({
  date: D,
  tasks: [],
  habits: [],
  events: [],
  quiet: new Set(),
  plan: null,
  adapt: DEFAULT_ADAPT,
  ...more,
});
const byRef = (s: DaySource) => Object.fromEntries(dayItems(s).map((i) => [i.ref, i]));

describe('the planned day, as the engine reads it', () => {
  it('tasks: deadlines and Fixed time never move, in progress is untouched, done ones are left out', () => {
    const r = byRef(
      src({
        tasks: [
          task('a', { estimateMin: 45, priority: 1 }),
          task('d', { kind: 'deadline' }),
          task('f', { fixed: true }),
          task('p', { status: 'in_progress' }),
          task('x', { status: 'completed' }),
          task('o', { optional: true, afterId: 'a' }),
          task('later', { dueDate: '2026-11-26' }),
          task('untimed', { dueTime: undefined }),
        ],
      }),
    );
    expect(Object.keys(r).sort()).toEqual(['tasks:a', 'tasks:d', 'tasks:f', 'tasks:o', 'tasks:p']);
    expect(r['tasks:a']).toMatchObject({ kind: 'flexible', min: 45, tier: 1, start: 600 });
    expect(r['tasks:d']!.kind).toBe('fixed');
    expect(r['tasks:f']!.kind).toBe('fixed');
    expect(r['tasks:p']!.kind).toBe('done');
    expect(r['tasks:o']).toMatchObject({ tier: 4, min: 30, after: 'tasks:a' });
  });

  it('habits: once each, only on their days, not when done; gym defaults to 60 min', () => {
    const r = byRef(
      src({
        habits: [
          habit('read', { durationMin: 20 }),
          habit('gym', { source: 'gym', target: { type: 'days', days: [3] } }), // Wednesdays
          habit('swim', { target: { type: 'days', days: [1] } }), // Mondays only
          habit('done'),
          habit('nudge', { remindAt: undefined }),
        ],
        quiet: new Set(['done']),
      }),
    );
    expect(Object.keys(r).sort()).toEqual(['habits:gym', 'habits:read']);
    expect(r['habits:gym']!.min).toBe(60);
    expect(r['habits:read']).toMatchObject({ min: 20, tier: 2 });
  });

  it('meals move with waking until eaten; events are fixed', () => {
    const ev = {
      id: 'e',
      title: 'Group meeting',
      start: new Date(`${D}T15:00`).getTime(),
      end: new Date(`${D}T16:00`).getTime(),
      allDay: false,
    } as CalendarEvent;
    const r = byRef(
      src({
        plan: DEFAULT_PLAN,
        events: [ev],
        checkin: { meals: { breakfast: '08:40' } } as DaySource['checkin'],
      }),
    );
    expect(r['health:breakfast']).toBeUndefined();
    expect(r['health:lunch']).toMatchObject({ anchored: true, start: 13 * 60 + 30 });
    expect(Object.values(r).find((i) => i.title === 'Group meeting')).toMatchObject({
      kind: 'fixed',
      start: 900,
      min: 60,
    });
  });

  it('a time you set yourself is kept on the next re-plan', () => {
    const existing = {
      items: [{ ref: 'tasks:a', source: 'manual', state: 'accepted', adjustedStart: 900 }],
    } as DayPlan;
    const items = dayItems(src({ tasks: [task('a')], existing }));
    const r = planDay({
      plannedWake: 420,
      wake: 480,
      bed: 1380,
      now: 480,
      items,
      bufferMin: 10,
      thresholdMin: 20,
    });
    expect(r.placed[0]).toMatchObject({ ref: 'tasks:a', start: 900, reason: 'Your time' });
  });
});

describe('accepted times laid over tasks and habits', () => {
  const dp = {
    date: D,
    items: [
      { ref: 'tasks:a', state: 'accepted', adjustedStart: 11 * 60 + 15 },
      { ref: 'tasks:b', state: 'rejected', adjustedStart: 12 * 60 },
      { ref: 'habits:h', state: 'accepted', adjustedStart: 19 * 60 },
    ],
  } as DayPlan;
  it('only accepted moves, and tasks only on that day; planned records untouched', () => {
    const tasks = [task('a'), task('b'), task('a2', { dueDate: '2026-11-26' })];
    const r = withAdjusted(dp, tasks, [habit('h')]);
    expect(r.tasks.map((t) => t.dueTime)).toEqual(['11:15', '10:00', '10:00']);
    expect(r.habits[0]!.remindAt).toBe('19:00');
    expect(tasks[0]!.dueTime).toBe('10:00');
  });
});

describe('saving a day', () => {
  beforeEach(resetDb);
  it('one record per date, with history; Restore clears the moves and keeps the history', async () => {
    await saveDayPlan(D, { wake: 490, items: [] }, 'Woke at 08:10: 0 of 0 changes accepted', 1);
    await saveDayPlan(D, { deferred: [{ ref: 'tasks:x', title: 'x' }] }, 'Re-planned', 2);
    const before = await restorePlanned(D);
    expect(before?.deferred).toHaveLength(1);
    const dp = await db.dayPlans.get(dayPlanId(D));
    expect(dp).toMatchObject({ date: D, wake: 490, items: [], deferred: [] });
    expect(dp!.history.map((h) => h.text)).toEqual([
      'Woke at 08:10: 0 of 0 changes accepted',
      'Re-planned',
      'Planned times restored',
    ]);
    expect(await db.dayPlans.count()).toBe(1);
  });
});
