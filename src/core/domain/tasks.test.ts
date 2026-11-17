import { describe, expect, it } from 'vitest';
import { newBase } from './entity';
import { AOE_TZ, compareTasks, dueInstant, isOverdue } from './tasks';
import type { Task } from './types';

const task = (over: Partial<Task> = {}): Task => ({
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

describe('overdue (derived, never stored)', () => {
  it('date-only tasks become overdue at the end of the due day (in the given zone)', () => {
    const t = task({ dueDate: '2026-11-20' });
    const endOfDayIST = Date.UTC(2026, 10, 20, 18, 30); // 21 Nov 00:00 IST
    expect(dueInstant(t, 'Asia/Kolkata')).toBe(endOfDayIST);
    expect(isOverdue(t, endOfDayIST - 1, 'Asia/Kolkata')).toBe(false);
    expect(isOverdue(t, endOfDayIST, 'Asia/Kolkata')).toBe(true);
  });

  it('AoE deadlines are 23:59 at UTC−12 (= 17:29 next day IST)', () => {
    const t = task({ dueDate: '2026-11-20', dueTime: '23:59', timezone: AOE_TZ });
    expect(dueInstant(t, 'Asia/Kolkata')).toBe(Date.UTC(2026, 10, 21, 11, 59));
  });

  it('closed tasks are never overdue', () => {
    const past = Date.UTC(2030, 0, 1);
    for (const status of ['completed', 'skipped', 'cancelled'] as const)
      expect(isOverdue(task({ dueDate: '2026-01-01', status }), past, 'UTC')).toBe(false);
    expect(isOverdue(task({ dueDate: '2026-01-01' }), past, 'UTC')).toBe(true);
    expect(isOverdue(task(), past, 'UTC')).toBe(false); // no due date
  });
});

describe('task ordering', () => {
  it('open before closed; overdue first; then due date; then priority', () => {
    const now = Date.UTC(2026, 10, 17, 12);
    const list = [
      task({ title: 'done', status: 'completed', completedAt: now }),
      task({ title: 'no-due-p1', priority: 1 }),
      task({ title: 'due-later', dueDate: '2026-12-01' }),
      task({ title: 'overdue', dueDate: '2026-11-01' }),
      task({ title: 'due-soon', dueDate: '2026-11-18' }),
      task({ title: 'no-due-p4', priority: 4 }),
    ];
    expect(list.sort((a, b) => compareTasks(a, b, now)).map((t) => t.title)).toEqual([
      'overdue',
      'due-soon',
      'due-later',
      'no-due-p1',
      'no-due-p4',
      'done',
    ]);
  });
});
