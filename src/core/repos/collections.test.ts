import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { datedItems, deadlineInstant, display, sortRecords } from '@/core/domain/collections';
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
    const items = datedItems([c], await db.records.toArray());
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
