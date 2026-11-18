import { describe, expect, it } from 'vitest';
import { newBase } from './entity';
import { closedTasks, completionsByDay, habitConsistency, periodOf, taskStats } from './analytics';
import type { ActivityLogEntry, Habit, HabitLog, Task } from './types';

const task = (over: Partial<Task>): Task => ({
  ...newBase('d'),
  title: 't',
  priority: 4,
  status: 'not_started',
  kind: 'general',
  tags: [],
  custom: {},
  order: 'a0',
  ...over,
});
const at = (d: string) => new Date(`${d}T12:00:00`).getTime();

describe('periods', () => {
  it('weeks start on the chosen day; months and years are whole', () => {
    const d = new Date(2026, 10, 18); // Wed 18 Nov 2026
    expect(periodOf('week', d)).toMatchObject({ from: '2026-11-16', to: '2026-11-22' });
    expect(periodOf('week', d, -1, 0)).toMatchObject({ from: '2026-11-08', to: '2026-11-14' });
    expect(periodOf('month', d)).toMatchObject({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodOf('year', d, 1)).toMatchObject({ from: '2027-01-01', to: '2027-12-31' });
  });
});

describe('completion rate', () => {
  it('completed ÷ (completed + skipped + missed); cancelled and due-today-open are left out', () => {
    const skipped = task({ status: 'skipped', updatedAt: at('2026-11-20') });
    const tasks = [
      task({ status: 'completed', completedAt: at('2026-11-17') }),
      task({ status: 'completed', completedAt: at('2026-11-18') }),
      task({ status: 'completed', completedAt: at('2026-11-30') }), // next week
      skipped,
      task({ dueDate: '2026-11-16' }), // missed
      task({ dueDate: '2026-11-18' }), // due today, still open: not missed yet
      task({ dueDate: '2026-11-17', status: 'cancelled' }),
      task({ status: 'completed', completedAt: at('2026-11-17'), parentTaskId: 'x' }), // subtask
    ];
    const log: ActivityLogEntry[] = [
      {
        id: 'l',
        ts: at('2026-11-17'),
        entityTable: 'tasks',
        entityId: skipped.id,
        action: 'skipped',
        deviceId: 'd',
      },
    ];
    const closed = closedTasks(tasks, log);
    const s = taskStats(tasks, closed, '2026-11-16', '2026-11-22', '2026-11-18');
    expect(s).toEqual({ completed: 2, skipped: 1, missed: 1, rate: 0.5 });
    expect(closed.find((c) => c.task.id === skipped.id)?.date).toBe('2026-11-17'); // from history
    expect(completionsByDay(closed).get('2026-11-17')).toBe(1);
  });

  it('nothing to judge gives no rate', () => {
    expect(taskStats([], [], '2026-11-16', '2026-11-22', '2026-11-18').rate).toBeNull();
  });
});

describe('habit consistency', () => {
  const habit = (target: Habit['target']): Habit => ({
    ...newBase('d', at('2026-11-01')),
    title: 'Gym',
    target,
    restDaysAllowed: true,
    order: 'a0',
  });
  const logs = (entries: [string, HabitLog['status']][]) =>
    new Map(entries.map(([date, status]) => [date, { ...newBase('d'), habitId: 'h', date, status }]));

  it('daily: rest days leave the target, today counts only once done', () => {
    const l = logs([
      ['2026-11-16', 'done'],
      ['2026-11-17', 'rest'],
    ]);
    // Mon done, Tue rest, Wed (today) not yet: 1 of 1.
    expect(habitConsistency(habit({ type: 'daily' }), l, '2026-11-16', '2026-11-22', '2026-11-18')).toEqual({
      done: 1,
      target: 1,
    });
  });

  it('per week: past weeks ask n, the current week never counts against you', () => {
    const l = logs([
      ['2026-11-09', 'done'],
      ['2026-11-10', 'done'],
      ['2026-11-16', 'done'],
    ]);
    const h = habit({ type: 'perWeek', n: 3 });
    expect(habitConsistency(h, l, '2026-11-09', '2026-11-22', '2026-11-18')).toEqual({ done: 3, target: 4 });
  });
});
