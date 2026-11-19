import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { occurrences } from '@/core/domain/events';
import { toICS } from '@/core/domain/ics';
import { resetDb } from '@/test/db-reset';
import {
  createEvent,
  editFollowing,
  editOccurrence,
  endSeriesBefore,
  restoreOccurrence,
  setSeriesEnd,
  skipOccurrence,
} from './events';

beforeEach(resetDb);

// Daily stand-up 09:00–09:30 from Mon 16 Nov 2026 (local time).
const at = (d: number, h = 9, m = 0) => new Date(2026, 10, d, h, m).getTime();
const days = async (id: string) =>
  occurrences((await db.events.get(id))!, at(16, 0), at(23, 0)).map((o) => new Date(o.start).getDate());
const standup = () =>
  createEvent({
    title: 'Stand-up',
    start: at(16),
    end: at(16, 9, 30),
    allDay: false,
    rrule: 'FREQ=DAILY',
    reminderOffsetsMin: [],
  });

describe('one occurrence of a repeating event', () => {
  it('delete just one day; undo brings it back', async () => {
    const ev = await standup();
    await skipOccurrence(ev.id, at(18));
    expect(await days(ev.id)).toEqual([16, 17, 19, 20, 21, 22]);
    await restoreOccurrence(ev.id, at(18));
    expect(await days(ev.id)).toEqual([16, 17, 18, 19, 20, 21, 22]);
  });

  it('change just one day: it becomes its own event; the series skips that day', async () => {
    const ev = await standup();
    const moved = await editOccurrence(ev.id, at(18), {
      title: 'Stand-up (moved)',
      start: at(18, 11),
      end: at(18, 11, 30),
      allDay: false,
      reminderOffsetsMin: [],
      rrule: 'FREQ=DAILY',
    });
    expect(moved.rrule).toBeUndefined(); // a single event
    expect(await days(ev.id)).toEqual([16, 17, 19, 20, 21, 22]);
    expect(occurrences(moved, at(16, 0), at(23, 0)).map((o) => o.start)).toEqual([at(18, 11)]);
  });

  it('delete this and following: earlier days stay; undo restores the series', async () => {
    const ev = await standup();
    const was = await endSeriesBefore(ev.id, at(20));
    expect(await days(ev.id)).toEqual([16, 17, 18, 19]);
    await setSeriesEnd(ev.id, was);
    expect(await days(ev.id)).toHaveLength(7);
    await expect(endSeriesBefore(ev.id, at(16))).rejects.toThrow(/whole series/);
  });

  it('change this and following: the old series stops, a new one carries on with the change', async () => {
    const ev = await standup();
    await skipOccurrence(ev.id, at(22)); // a later day already taken out stays out
    const next = await editFollowing(ev.id, at(19), {
      title: 'Stand-up',
      start: at(19),
      end: at(19, 9, 45), // longer from Thursday
      allDay: false,
      reminderOffsetsMin: [],
      rrule: 'FREQ=DAILY',
    });
    expect(await days(ev.id)).toEqual([16, 17, 18]);
    expect(await days(next.id)).toEqual([19, 20, 21]);
    expect((await db.events.get(next.id))!.end - at(19)).toBe(45 * 60_000);
  });

  it('.ics export carries the skipped days and the end of the series', async () => {
    const ev = await standup();
    await skipOccurrence(ev.id, at(18));
    await endSeriesBefore(ev.id, at(20));
    const ics = toICS({ events: [(await db.events.get(ev.id))!], tasks: [], collections: [], records: [] });
    expect(ics).toMatch(/RRULE:FREQ=DAILY;UNTIL=\d{8}T\d{6}Z/);
    expect(ics).toMatch(/EXDATE:\d{8}T\d{6}Z/);
  });
});
