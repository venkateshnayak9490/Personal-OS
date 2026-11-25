import { describe, expect, it } from 'vitest';
import type { Task } from '@/core/domain/types';
import { upcomingReminders, type ReminderInputs } from '@/core/domain/upcoming';
import { toQueueRows } from './PushScheduler';

const at = (s: string) => new Date(s).getTime();
const task = (id: string, dueTime?: string) =>
  ({ id, title: `Task ${id}`, status: 'not_started', dueDate: '2026-11-17', dueTime }) as Task;
const inputs = (tasks: Task[]): ReminderInputs => ({
  events: [],
  tasks,
  habits: [],
  quietToday: new Set(),
  weekMet: new Set(),
  weekStartsOn: 1,
  repeat: { everyMin: 60, quiet: ['22:30', '07:00'] },
  plan: null,
  checkins: [],
  lists: [],
  records: [],
});

describe('push queue rows', () => {
  it('one reminder is one notification that opens its task; several at once become one', () => {
    const i = inputs([task('a', '10:00'), task('b', '11:00'), task('c', '11:00')]);
    const rows = toQueueRows(upcomingReminders(i, at('2026-11-17T09:30'), 1.6), i, '/s/health');
    expect(rows.map((r) => [r.title, r.body, r.url])).toEqual([
      ['Task a', 'Due at 10:00', '/?do=open&task=a'],
      // a repeats hourly, so its 11:00 round lands with b and c
      ['3 reminders', 'Task a · Task b · Task c', '/'],
    ]);
    expect(rows[1]!.id).toBe(`group:${at('2026-11-17T11:00')}`);
  });
});
