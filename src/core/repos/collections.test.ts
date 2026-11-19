import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { datedItems, deadlineInstant, display, gradeSummary, sortRecords } from '@/core/domain/collections';
import { occasionReminders } from '@/core/domain/reminders';
import { AOE_TZ } from '@/core/domain/tasks';
import { resetDb } from '@/test/db-reset';
import {
  addField,
  createCollection,
  createRecord,
  deleteCollection,
  removeField,
  setRecordValue,
  setStatuses,
  updateCollection,
} from './collections';
import { listTrash, restoreFromTrash } from './trash';

beforeEach(resetDb);

describe('collections', () => {
  it('a template gives statuses and fields; items start in the first status', async () => {
    const c = await createCollection({ templateKey: 'papers', nodeId: 'research' });
    expect(c.statusOptions[0]).toBe('To read');
    expect(c.fields.map((f) => f.name)).toContain('Authors');
    const r = await createRecord(c.id, { title: ' Diffusion Policy ' });
    expect(r).toMatchObject({ title: 'Diffusion Policy', status: 'To read', nodeId: 'research' });
  });

  it('renaming a status carries items along; removing one moves them to the first', async () => {
    const c = await createCollection({ templateKey: 'deadlines' });
    const a = await createRecord(c.id, { title: 'CoRL', status: 'Submitted' });
    const b = await createRecord(c.id, { title: 'ICRA', status: 'Writing' });
    await setStatuses(c.id, [
      { from: 'Planning', name: 'Planning' },
      { from: 'Submitted', name: 'Sent' },
      { name: 'Accepted' },
    ]);
    expect((await db.records.get(a.id))?.status).toBe('Sent');
    expect((await db.records.get(b.id))?.status).toBe('Planning');
    const after = await db.collections.get(c.id);
    expect(after?.statusOptions).toEqual(['Planning', 'Sent', 'Accepted']);
    expect(after?.doneStatuses).toEqual(['Sent']); // renamed along; "Skipped" was removed
    await expect(setStatuses(c.id, [{ name: 'A' }, { name: 'A' }])).rejects.toThrow(/same name/);
  });

  it('fields: values are kept by key, so renames and removals lose nothing', async () => {
    const c = await createCollection({ templateKey: 'blank' });
    const f = await addField(c.id, { name: 'Venue', type: 'text' });
    const r = await createRecord(c.id, { title: 'Paper' });
    await setRecordValue(r.id, f.key, 'RSS');
    await removeField(c.id, f.key);
    expect((await db.records.get(r.id))?.custom[f.key]).toBe('RSS');
    await setRecordValue(r.id, f.key, '');
    expect((await db.records.get(r.id))?.custom).toEqual({});
  });

  it('two quick edits to different fields both stick', async () => {
    const c = await createCollection({ templateKey: 'papers' });
    const r = await createRecord(c.id, { title: 'RT-2' });
    await Promise.all([setRecordValue(r.id, 'year', 2023), setRecordValue(r.id, 'rating', 4)]);
    expect((await db.records.get(r.id))?.custom).toEqual({ year: 2023, rating: 4 });
  });

  it('deleting a list trashes its items with it; restore brings both back', async () => {
    const c = await createCollection({ templateKey: 'ideas' });
    await createRecord(c.id, { title: 'Tactile sim' });
    const batch = await deleteCollection(c.id);
    expect((await listTrash()).find((e) => e.batchId === batch)).toBeTruthy();
    expect((await db.records.toArray()).every((r) => r.deletedAt)).toBe(true);
    await restoreFromTrash(batch!);
    expect((await db.records.toArray()).every((r) => !r.deletedAt)).toBe(true);
  });

  it('moving a list to another section moves its items', async () => {
    const c = await createCollection({ templateKey: 'ideas', nodeId: 'a' });
    const r = await createRecord(c.id, { title: 'x' });
    await updateCollection(c.id, { nodeId: 'b' });
    expect((await db.records.get(r.id))?.nodeId).toBe('b');
  });
});

describe('deadlines in AoE', () => {
  it('23:59 AoE is 12:59 UTC the next day (17:29 the next day in IST)', () => {
    const at = deadlineInstant({ date: '2026-03-01', time: '23:59', tz: AOE_TZ });
    expect(new Date(at).toISOString()).toBe('2026-03-02T11:59:00.000Z');
  });

  it('shows the deadline as announced, and only open items reach the calendar', async () => {
    const c = await createCollection({ templateKey: 'deadlines' });
    const f = c.fields.find((x) => x.type === 'deadline')!;
    const v = { date: '2026-03-01', time: '23:59', tz: AOE_TZ };
    expect(display(f, v)).toBe('1 Mar 2026 23:59 AoE');
    const open = await createRecord(c.id, { title: 'CoRL', custom: { [f.key]: v } });
    await createRecord(c.id, { title: 'Old', status: 'Submitted', custom: { [f.key]: v } });
    const items = datedItems([c], await db.records.toArray(), 0, Date.UTC(2030, 0));
    expect(items.map((i) => i.record.id)).toEqual([open.id]);
  });

  it('sorts by deadline with empty values last', async () => {
    const c = await createCollection({ templateKey: 'deadlines' });
    const k = c.fields[0]!.key;
    const late = await createRecord(c.id, {
      title: 'B',
      custom: { [k]: { date: '2026-05-01', time: '23:59' } },
    });
    const none = await createRecord(c.id, { title: 'C' });
    const early = await createRecord(c.id, {
      title: 'A',
      custom: { [k]: { date: '2026-02-01', time: '23:59' } },
    });
    const rs = await db.records.toArray();
    expect(sortRecords(rs, c, k, 'asc').map((r) => r.id)).toEqual([early.id, late.id, none.id]);
    expect(sortRecords(rs, c, k, 'desc').map((r) => r.id)).toEqual([late.id, early.id, none.id]);
  });
});

describe('people and courses', () => {
  it('birthdays repeat every year; one-off dates do not', async () => {
    const c = await createCollection({ id: 'people', templateKey: 'people' });
    expect(c.id).toBe('people');
    expect(c.statusName).toBe('Relation');
    await createRecord(c.id, { title: 'Amma', status: 'Family', custom: { birthday: '1970-11-24' } });
    const from = new Date(2026, 10, 18).getTime();
    const to = new Date(2027, 11, 31).getTime();
    const hits = datedItems([c], await db.records.toArray(), from, to);
    expect(hits.map((h) => new Date(h.at).toDateString())).toEqual([
      new Date(2026, 10, 24).toDateString(),
      new Date(2027, 10, 24).toDateString(),
    ]);
  });

  it("occasions: new kinds; a once-only date doesn't repeat; reminders N days before and on the day", async () => {
    const c = await createCollection({ templateKey: 'occasions' });
    expect(c.statusOptions).toEqual([
      'Birthday',
      'Anniversary',
      'Special occasion',
      'Personal event',
      'Important deadline',
      'Custom',
    ]);
    await createRecord(c.id, {
      title: 'Ravi',
      status: 'Birthday',
      custom: { date: '1999-11-25', remindDays: 3 },
    });
    await createRecord(c.id, {
      title: 'Thesis defence',
      status: 'Important deadline',
      custom: { date: '2026-11-25', repeats: 'once' },
    });
    const records = await db.records.toArray();
    const span = (a: Date, b: Date) => datedItems([c], records, a.getTime(), b.getTime());
    const nextYear = span(new Date(2027, 10, 1), new Date(2027, 11, 1));
    expect(nextYear.map((d) => d.record.title)).toEqual(['Ravi']); // the deadline was once
    const week = span(new Date(2026, 10, 22), new Date(2026, 10, 30));
    const nine = (d: string) => new Date(`${d}T09:05:00`).getTime();
    // Sun 22 Nov: 3 days before Ravi's birthday.
    expect(
      occasionReminders(week, '2026-11-22', nine('2026-11-22')).map((r) => [
        r.target.id.endsWith(':3d'),
        r.title,
      ]),
    ).toEqual([[true, 'In 3 days: Ravi · Birthday']]);
    // Wed 25 Nov: both on the day.
    expect(
      occasionReminders(week, '2026-11-25', nine('2026-11-25')).map((r) => r.title.split(' · ')[0]),
    ).toEqual(['Today: Ravi', 'Today: Thesis defence']);
    // Mon 23: nothing.
    expect(occasionReminders(week, '2026-11-23', nine('2026-11-23'))).toEqual([]);
  });

  it('grade so far counts only scored, weighted items', async () => {
    const c = await createCollection({ templateKey: 'course' });
    await createRecord(c.id, { title: 'A1', custom: { weight: 10, score: 8, outOf: 10 } });
    await createRecord(c.id, { title: 'Mid-sem', custom: { weight: 30, score: 45, outOf: 60 } });
    await createRecord(c.id, { title: 'End-sem', custom: { weight: 60 } });
    await createRecord(c.id, { title: 'Reading', custom: {} });
    expect(gradeSummary(await db.records.toArray())).toEqual({ earned: 30.5, graded: 40, total: 100 });
  });
});
