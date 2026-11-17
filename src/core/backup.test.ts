import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { resetDb } from '@/test/db-reset';
import { exportAll, importBackup, parseBackup, tasksCsv } from './backup';
import { createNode } from './repos/nodes';
import { createTag } from './repos/tags';
import { createTask, setTaskStatus, updateTask } from './repos/tasks';

beforeEach(resetDb);

describe('backup', () => {
  it('round-trips everything through JSON (replace)', async () => {
    const n = await createNode({ title: 'Research' });
    const tag = await createTag('paper');
    const t = await createTask({ title: 'Read "RT-2", ASAP', nodeId: n.id, tags: [tag.id] });
    await setTaskStatus(t.id, 'completed');

    const file = parseBackup(JSON.stringify(await exportAll()));
    const before = {
      nodes: await db.nodes.toArray(),
      tasks: await db.tasks.toArray(),
      log: await db.activityLog.count(),
    };

    await resetDb();
    expect(await db.tasks.count()).toBe(0);
    await importBackup(file, 'replace');

    expect(await db.nodes.toArray()).toEqual(before.nodes);
    expect(await db.tasks.toArray()).toEqual(before.tasks);
    expect(await db.activityLog.count()).toBe(before.log);
  });

  it('merge keeps local data and lets the newer edit win', async () => {
    const t = await createTask({ title: 'Original' });
    const file = parseBackup(JSON.stringify(await exportAll()));
    await updateTask(t.id, { title: 'Edited after backup' });
    const extra = await createTask({ title: 'Only on this device' });

    const res = await importBackup(file, 'merge');
    expect(res).toMatchObject({ added: 0, updated: 0 });
    expect((await db.tasks.get(t.id))?.title).toBe('Edited after backup'); // local is newer
    expect(await db.tasks.get(extra.id)).toBeDefined();
  });

  it('rejects files that are not Personal OS backups or are damaged', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Personal OS backup/);
    const bad = {
      app: 'personal-os',
      formatVersion: 1,
      schemaVersion: 1,
      exportedAt: 1,
      tables: { tasks: [{ id: 1 }] },
    };
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/damaged/);
    const unknown = { ...bad, tables: { secrets: [] } };
    expect(() => parseBackup(JSON.stringify(unknown))).toThrow(/unknown data/);
    const newer = { ...bad, schemaVersion: 99, tables: {} };
    expect(() => parseBackup(JSON.stringify(newer))).toThrow(/newer version/);
  });

  it('exports tasks as CSV with section path and escaping', async () => {
    const work = await createNode({ title: 'Work' });
    const res = await createNode({ title: 'Research', parentId: work.id });
    await createTask({ title: 'Read "RT-2", ASAP', nodeId: res.id, dueDate: '2026-11-20' });
    const csv = await tasksCsv();
    const [header, row] = csv.split('\r\n');
    expect(header).toMatch(/^Title,Status,Priority,Section/);
    expect(row).toContain('"Read ""RT-2"", ASAP",Not started,Low,Work / Research,2026-11-20');
  });
});
