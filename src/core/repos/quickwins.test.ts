import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { missedWhileAway } from '@/core/domain/away';
import { datedItems } from '@/core/domain/collections';
import { resetDb } from '@/test/db-reset';
import { createCollection, createRecord } from './collections';
import { createEvent } from './events';
import { createHabit, setHabitLog } from './plans';
import { createTask, moveTasksTo, restoreDue } from './tasks';

beforeEach(resetDb);

const IST = 'Asia/Kolkata';
const at = (s: string) => new Date(s).getTime();

describe('re-plan everything overdue at once', () => {
  it('moves each to the date, keeps a time unless it would still be overdue; undo puts them back', async () => {
    const now = at('2026-11-18T15:00:00+05:30');
    const a = await createTask({ title: 'Morning one', dueDate: '2026-11-16', dueTime: '09:00' });
    const b = await createTask({ title: 'Evening one', dueDate: '2026-11-17', dueTime: '19:00' });
    const c = await createTask({ title: 'No time', dueDate: '2026-11-15' });
    const before = await moveTasksTo([a.id, b.id, c.id], '2026-11-18', now, IST);
    const t = async (id: string) => (await db.tasks.get(id))!;
    expect([(await t(a.id)).dueDate, (await t(a.id)).dueTime]).toEqual(['2026-11-18', undefined]); // 09:00 gone
    expect([(await t(b.id)).dueDate, (await t(b.id)).dueTime]).toEqual(['2026-11-18', '19:00']);
    expect((await t(c.id)).dueDate).toBe('2026-11-18');
    await restoreDue(before);
    expect([(await t(a.id)).dueDate, (await t(a.id)).dueTime]).toEqual(['2026-11-16', '09:00']);
    expect((await t(c.id)).dueDate).toBe('2026-11-15');
  });
});

describe('while you were away', () => {
  it('lists events that started, tasks that fell due and habit reminders missed in the gap', async () => {
    const gap = { from: at('2026-11-18T07:00:00+05:30'), to: at('2026-11-18T13:00:00+05:30') };
    const ev = await createEvent({
      title: 'Lab meeting',
      start: at('2026-11-18T10:00:00+05:30'),
      end: at('2026-11-18T11:00:00+05:30'),
      allDay: false,
      reminderOffsetsMin: [],
    });
    await createEvent({
      title: 'Later',
      start: at('2026-11-18T16:00:00+05:30'),
      end: at('2026-11-18T17:00:00+05:30'),
      allDay: false,
      reminderOffsetsMin: [],
    });
    const task = await createTask({ title: 'Submit form', dueDate: '2026-11-18', dueTime: '12:00' });
    const done = await createTask({ title: 'Already done', dueDate: '2026-11-18', dueTime: '11:00' });
    await db.tasks.update(done.id, { status: 'completed' });
    const read = await createHabit({ title: 'Read', target: { type: 'daily' }, remindAt: '09:00' });
    const dsa = await createHabit({ title: 'DSA', target: { type: 'daily' }, remindAt: '08:00' });
    await setHabitLog(dsa.id, '2026-11-18', 'done');
    const missed = missedWhileAway(
      gap,
      {
        events: await db.events.toArray(),
        tasks: await db.tasks.toArray(),
        habits: await db.habits.toArray(),
        logs: await db.habitLogs.toArray(),
      },
      IST,
    );
    expect(missed.map((m) => [m.kind, m.id])).toEqual([
      ['habit', read.id],
      ['event', ev.id],
      ['task', task.id],
    ]);
  });
});

describe('a birthday in People and in Occasions shows once', () => {
  it('same person, same day: one item (the occasion); different people stay', async () => {
    const people = await createCollection({ id: 'people', templateKey: 'people' });
    const occ = await createCollection({ templateKey: 'occasions' });
    await createRecord(people.id, { title: 'Ravi', status: 'Friends', custom: { birthday: '1999-11-25' } });
    await createRecord(people.id, { title: 'Asha', status: 'Friends', custom: { birthday: '2000-11-25' } });
    await createRecord(occ.id, {
      title: 'Ravi’s birthday',
      status: 'Birthday',
      custom: { date: '1999-11-25' },
    });
    const items = datedItems([people, occ], await db.records.toArray(), at('2026-11-20'), at('2026-12-01'));
    expect(items.map((d) => d.record.title).sort()).toEqual(['Asha', 'Ravi’s birthday']);
  });
});
