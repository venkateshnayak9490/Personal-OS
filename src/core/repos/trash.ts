import { db } from '@/core/db';
import type { EntityTableName } from '@/core/db';
import type { BaseEntity } from '@/core/domain/types';
import { purge, restoreBatch, type BatchItem } from './write';

/** Tables whose records can be in the Trash (grows as modules are added). */
export const TRASHABLE: readonly EntityTableName[] = [
  'nodes',
  'tasks',
  'tags',
  'pages',
  'projects',
  'milestones',
  'goals',
  'habits',
  'habitLogs',
  'events',
  'messages',
  'collections',
  'records',
  'meetings',
];
export const TRASH_RETENTION_DAYS = 30;

export interface TrashEntry {
  batchId: string;
  tableName: EntityTableName;
  /** The record the user deleted. */
  root: BaseEntity & { title?: string; name?: string };
  /** Other records deleted along with it (subsections, tasks, subtasks). */
  extra: { nodes: number; tasks: number };
  deletedAt: number;
}

async function deletedRecords(): Promise<{ tableName: EntityTableName; rec: BaseEntity }[]> {
  const out: { tableName: EntityTableName; rec: BaseEntity }[] = [];
  for (const tableName of TRASHABLE) {
    const recs = await db
      .table<BaseEntity, string>(tableName)
      .filter((r) => !!r.deletedAt)
      .toArray();
    for (const rec of recs) out.push({ tableName, rec });
  }
  return out;
}

export async function listTrash(): Promise<TrashEntry[]> {
  const all = await deletedRecords();
  const byBatch = new Map<string, { tableName: EntityTableName; rec: BaseEntity }[]>();
  for (const r of all) {
    const key = r.rec.trashBatchId ?? r.rec.id;
    byBatch.set(key, [...(byBatch.get(key) ?? []), r]);
  }
  const entries: TrashEntry[] = [];
  for (const [batchId, members] of byBatch) {
    const root = members.find((m) => m.rec.id === batchId) ?? members[0]!;
    const others = members.filter((m) => m !== root);
    entries.push({
      batchId,
      tableName: root.tableName,
      root: root.rec,
      extra: {
        nodes: others.filter((o) => o.tableName === 'nodes').length,
        tasks: others.filter((o) => o.tableName === 'tasks').length,
      },
      deletedAt: root.rec.deletedAt!,
    });
  }
  return entries.sort((a, b) => b.deletedAt - a.deletedAt);
}

export async function restoreFromTrash(batchId: string): Promise<number> {
  return restoreBatch(batchId, TRASHABLE);
}

async function batchItems(batchId: string): Promise<BatchItem[]> {
  const all = await deletedRecords();
  return all
    .filter((r) => (r.rec.trashBatchId ?? r.rec.id) === batchId)
    .map((r) => ({ tableName: r.tableName, id: r.rec.id }));
}

export async function deleteForever(batchId: string): Promise<void> {
  await purge(await batchItems(batchId));
}

export async function emptyTrash(): Promise<void> {
  const all = await deletedRecords();
  await purge(all.map((r) => ({ tableName: r.tableName, id: r.rec.id })));
}

/** Permanently remove anything in the Trash for longer than the retention period. Runs at startup. */
export async function autoPurgeTrash(now: number = Date.now()): Promise<number> {
  const cutoff = now - TRASH_RETENTION_DAYS * 86_400_000;
  const old = (await deletedRecords()).filter((r) => r.rec.deletedAt! < cutoff);
  await purge(old.map((r) => ({ tableName: r.tableName, id: r.rec.id })));
  return old.length;
}
