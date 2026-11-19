import { describe, expect, it } from 'vitest';
import { occurrences } from './events';
import { dueReminders, latestRound, repeatOf } from './reminders';
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

  it('repeats every few hours until done, one round at a time, quiet overnight', () => {
    const repeat = { everyMin: 120, quiet: ['22:30', '07:00'] as [string, string] };
    const task = {
      id: 't',
      title: 'Submit SMAI',
      status: 'not_started',
      dueDate: '2026-11-16',
      dueTime: '17:00',
    } as Task;
    const rounds = (iso: string) =>
      dueReminders([], [task], at(iso), undefined, [], new Set(), repeat).map((r) => r.fireAt);
    expect(rounds('2026-11-16T16:59')).toEqual([]);
    expect(rounds('2026-11-16T17:30')).toEqual([at('2026-11-16T17:00')]);
    expect(rounds('2026-11-16T20:10')).toEqual([at('2026-11-16T19:00')]); // the latest round only
    expect(rounds('2026-11-16T23:30')).toEqual([]); // quiet hours
    expect(rounds('2026-11-17T09:15')).toEqual([at('2026-11-17T09:00')]); // overdue: keeps going next day
    expect(
      dueReminders(
        [],
        [{ ...task, status: 'completed' }],
        at('2026-11-17T09:15'),
        undefined,
        [],
        new Set(),
        repeat,
      ),
    ).toEqual([]);
    // A date-only deadline: from 9:00 on the day.
    const dateOnly = { ...task, dueTime: undefined };
    expect(
      dueReminders([], [dateOnly], at('2026-11-16T11:05'), undefined, [], new Set(), repeat)[0]!.fireAt,
    ).toBe(at('2026-11-16T11:00'));
    expect(latestRound(at('2026-11-16T22:00'), at('2026-11-17T00:10'), repeat)).toBeNull();
  });

  it('settings: 60 min by default, older hour settings carried over, own quiet hours', () => {
    expect(repeatOf({}, ['22:30', '07:00'])).toEqual({ everyMin: 60, quiet: ['22:30', '07:00'] });
    expect(repeatOf({ remindEveryH: 2 }, ['22:30', '07:00']).everyMin).toBe(120);
    expect(repeatOf({ remindEveryMin: 15, remindQuiet: ['23:00', '06:30'] }, ['22:30', '07:00'])).toEqual({
      everyMin: 15,
      quiet: ['23:00', '06:30'],
    });
  });

  it('a habit can remind just once or at its own pace; a task can remind ahead of its deadline', () => {
    const repeat = { everyMin: 60, quiet: ['22:30', '07:00'] as [string, string] };
    const habit = { id: 'h', title: 'Read', target: { type: 'daily' }, remindAt: '09:00' } as Habit;
    const rounds = (h: Habit, iso: string) =>
      dueReminders([], [], at(iso), undefined, [h], new Set(), repeat).map((r) => r.fireAt);
    expect(rounds(habit, '2026-11-16T11:20')).toEqual([at('2026-11-16T11:00')]); // hourly by default
    expect(rounds({ ...habit, remindRepeatMin: 0 }, '2026-11-16T11:20')).toEqual([at('2026-11-16T09:00')]);
    expect(rounds({ ...habit, remindRepeatMin: 30 }, '2026-11-16T11:20')).toEqual([at('2026-11-16T11:00')]);
    expect(rounds({ ...habit, remindRepeatMin: 30 }, '2026-11-16T11:40')).toEqual([at('2026-11-16T11:30')]);
    // Done or skipped today (in `quiet`): nothing.
    expect(dueReminders([], [], at('2026-11-16T11:20'), undefined, [habit], new Set(['h']), repeat)).toEqual(
      [],
    );

    const task = {
      id: 't',
      title: 'Submit',
      status: 'not_started',
      dueDate: '2026-11-16',
      dueTime: '17:00',
      remindBeforeMin: [60],
    } as Task;
    const tr = (iso: string, t = task) =>
      dueReminders([], [t], at(iso), undefined, [], new Set(), repeat).map((r) => r.fireAt);
    expect(tr('2026-11-16T15:59')).toEqual([]);
    expect(tr('2026-11-16T16:05')).toEqual([at('2026-11-16T16:00')]); // an hour before
    expect(tr('2026-11-16T18:30')).toEqual([at('2026-11-16T18:00')]); // overdue, hourly
    expect(tr('2026-11-16T18:30', { ...task, status: 'cancelled' })).toEqual([]);
    // AoE: 23:59 at UTC−12 is 11:59 UTC the next day.
    const aoe = { ...task, remindBeforeMin: undefined, dueTime: '23:59', timezone: 'Etc/GMT+12' };
    expect(
      dueReminders([], [aoe], Date.UTC(2026, 10, 17, 12, 0), 'UTC', [], new Set(), repeat)[0]?.fireAt,
    ).toBe(Date.UTC(2026, 10, 17, 11, 59));
  });
});
