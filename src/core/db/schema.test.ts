import { afterEach, describe, expect, it } from 'vitest';
import { getDeviceId, resetDeviceIdCache } from '@/core/device';
import { newBase, touch } from '@/core/domain/entity';
import type { Task } from '@/core/domain/types';
import { ENTITY_TABLES, PersonalOSDB } from './schema';

let n = 0;
const fresh = () => new PersonalOSDB(`test-db-${++n}`);

afterEach(() => resetDeviceIdCache());

function makeTask(deviceId: string, over: Partial<Task> = {}): Task {
  return {
    ...newBase(deviceId),
    title: 'Read RT-2 paper',
    priority: 2,
    status: 'not_started',
    kind: 'general',
    tags: [],
    custom: {},
    order: 'a0',
    ...over,
  };
}

describe('database schema', () => {
  it('opens and exposes every entity table', async () => {
    const db = fresh();
    await db.open();
    const names = db.tables.map((t) => t.name);
    for (const t of ENTITY_TABLES) expect(names).toContain(t);
    expect(names).toEqual(expect.arrayContaining(['meta', 'activityLog', 'outbox']));
    expect(db.verno).toBe(4);
  });

  it('round-trips a task and queries it by indexes', async () => {
    const db = fresh();
    const task = makeTask('dev-1', { nodeId: 'research', dueDate: '2026-11-20', tags: ['t1', 't2'] });
    await db.tasks.add(task);

    expect(await db.tasks.get(task.id)).toEqual(task);
    expect(await db.tasks.where('nodeId').equals('research').count()).toBe(1);
    expect(await db.tasks.where('dueDate').below('2026-11-21').count()).toBe(1);
    expect(await db.tasks.where('tags').equals('t2').count()).toBe(1); // multi-entry index
  });

  it('supports compound indexes for habit logs', async () => {
    const db = fresh();
    await db.habitLogs.add({ ...newBase('d'), habitId: 'gym', date: '2026-11-17', status: 'done' });
    const hit = await db.habitLogs.where('[habitId+date]').equals(['gym', '2026-11-17']).first();
    expect(hit?.status).toBe('done');
  });

  it('auto-increments outbox sequence numbers', async () => {
    const db = fresh();
    const a = await db.outbox.add({
      table: 'tasks',
      entityId: 'x',
      op: 'put',
      changedFields: ['title'],
      ts: 1,
    });
    const b = await db.outbox.add({
      table: 'tasks',
      entityId: 'y',
      op: 'put',
      changedFields: ['title'],
      ts: 2,
    });
    expect(b).toBeGreaterThan(a);
  });
});

describe('entity helpers', () => {
  it('newBase creates sync-ready fields with time-sortable ids', () => {
    const a = newBase('dev', 1000);
    const b = newBase('dev', 1000);
    expect(a).toMatchObject({ createdAt: 1000, updatedAt: 1000, version: 1, deviceId: 'dev' });
    expect(a.id).not.toBe(b.id);
    expect(a.id < b.id).toBe(true); // UUIDv7 sorts by creation time
  });

  it('touch bumps version and never moves updatedAt backwards', () => {
    const e = { ...newBase('a', 5000) };
    expect(touch(e, 'b', 9000)).toEqual({ updatedAt: 9000, version: 2, deviceId: 'b' });
    // device clock behind the record's timestamp
    expect(touch(e, 'b', 1000).updatedAt).toBe(5001);
  });
});

describe('device id', () => {
  it('is created once and then reused', async () => {
    const db = fresh();
    const first = await getDeviceId(db);
    resetDeviceIdCache();
    const second = await getDeviceId(db);
    expect(first).toBe(second);
    expect((await db.meta.get('deviceId'))?.value).toBe(first);
  });
});

describe('migration v1 → v2', () => {
  it('keeps existing data and adds the pages table', async () => {
    const name = `test-db-mig-${++n}`;
    const { default: Dexie } = await import('dexie');
    const v1 = new Dexie(name);
    v1.version(1).stores({ tasks: 'id, nodeId', meta: 'key' });
    await v1.table('tasks').add({ id: 't1', title: 'Old task', nodeId: 'n1' });
    v1.close();

    const db = new PersonalOSDB(name);
    await db.open();
    expect(db.verno).toBe(4);
    expect((await db.tasks.get('t1'))?.title).toBe('Old task');
    expect(await db.pages.count()).toBe(0);
  });
});
