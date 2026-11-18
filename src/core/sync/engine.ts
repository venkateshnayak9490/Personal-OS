import { db, ENTITY_TABLES, type EntityTableName } from '@/core/db';
import type { ActivityLogEntry, BaseEntity, Note } from '@/core/domain/types';
import { insert } from '@/core/repos/write';
import type { NewRow, ServerRow, SyncBackend } from './backend';
import { LONG_TEXT, mergeRecord } from './merge';

/**
 * Sync (build.md §9.2): pull what other devices wrote, merge per field, then push local changes.
 * Writes coming from the server go straight into the tables (never the outbox), so they don't
 * echo back. Safe to run any time; it does nothing when there's nothing to do.
 */

const CURSOR = 'sync.cursor';
const UPLOADED = 'sync.uploadedAll';
const LOG_TS = 'sync.logTs';
/** Re-read a little before the cursor: rows committed out of order are never missed (merging is idempotent). */
const OVERLAP = 200;
const PAGE = 500;
const LOG = 'activityLog';

type Rec = BaseEntity & Record<string, unknown>;
const isEntityTable = (t: string): t is EntityTableName => (ENTITY_TABLES as readonly string[]).includes(t);
const metaGet = async <T>(key: string) => (await db.meta.get(key))?.value as T | undefined;
const metaSet = (key: string, value: unknown) => db.meta.put({ key, value });
const seenKey = (tbl: string, id: string) => `${tbl}:${id}`;

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
}

export async function syncOnce(backend: SyncBackend): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, conflicts: 0 };
  await pull(backend, result);
  await push(backend, result);
  return result;
}

/** Fields changed locally and not pushed yet. */
async function pendingFields(tbl: string, id: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (const e of await db.outbox.where('entityId').equals(id).toArray())
    if (e.table === tbl) for (const f of e.changedFields) out.add(f);
  return out;
}

/**
 * Merge a server copy into the local one. When both sides changed a long text since this device
 * last saw the record, the losing text is saved as a "Conflict copy" note: nothing is silently lost.
 */
async function mergeIn(tbl: EntityTableName, local: Rec, remote: Rec, result: SyncResult): Promise<Rec> {
  const { merged, remoteWon, localWon } = mergeRecord(local, remote);
  const seen = (await db.syncSeen.get(seenKey(tbl, local.id)))?.ft ?? {};
  const pending = await pendingFields(tbl, local.id);
  const remoteChanged = (k: string) => (remote._ft?.[k] ?? remote.createdAt) > (seen[k] ?? 0);
  const clash = [...remoteWon, ...localWon].filter(
    (k) => LONG_TEXT.has(k) && pending.has(k) && remoteChanged(k),
  );
  if (clash.length) {
    const loser = remoteWon.some((k) => clash.includes(k)) ? local : remote;
    await saveConflictCopy(tbl, loser);
    result.conflicts++;
  }
  return merged as Rec;
}

async function saveConflictCopy(tbl: string, loser: Rec) {
  const name = String(loser.title ?? loser.name ?? (loser.date ? `Journal ${loser.date}` : tbl));
  const text = String(loser.text ?? loser.description ?? loser.agenda ?? '');
  await insert<Note>('notes', {
    title: `Conflict copy: ${name}`,
    text,
    ...(loser.doc ? { doc: loser.doc } : {}),
    pinned: true,
  });
}

/* ---------- Pull ---------- */

async function pull(backend: SyncBackend, result: SyncResult) {
  let cursor = (await metaGet<number>(CURSOR)) ?? 0;
  for (;;) {
    const rows = await backend.fetchSince(Math.max(0, cursor - OVERLAP), PAGE);
    const fresh = rows.filter((r) => r.seq > cursor - OVERLAP);
    for (const r of fresh) if (await applyRow(r, result)) result.pulled++;
    const max = Math.max(cursor, ...rows.map((r) => r.seq));
    const advanced = max > cursor;
    cursor = max;
    await metaSet(CURSOR, cursor);
    if (rows.length < PAGE || !advanced) break;
  }
}

/** Returns true when it changed something here. */
async function applyRow(r: ServerRow, result: SyncResult): Promise<boolean> {
  if (r.tbl === LOG) {
    if (await db.activityLog.get(r.id)) return false;
    await db.activityLog.put(r.data as unknown as ActivityLogEntry);
    return true;
  }
  if (!isEntityTable(r.tbl)) return false; // a newer app version's table: ignored until updated
  const t = db.table<Rec, string>(r.tbl);
  const local = await t.get(r.id);
  if (r.data._purged) {
    if (!local) return false;
    await t.delete(r.id);
    return true;
  }
  const remote = r.data as Rec;
  // Deleted forever here and not pushed yet: don't bring it back.
  if (
    !local &&
    (await db.outbox
      .where('entityId')
      .equals(r.id)
      .filter((e) => e.op === 'delete')
      .count())
  )
    return false;
  const next = local ? await mergeIn(r.tbl, local, remote, result) : remote;
  await db.syncSeen.put({ key: seenKey(r.tbl, r.id), ft: { ...remote._ft, _: remote.createdAt } });
  if (local && JSON.stringify(next) === JSON.stringify(local)) return false;
  await t.put(next);
  return true;
}

/* ---------- Push ---------- */

async function push(backend: SyncBackend, result: SyncResult) {
  const outbox = await db.outbox.toArray();
  const lastSeq = Math.max(0, ...outbox.map((e) => e.seq ?? 0));
  const uploadedAll = await metaGet<boolean>(UPLOADED);
  // First sign-in uploads everything (data imported from backups never went through the outbox).
  const targets = new Map<string, Set<string>>();
  if (!uploadedAll) {
    for (const tbl of ENTITY_TABLES)
      targets.set(tbl, new Set((await db.table(tbl).toCollection().primaryKeys()) as string[]));
  }
  for (const e of outbox) {
    if (!isEntityTable(e.table)) continue;
    if (!targets.has(e.table)) targets.set(e.table, new Set());
    targets.get(e.table)!.add(e.entityId);
  }

  for (const [tbl, idSet] of targets) {
    const ids = [...idSet];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      // One request per 100 records for the first look; retries re-read one at a time.
      const servers = new Map((await backend.fetchByIds(tbl, chunk)).map((r) => [r.id, r]));
      for (const id of chunk)
        result.pushed += await pushOne(backend, tbl as EntityTableName, id, result, servers.get(id) ?? null);
    }
  }

  // History is append-only.
  const since = (await metaGet<number>(LOG_TS)) ?? -1;
  const logs = await db.activityLog.where('ts').above(since).toArray();
  for (let i = 0; i < logs.length; i += 500) {
    const chunk = logs.slice(i, i + 500);
    await backend.appendLog(chunk.map((l) => ({ tbl: LOG, id: l.id, data: l as never, updated_at: l.ts })));
    await metaSet(LOG_TS, Math.max(...chunk.map((l) => l.ts)));
  }

  // Only now forget what was pushed (anything written meanwhile stays for next time).
  await db.outbox.where('seq').belowOrEqual(lastSeq).delete();
  await metaSet(UPLOADED, true);
}

/** Push one record, merging with a newer server copy if another device got there first. */
async function pushOne(
  backend: SyncBackend,
  tbl: EntityTableName,
  id: string,
  result: SyncResult,
  first: ServerRow | null,
): Promise<number> {
  const t = db.table<Rec, string>(tbl);
  for (let attempt = 0; attempt < 5; attempt++) {
    let local = await t.get(id);
    const server = attempt === 0 ? (first ?? undefined) : (await backend.fetchByIds(tbl, [id]))[0];
    const row = (data: Record<string, unknown>): NewRow => ({
      tbl,
      id,
      data,
      updated_at: Number(data.updatedAt ?? Date.now()),
    });
    if (!local) {
      // Deleted forever here: leave a tombstone so other devices delete it too.
      if (!server || server.data._purged) return 0;
      if (await backend.updateIfSeq(row({ _purged: true, id }), server.seq)) return 1;
      continue;
    }
    if (server && !server.data._purged) {
      const merged = await mergeIn(tbl, local, server.data as Rec, result);
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        await t.put(merged);
        local = merged;
      }
      if (JSON.stringify(local) === JSON.stringify(server.data)) return 0;
      if (await backend.updateIfSeq(row(local), server.seq)) {
        await db.syncSeen.put({ key: seenKey(tbl, id), ft: { ...local._ft, _: local.createdAt } });
        return 1;
      }
      continue; // someone wrote in between: read again and merge
    }
    if (server?.data._purged) {
      // Deleted forever elsewhere: honour it.
      await t.delete(id);
      return 0;
    }
    if ((await backend.insert(row(local))) === 'ok') {
      await db.syncSeen.put({ key: seenKey(tbl, id), ft: { ...local._ft, _: local.createdAt } });
      return 1;
    }
  }
  throw new Error('Sync kept colliding with another device. It will try again shortly.');
}

/** Forget everything about the server (sign-out): the next sign-in uploads and merges again. */
export async function resetSyncState() {
  await db.meta.bulkDelete([CURSOR, UPLOADED, LOG_TS]);
  await db.syncSeen.clear();
}
