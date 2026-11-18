import { describe, expect, it } from 'vitest';
import { goalProgress, logsByDate, projectProgress, streak, taskProgress, weekProgress } from './progress';
import type { Goal, Habit, HabitLog, Milestone, Project, Task } from './types';

const task = (status: Task['status'], over: Partial<Task> = {}) =>
  ({ id: Math.random().toString(), status, ...over }) as Task;

describe('honest progress', () => {
  it('only Completed counts as done; Skipped stays in the total; Cancelled leaves it', () => {
    const p = taskProgress([task('completed'), task('skipped'), task('not_started'), task('cancelled')]);
    expect(p).toEqual({ done: 1, total: 3, pct: 33 });
  });

  it('ignores subtasks and deleted tasks', () => {
    expect(
      taskProgress([
        task('completed'),
        task('completed', { parentTaskId: 'x' }),
        task('completed', { deletedAt: 1 }),
      ]),
    ).toEqual({ done: 1, total: 1, pct: 100 });
  });

  it('projects can count tasks, milestones, or a manual value', () => {
    const p = { id: 'p', progressMode: 'tasks' } as Project;
    const tasks = [
      task('completed', { projectId: 'p' }),
      task('in_progress', { projectId: 'p' }),
      task('completed', { projectId: 'q' }),
    ];
    expect(projectProgress(p, tasks, []).pct).toBe(50);
    const ms = [
      { projectId: 'p', weight: 1, doneAt: 1 },
      { projectId: 'p', weight: 3 },
    ] as Milestone[];
    expect(projectProgress({ ...p, progressMode: 'milestones' }, tasks, ms).pct).toBe(25);
    expect(projectProgress({ ...p, progressMode: 'manual', manualProgress: 70 }, tasks, ms).pct).toBe(70);
  });

  it('goals use their measure, else the average of their projects', () => {
    expect(goalProgress({ measure: { label: 'papers', current: 3, target: 30 } } as Goal, []).pct).toBe(10);
    expect(goalProgress({} as Goal, [50, 100]).pct).toBe(75);
  });
});

describe('habit streaks (gentle)', () => {
  const daily = { id: 'h', target: { type: 'daily' }, createdAt: 0 } as unknown as Habit;
  const log = (date: string, status: HabitLog['status']) => ({ habitId: 'h', date, status }) as HabitLog;

  it('counts done days back from today; today not done yet does not break it', () => {
    const logs = logsByDate(
      [log('2026-11-15', 'done'), log('2026-11-16', 'done'), log('2026-11-17', 'done')],
      'h',
    );
    expect(streak(daily, logs, '2026-11-18')).toBe(3);
  });

  it('rest days keep the streak, skipped days end it', () => {
    const logs = logsByDate(
      [
        log('2026-11-14', 'done'),
        log('2026-11-15', 'skipped'),
        log('2026-11-16', 'done'),
        log('2026-11-17', 'rest'),
      ],
      'h',
    );
    expect(streak(daily, logs, '2026-11-18')).toBe(1);
  });

  it('specific-day habits only look at their days', () => {
    const mwf = { ...daily, target: { type: 'days', days: [1, 3, 5] } } as Habit; // Mon Wed Fri
    const logs = logsByDate(
      [log('2026-11-13', 'done'), log('2026-11-16', 'done'), log('2026-11-18', 'done')],
      'h',
    );
    expect(streak(mwf, logs, '2026-11-18')).toBe(3); // Fri, Mon, Wed (today)
  });

  it('per-week habits count weeks that met the target', () => {
    const twice = { ...daily, target: { type: 'perWeek', n: 2 } } as Habit;
    const logs = logsByDate(
      [log('2026-11-09', 'done'), log('2026-11-11', 'done'), log('2026-11-16', 'done')],
      'h',
    );
    expect(streak(twice, logs, '2026-11-18')).toBe(1); // last week met; this week not yet
    expect(weekProgress(twice, logs, '2026-11-18')).toEqual({ done: 1, target: 2 });
  });
});
