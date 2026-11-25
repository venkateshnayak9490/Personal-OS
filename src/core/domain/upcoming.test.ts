import { describe, expect, it } from 'vitest';
import type { CalendarEvent, Habit, Task } from './types';
import { upcomingReminders, type ReminderInputs } from './upcoming';

const at = (s: string) => new Date(s).getTime();
const base: ReminderInputs = {
  events: [],
  tasks: [],
  habits: [],
  quietToday: new Set(),
  weekMet: new Set(),
  weekStartsOn: 1,
  repeat: { everyMin: 60, quiet: ['22:30', '07:00'] },
  plan: null,
  checkins: [],
  lists: [],
  records: [],
};
const fires = (i: Partial<ReminderInputs>, now: string, hours = 48) =>
  upcomingReminders({ ...base, ...i }, at(now), hours).map((r) => [
    r.target.id,
    new Date(r.fireAt).toTimeString().slice(0, 5),
    r.category,
  ]);

describe('upcoming reminders for device notifications', () => {
  it('lists each future reminder once, with repeats until quiet hours, and nothing in the past', () => {
    const task = {
      id: 't',
      title: 'Submit SMAI',
      status: 'not_started',
      dueDate: '2026-11-16',
      dueTime: '20:00',
    } as Task;
    expect(fires({ tasks: [task] }, '2026-11-16T19:30', 4)).toEqual([
      ['t', '20:00', 'tasks'],
      ['t', '21:00', 'tasks'],
      ['t', '22:00', 'tasks'],
      // 23:00 is in quiet hours
    ]);
    expect(fires({ tasks: [task] }, '2026-11-16T20:30', 1)).toEqual([['t', '21:00', 'tasks']]);
  });

  it('covers events, habits and the gym habit, each in its category', () => {
    const event = {
      id: 'e',
      title: 'Group meeting',
      start: at('2026-11-17T10:00'),
      end: at('2026-11-17T11:00'),
      allDay: false,
      reminderOffsetsMin: [10],
    } as CalendarEvent;
    const read = {
      id: 'h',
      title: 'Read',
      target: { type: 'daily' },
      remindAt: '09:00',
      remindRepeatMin: 0,
    } as Habit;
    const gym = { ...read, id: 'g', title: 'Gym', remindAt: '07:30', source: 'gym' } as Habit;
    expect(fires({ events: [event], habits: [read, gym] }, '2026-11-17T06:00', 6)).toEqual([
      ['g', '07:30', 'gym'],
      ['h', '09:00', 'habits'],
      ['e', '09:50', 'events'],
    ]);
  });

  it('a habit done today stays quiet today but reminds again tomorrow', () => {
    const read = {
      id: 'h',
      title: 'Read',
      target: { type: 'daily' },
      remindAt: '09:00',
      remindRepeatMin: 0,
    } as Habit;
    expect(fires({ habits: [read], quietToday: new Set(['h']) }, '2026-11-17T06:00', 30)).toEqual([
      ['h', '09:00', 'habits'], // tomorrow's
    ]);
  });
});
