import { describe, expect, it } from 'vitest';
import { newBase } from './entity';
import { toICS } from './ics';
import { AOE_TZ } from './tasks';
import type { CalendarEvent, Collection, CollectionRecord, Task } from './types';

const base = newBase('d');

describe('.ics export', () => {
  it('events with repeats and alarms, timed tasks, deadlines, yearly birthdays', () => {
    const ev: CalendarEvent = {
      ...base,
      id: 'ev1',
      title: 'Meeting with Prof. Rajan; weekly',
      start: Date.UTC(2026, 10, 19, 8, 30),
      end: Date.UTC(2026, 10, 19, 9, 30),
      allDay: false,
      rrule: 'FREQ=WEEKLY;BYDAY=TH',
      reminderOffsetsMin: [10],
    };
    const task = (over: Partial<Task>): Task => ({
      ...base,
      title: 'Submit form',
      priority: 4,
      status: 'not_started',
      kind: 'general',
      tags: [],
      custom: {},
      order: 'a0',
      ...over,
    });
    const people: Collection = {
      ...base,
      id: 'people',
      name: 'People',
      statusOptions: ['Family'],
      doneStatuses: [],
      fields: [
        { key: 'birthday', name: 'Birthday', type: 'date', yearly: true },
        { key: 'deadline', name: 'Deadline', type: 'deadline' },
      ],
      defaultView: 'table',
      order: 'a0',
    };
    const rec = (custom: Record<string, unknown>): CollectionRecord => ({
      ...newBase('d'),
      collectionId: 'people',
      title: 'Amma',
      status: 'Family',
      custom,
      tags: [],
      order: 'a0',
    });
    const ics = toICS(
      {
        events: [ev],
        tasks: [
          task({ id: 't1', dueDate: '2026-11-20', dueTime: '17:00' }),
          task({ id: 't2', dueDate: '2026-11-21' }),
          task({ id: 't3', dueDate: '2026-11-21', status: 'completed' }),
        ],
        collections: [people],
        records: [
          rec({ birthday: '1970-11-24' }),
          rec({ deadline: { date: '2026-03-01', time: '23:59', tz: AOE_TZ } }),
        ],
      },
      Date.UTC(2026, 10, 18),
      'Asia/Kolkata',
    );
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics).toContain(String.raw`SUMMARY:Meeting with Prof. Rajan\; weekly`);
    expect(ics).toContain('DTSTART:20261119T083000Z');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TH');
    expect(ics).toContain('TRIGGER:-PT10M');
    expect(ics).toContain('DTSTART:20261120T113000Z'); // 17:00 IST
    expect(ics).toContain('DTSTART;VALUE=DATE:20261121');
    expect(ics).toContain('DTEND;VALUE=DATE:20261122');
    expect(ics.match(/SUMMARY:☐ Submit form/g)).toHaveLength(2); // the completed one is left out
    expect(ics).toContain('DTSTART;VALUE=DATE:19701124');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
    expect(ics).toContain('DTSTART:20260302T115900Z'); // 23:59 AoE
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
