import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { createNote, saveNoteBody } from '@/core/repos/notes';
import { createTask, updateTask } from '@/core/repos/tasks';
import { deleteForever } from '@/core/repos/trash';
import { deleteTask } from '@/core/repos/tasks';
import type { BaseEntity, Task } from '@/core/domain/types';
import { resetDb } from '@/test/db-reset';
import { MemoryBackend } from './backend';
import { syncOnce } from './engine';
import { mergeRecord } from './merge';

beforeEach(resetDb);

const serverTask = (s: MemoryBackend, id: string) => s.rows.get(`tasks:${id}`)!.data as unknown as Task;

/** Another device edits a field of the server copy at time `at`. */
function remoteEdit(s: MemoryBackend, id: string, changes: Partial<Task>, at: number) {
  const cur = serverTask(s, id);
  const ft = { ...cur._ft, ...Object.fromEntries(Object.keys(changes).map((k) => [k, at])) };
  s.remoteWrite({
    tbl: 'tasks',
    id,
    data: { ...cur, ...changes, _ft: ft, updatedAt: at, deviceId: 'phone' } as never,
    updated_at: at,
  });
}

describe('merge', () => {
  it('per field: the newer change of each field wins', () => {
    type R = BaseEntity & Record<string, unknown>;
    const base: R = {
      id: 't',
      createdAt: 1,
      updatedAt: 1,
      version: 1,
      deviceId: 'a',
      title: 'A',
      dueDate: '2026-11-20',
    };
    const laptop: R = { ...base, title: 'A (laptop)', _ft: { title: 10 }, updatedAt: 10, version: 2 };
    const phone: R = {
      ...base,
      dueDate: '2026-11-21',
      _ft: { dueDate: 12 },
      updatedAt: 12,
      version: 2,
      deviceId: 'b',
    };
    const { merged } = mergeRecord(laptop, phone);
    expect(merged).toMatchObject({
      title: 'A (laptop)',
      dueDate: '2026-11-21',
      _ft: { title: 10, dueDate: 12 },
    });
    expect(mergeRecord(phone, laptop).merged).toMatchObject({ title: 'A (laptop)', dueDate: '2026-11-21' });
  });
});

describe('sync engine', () => {
  it('first sync uploads everything, then only what changed', async () => {
    const s = new MemoryBackend();
    const t = await createTask({ title: 'Read RT-2' });
    const r1 = await syncOnce(s);
    expect(r1.pushed).toBeGreaterThan(0);
    expect(serverTask(s, t.id).title).toBe('Read RT-2');
    expect(await db.outbox.count()).toBe(0);
    expect([...s.rows.keys()].some((k) => k.startsWith('activityLog:'))).toBe(true);

    expect((await syncOnce(s)).pushed).toBe(0);
    await updateTask(t.id, { title: 'Read RT-2 paper' });
    expect((await syncOnce(s)).pushed).toBe(1);
  });

  it('pulls edits from another device and keeps both sides’ fields', async () => {
    const s = new MemoryBackend();
    const t = await createTask({ title: 'Read RT-2', priority: 4 });
    await syncOnce(s);
    // Phone changes the priority; this device changes the title, later.
    remoteEdit(s, t.id, { priority: 1 }, Date.now() + 1000);
    await new Promise((r) => setTimeout(r, 5));
    await updateTask(t.id, { title: 'Read RT-2 carefully' });
    await syncOnce(s);
    const here = (await db.tasks.get(t.id))!;
    expect(here).toMatchObject({ title: 'Read RT-2 carefully', priority: 1 });
    expect(serverTask(s, t.id)).toMatchObject({ title: 'Read RT-2 carefully', priority: 1 });
  });

  it('a write from another device in the middle of a push is merged, not overwritten', async () => {
    const s = new MemoryBackend();
    const t = await createTask({ title: 'A', priority: 4 });
    await syncOnce(s);
    await updateTask(t.id, { title: 'B' });
    // The phone writes right after this device has read the server copy.
    const orig = s.updateIfSeq.bind(s);
    let once = true;
    s.updateIfSeq = async (row, seq) => {
      if (once) {
        once = false;
        remoteEdit(s, t.id, { priority: 2 }, Date.now() + 1000);
      }
      return orig(row, seq);
    };
    await syncOnce(s);
    expect(serverTask(s, t.id)).toMatchObject({ title: 'B', priority: 2 });
  });

  it('long text changed on both sides: the newer wins and the other becomes a conflict copy', async () => {
    const s = new MemoryBackend();
    const n = await createNote({ title: 'Ideas' });
    await saveNoteBody(n.id, { type: 'doc' }, 'Original');
    await syncOnce(s);
    // Both devices edit the text before syncing; the phone's edit is newer.
    await saveNoteBody(n.id, { type: 'doc' }, 'Laptop version');
    const cur = s.rows.get(`notes:${n.id}`)!.data as Record<string, unknown>;
    const at = Date.now() + 5000;
    s.remoteWrite({
      tbl: 'notes',
      id: n.id,
      data: {
        ...cur,
        text: 'Phone version',
        _ft: { ...(cur._ft as object), text: at, doc: at },
        updatedAt: at,
      },
      updated_at: at,
    });
    const r = await syncOnce(s);
    expect(r.conflicts).toBe(1);
    expect((await db.notes.get(n.id))!.text).toBe('Phone version');
    const copy = (await db.notes.toArray()).find((x) => x.title.startsWith('Conflict copy'));
    expect(copy).toMatchObject({ title: 'Conflict copy: Ideas', text: 'Laptop version' });
  });

  it('deleting forever reaches the other devices', async () => {
    const s = new MemoryBackend();
    const t = await createTask({ title: 'Temp' });
    await syncOnce(s);
    const batch = await deleteTask(t.id);
    await deleteForever(batch!);
    await syncOnce(s);
    expect(s.rows.get(`tasks:${t.id}`)!.data._purged).toBe(true);
  });

  it('pulls a record created elsewhere, and a tombstone removes it', async () => {
    const s = new MemoryBackend();
    await syncOnce(s);
    const now = Date.now();
    const data = {
      id: 'x1',
      createdAt: now,
      updatedAt: now,
      version: 1,
      deviceId: 'phone',
      title: 'From phone',
      priority: 4,
      status: 'not_started',
      kind: 'general',
      tags: [],
      custom: {},
      order: 'a0',
    };
    s.remoteWrite({ tbl: 'tasks', id: 'x1', data, updated_at: now });
    await syncOnce(s);
    expect((await db.tasks.get('x1'))?.title).toBe('From phone');
    expect(await db.outbox.count()).toBe(0); // pulled rows don't echo back
    s.remoteWrite({ tbl: 'tasks', id: 'x1', data: { _purged: true, id: 'x1' }, updated_at: now + 1 });
    await syncOnce(s);
    expect(await db.tasks.get('x1')).toBeUndefined();
  });
});
