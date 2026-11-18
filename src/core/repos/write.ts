import type { Table } from 'dexie';
import { db } from '@/core/db';
import type { EntityTableName } from '@/core/db';
import { getDeviceId } from '@/core/device';
import { newBase, newId, touch } from '@/core/domain/entity';
import type { ActivityAction, ActivityLogEntry, BaseEntity } from '@/core/domain/types';

/**
 * The ONLY write path for entity tables (build.md §6.2 rule 1).
 * Every write, in one IndexedDB transaction:
 *   1. writes the record (with version/updatedAt/deviceId bookkeeping)
 *   2. appends an immutable activityLog entry (source of truth for analytics & history)
 *   3. appends an outbox entry (pushed to the server once sync exists, M5)
 */

type AnyEntity = BaseEntity & Record<string, unknown>;

export function table<T extends BaseEntity>(name: EntityTableName): Table<T, string> {
  return db.table(name) as Table<T, string>;
}

/** Fields that never count as a "change" worth logging. */
const BOOKKEEPING = new Set(['updatedAt', 'version', 'deviceId', '_ft']);

/** Stamp the fields that changed with the time of this write (sync merges per field). */
export const stampFields = (rec: BaseEntity, fields: string[], at: number) => ({
  ...rec._ft,
  ...Object.fromEntries(fields.map((f) => [f, at])),
});

/** Returns {before, after} containing only the fields that actually changed. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown>; fields: string[] } {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const fields: string[] = [];
  for (const k of keys) {
    if (BOOKKEEPING.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      b[k] = before[k];
      a[k] = after[k];
      fields.push(k);
    }
  }
  return { before: b, after: a, fields };
}

interface LogInput {
  tableName: EntityTableName;
  entityId: string;
  action: ActivityAction;
  nodeId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  deviceId: string;
  ts: number;
}

async function log(input: LogInput, changedFields: string[], op: 'put' | 'delete' = 'put') {
  const entry: ActivityLogEntry = {
    id: newId(),
    ts: input.ts,
    entityTable: input.tableName,
    entityId: input.entityId,
    action: input.action,
    nodeId: input.nodeId,
    before: input.before,
    after: input.after,
    deviceId: input.deviceId,
  };
  await db.activityLog.add(entry);
  await db.outbox.add({ table: input.tableName, entityId: input.entityId, op, changedFields, ts: input.ts });
}

function nodeIdOf(tableName: EntityTableName, rec: AnyEntity | undefined): string | undefined {
  if (!rec) return undefined;
  if (tableName === 'nodes') return rec.id;
  return typeof rec.nodeId === 'string' ? rec.nodeId : undefined;
}

function tablesFor(tableName: EntityTableName) {
  return [db.table(tableName), db.activityLog, db.outbox];
}

/** Create a record. `data` excludes the base fields, which are generated. */
export async function insert<T extends BaseEntity>(
  tableName: EntityTableName,
  data: Omit<T, keyof BaseEntity> & Partial<Pick<BaseEntity, 'id'>>,
): Promise<T> {
  const deviceId = await getDeviceId(db);
  const now = Date.now();
  const base = newBase(deviceId, now);
  const record = { ...base, ...data, id: data.id ?? base.id } as unknown as T;
  await db.transaction('rw', tablesFor(tableName), async () => {
    await table<T>(tableName).add(record);
    await log(
      {
        tableName,
        entityId: record.id,
        action: 'created',
        nodeId: nodeIdOf(tableName, record as unknown as AnyEntity),
        after: record as unknown as Record<string, unknown>,
        deviceId,
        ts: now,
      },
      Object.keys(record),
    );
  });
  return record;
}

/**
 * Apply changes to a record and log exactly what changed.
 * Returns null when nothing changed (no log entry is written).
 */
export interface PatchOptions {
  /** Log which fields changed but not their values (large documents). */
  quiet?: boolean;
  /** Skip the activity-log entry if this record was already logged within this many ms (typing). */
  minLogIntervalMs?: number;
}

export async function patch<T extends BaseEntity>(
  tableName: EntityTableName,
  id: string,
  changes: Partial<T>,
  action: ActivityAction = 'updated',
  options: PatchOptions = {},
): Promise<{ before: T; after: T } | null> {
  const deviceId = await getDeviceId(db);
  return db.transaction('rw', tablesFor(tableName), async () => {
    const t = table<T>(tableName);
    const before = await t.get(id);
    if (!before) throw new Error(`${tableName}/${id} not found`);
    const now = Date.now();
    const merged = { ...before, ...changes } as T;
    // `undefined` in changes means "remove this field"
    for (const [k, v] of Object.entries(changes)) if (v === undefined) delete (merged as AnyEntity)[k];
    const d = diff(before as unknown as AnyEntity, merged as unknown as AnyEntity);
    if (d.fields.length === 0) return null;
    const stamp = touch(before, deviceId, now);
    const after = { ...merged, ...stamp, _ft: stampFields(before, d.fields, stamp.updatedAt) } as T;
    await t.put(after);
    if (options.minLogIntervalMs) {
      const last = await db.activityLog.where('[entityTable+entityId]').equals([tableName, id]).last();
      if (last && now - last.ts < options.minLogIntervalMs) {
        // Still queue it for sync, without another history line.
        await db.outbox.add({ table: tableName, entityId: id, op: 'put', changedFields: d.fields, ts: now });
        return { before, after };
      }
    }
    await log(
      {
        tableName,
        entityId: id,
        action,
        nodeId: nodeIdOf(tableName, after as unknown as AnyEntity),
        before: options.quiet ? undefined : d.before,
        after: options.quiet ? { fields: d.fields } : d.after,
        deviceId,
        ts: now,
      },
      d.fields,
    );
    return { before, after };
  });
}

export interface BatchItem {
  tableName: EntityTableName;
  id: string;
}

/** Soft-delete a group of records together (they share `trashBatchId` = the first item's id). */
export async function softDeleteBatch(items: BatchItem[]): Promise<string | null> {
  if (items.length === 0) return null;
  const batchId = items[0]!.id;
  const deviceId = await getDeviceId(db);
  const names = [...new Set(items.map((i) => i.tableName))];
  await db.transaction('rw', [...names.map((n) => db.table(n)), db.activityLog, db.outbox], async () => {
    const now = Date.now();
    for (const { tableName, id } of items) {
      const t = table<BaseEntity>(tableName);
      const rec = await t.get(id);
      if (!rec || rec.deletedAt) continue;
      const stamp = touch(rec, deviceId, now);
      await t.put({
        ...rec,
        deletedAt: now,
        trashBatchId: batchId,
        ...stamp,
        _ft: stampFields(rec, ['deletedAt', 'trashBatchId'], stamp.updatedAt),
      });
      await log(
        {
          tableName,
          entityId: id,
          action: 'deleted',
          nodeId: nodeIdOf(tableName, rec as AnyEntity),
          deviceId,
          ts: now,
          after: { trashBatchId: batchId },
        },
        ['deletedAt', 'trashBatchId'],
      );
    }
  });
  return batchId;
}

/** Restore every record of a trash batch. */
export async function restoreBatch(batchId: string, tableNames: readonly EntityTableName[]): Promise<number> {
  const deviceId = await getDeviceId(db);
  let count = 0;
  await db.transaction('rw', [...tableNames.map((n) => db.table(n)), db.activityLog, db.outbox], async () => {
    const now = Date.now();
    for (const tableName of tableNames) {
      const t = table<BaseEntity>(tableName);
      const recs = await t.filter((r) => r.trashBatchId === batchId).toArray();
      for (const rec of recs) {
        const stamp = touch(rec, deviceId, now);
        const restored = {
          ...rec,
          ...stamp,
          _ft: stampFields(rec, ['deletedAt', 'trashBatchId'], stamp.updatedAt),
        };
        delete restored.deletedAt;
        delete restored.trashBatchId;
        await t.put(restored);
        await log(
          {
            tableName,
            entityId: rec.id,
            action: 'restored',
            nodeId: nodeIdOf(tableName, rec as AnyEntity),
            deviceId,
            ts: now,
          },
          ['deletedAt', 'trashBatchId'],
        );
        count++;
      }
    }
  });
  return count;
}

/** Permanently remove records (Delete forever, auto-purge, or undoing a create). */
export async function purge(items: BatchItem[]): Promise<void> {
  if (items.length === 0) return;
  const deviceId = await getDeviceId(db);
  const names = [...new Set(items.map((i) => i.tableName))];
  await db.transaction('rw', [...names.map((n) => db.table(n)), db.activityLog, db.outbox], async () => {
    const now = Date.now();
    for (const { tableName, id } of items) {
      const t = table<BaseEntity>(tableName);
      const rec = await t.get(id);
      if (!rec) continue;
      await t.delete(id);
      await log(
        {
          tableName,
          entityId: id,
          action: 'purged',
          nodeId: nodeIdOf(tableName, rec as AnyEntity),
          deviceId,
          ts: now,
        },
        [],
        'delete',
      );
    }
  });
}
