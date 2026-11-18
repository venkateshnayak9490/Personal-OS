import { describe, expect, it } from 'vitest';
import { occurrences } from './events';
import { dueReminders } from './reminders';
import type { CalendarEvent, Habit, Task } from './types';

const at = (s: string) => new Date(s).getTime();
const ev = (over: Partial<CalendarEvent> = {}) =>
  ({
    id: 'e',
    title: 'Group meeting',
    start: at('2026-11-16T10:00'),
    end: at('2026-11-16T11:00'),
    allDay: false,
    reminderOffsetsMin: [10],
    ...over,
  }) as CalendarEvent;

describe('event occurrences', () => {
  it('a one-off event appears only in ranges it overlaps', () => {
    expect(occurrences(ev(), at('2026-11-16T00:00'), at('2026-11-17T00:00'))).toHaveLength(1);
    expect(occurrences(ev(), at('2026-11-17T00:00'), at('2026-11-18T00:00'))).toHaveLength(0);
  });

  it('a weekly event repeats at the same time on its days', () => {
    const e = ev({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' });
    const os = occurrences(e, at('2026-11-16T00:00'), at('2026-11-30T00:00'));
    expect(os.map((o) => new Date(o.start).toString().slice(0, 3))).toEqual(['Mon', 'Wed', 'Mon', 'Wed']);
    expect(os.every((o) => new Date(o.start).getHours() === 10 && o.end - o.start === 3_600_000)).toBe(true);
  });
});

describe('reminders', () => {
  it('fires an event reminder its offset before the start, once in the window', () => {
    expect(dueReminders([ev()], [], at('2026-11-16T09:49'))).toHaveLength(0);
    const r = dueReminders([ev()], [], at('2026-11-16T09:51'));
    expect(r).toEqual([
      {
        target: { table: 'events', id: 'e' },
        title: 'Group meeting',
        fireAt: at('2026-11-16T09:50'),
        at: at('2026-11-16T10:00'),
      },
    ]);
    expect(dueReminders([ev()], [], at('2026-11-16T11:30'))).toHaveLength(0); // already over
  });

  it('fires for open tasks with a due time, not for done ones', () => {
    const task = {
      id: 't',
      title: 'Submit review',
      status: 'not_started',
      dueDate: '2026-11-16',
      dueTime: '17:00',
    } as Task;
    expect(dueReminders([], [task], at('2026-11-16T17:01'))).toHaveLength(1);
    expect(dueReminders([], [{ ...task, status: 'completed' }], at('2026-11-16T17:01'))).toHaveLength(0);
    expect(dueReminders([], [{ ...task, dueTime: undefined }], at('2026-11-16T17:01'))).toHaveLength(0);
  });

  it('fires for habits at their time on scheduled days, unless quiet', () => {
    const h = {
      id: 'h',
      title: 'DSA practice',
      target: { type: 'days', days: [1] },
      remindAt: '18:00',
    } as Habit;
    const mon = at('2026-11-16T18:05'); // a Monday
    expect(dueReminders([], [], mon, undefined, [h])).toEqual([
      {
        target: { table: 'habits', id: 'h' },
        title: 'DSA practice',
        fireAt: at('2026-11-16T18:00'),
        at: at('2026-11-16T18:00'),
      },
    ]);
    expect(dueReminders([], [], at('2026-11-16T17:55'), undefined, [h])).toHaveLength(0); // not yet
    expect(dueReminders([], [], mon, undefined, [h], new Set(['h']))).toHaveLength(0); // checked in
    expect(dueReminders([], [], at('2026-11-17T18:05'), undefined, [h])).toHaveLength(0); // Tuesday: not due
  });
});
