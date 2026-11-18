import { generateKeyBetween } from 'fractional-indexing';
import { templateFor } from '@/content/collection-templates';
import { db } from '@/core/db';
import { newId } from '@/core/domain/entity';
import type { Collection, CollectionRecord, FieldDef } from '@/core/domain/types';
import { insert, patch, softDeleteBatch } from './write';

/** Lists (collections) and their items (records). Same write path: history, Trash, sync-ready. */

/**
 * Read-modify-write updates (a value inside `custom`, the `fields` array) run one at a time,
 * so two quick edits (type a value, click a star) can't overwrite each other.
 */
let chain: Promise<unknown> = Promise.resolve();
function serial<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> => {
    const run = chain.then(() => fn(...args));
    chain = run.catch(() => {});
    return run;
  };
}

const required = (s: string, what: string) => {
  const t = s.trim();
  if (!t) throw new Error(`A ${what} needs a name`);
  return t;
};

async function lastOrder(rows: { order: string; deletedAt?: number }[]) {
  const last = rows
    .filter((r) => !r.deletedAt)
    .map((r) => r.order)
    .sort()
    .at(-1);
  return generateKeyBetween(last ?? null, null);
}

export async function createCollection(input: {
  /** Fixed id for app-wide lists (People), so two devices don't each make one. */
  id?: string;
  templateKey: string;
  nodeId?: string;
  name?: string;
}): Promise<Collection> {
  const t = templateFor(input.templateKey) ?? templateFor('blank')!;
  return insert<Collection>('collections', {
    id: input.id,
    name: required(input.name ?? t.name, 'list'),
    icon: t.icon,
    nodeId: input.nodeId,
    templateKey: t.key,
    statusOptions: [...t.statusOptions],
    ...(t.statusName ? { statusName: t.statusName } : {}),
    doneStatuses: [...t.doneStatuses],
    fields: t.fields.map((f) => ({ ...f })),
    defaultView: t.defaultView,
    order: await lastOrder(await db.collections.toArray()),
  });
}

export type CollectionChanges = Partial<Pick<Collection, 'name' | 'nodeId' | 'defaultView' | 'doneStatuses'>>;

export async function updateCollection(id: string, changes: CollectionChanges) {
  if (changes.name !== undefined) changes = { ...changes, name: required(changes.name, 'list') };
  const res = await patch<Collection>('collections', id, changes);
  // Items follow their list to another section.
  if (res && 'nodeId' in changes)
    for (const r of await liveRecords(id))
      await patch<CollectionRecord>('records', r.id, { nodeId: changes.nodeId });
  return res;
}

export async function deleteCollection(id: string) {
  const records = await liveRecords(id);
  return softDeleteBatch([
    { tableName: 'collections', id },
    ...records.map((r) => ({ tableName: 'records' as const, id: r.id })),
  ]);
}

const liveRecords = async (collectionId: string) =>
  (await db.records.where('collectionId').equals(collectionId).toArray()).filter((r) => !r.deletedAt);

/* ---------- Fields ---------- */

export const addField = serial(async function addField(
  collectionId: string,
  f: Omit<FieldDef, 'key'>,
): Promise<FieldDef> {
  const c = await getCollection(collectionId);
  const field: FieldDef = { ...f, name: required(f.name, 'field'), key: `f${newId().slice(-8)}` };
  if (field.type === 'select') field.options = cleanList(field.options ?? []);
  await patch<Collection>('collections', collectionId, { fields: [...c.fields, field] });
  return field;
});

/** Rename a field or change a choice field's options. Values stay (they're stored by key). */
export const updateField = serial(async function updateField(
  collectionId: string,
  key: string,
  changes: Pick<FieldDef, 'name' | 'options'>,
) {
  const c = await getCollection(collectionId);
  const fields = c.fields.map((f) =>
    f.key === key
      ? {
          ...f,
          name: required(changes.name, 'field'),
          ...(f.type === 'select' ? { options: cleanList(changes.options ?? []) } : {}),
        }
      : f,
  );
  return patch<Collection>('collections', collectionId, { fields });
});

/** Remove a field. Its values stay inside the items (restorable from history), just hidden. */
export const removeField = serial(async function removeField(collectionId: string, key: string) {
  const c = await getCollection(collectionId);
  return patch<Collection>('collections', collectionId, { fields: c.fields.filter((f) => f.key !== key) });
});

export const moveField = serial(async function moveField(collectionId: string, key: string, dir: -1 | 1) {
  const c = await getCollection(collectionId);
  const i = c.fields.findIndex((f) => f.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= c.fields.length) return null;
  const fields = [...c.fields];
  [fields[i], fields[j]] = [fields[j]!, fields[i]!];
  return patch<Collection>('collections', collectionId, { fields });
});

/* ---------- Statuses ---------- */

/**
 * Replace the status list. Each row says which old status it was (`from`), so a rename carries
 * the items along; items whose status was removed move to the first status.
 */
export async function setStatuses(collectionId: string, rows: { from?: string; name: string }[]) {
  const names = rows.map((r) => r.name.trim());
  if (!names.length || names.some((n) => !n)) throw new Error('Every status needs a name');
  if (new Set(names).size !== names.length) throw new Error('Two statuses have the same name');
  const c = await getCollection(collectionId);
  const renamed = new Map(rows.filter((r) => r.from).map((r) => [r.from!, r.name.trim()]));
  for (const r of await liveRecords(collectionId)) {
    const next = renamed.get(r.status) ?? names[0]!;
    if (next !== r.status) await patch<CollectionRecord>('records', r.id, { status: next }, 'status_changed');
  }
  await patch<Collection>('collections', collectionId, {
    statusOptions: names,
    doneStatuses: c.doneStatuses.map((d) => renamed.get(d)).filter((d): d is string => !!d),
  });
}

/* ---------- Records ---------- */

export async function createRecord(
  collectionId: string,
  input: { title: string; status?: string; custom?: Record<string, unknown> },
): Promise<CollectionRecord> {
  const c = await getCollection(collectionId);
  return insert<CollectionRecord>('records', {
    collectionId,
    nodeId: c.nodeId,
    title: required(input.title, 'item'),
    status: input.status && c.statusOptions.includes(input.status) ? input.status : c.statusOptions[0]!,
    custom: input.custom ?? {},
    tags: [],
    order: await lastOrder(await liveRecords(collectionId)),
  });
}

export async function updateRecord(id: string, changes: Partial<Pick<CollectionRecord, 'title' | 'status'>>) {
  if (changes.title !== undefined) changes = { ...changes, title: required(changes.title, 'item') };
  return patch<CollectionRecord>('records', id, changes, 'status' in changes ? 'status_changed' : 'updated');
}

/** Set one field value; empty (undefined, '', null, false) removes it. */
export const setRecordValue = serial(async function setRecordValue(id: string, key: string, value: unknown) {
  const r = await db.records.get(id);
  if (!r) throw new Error('This item no longer exists');
  const custom = { ...r.custom };
  if (value === undefined || value === '' || value === null || value === false) delete custom[key];
  else custom[key] = value;
  return patch<CollectionRecord>('records', id, { custom });
});

export async function deleteRecord(id: string) {
  return softDeleteBatch([{ tableName: 'records', id }]);
}

async function getCollection(id: string): Promise<Collection> {
  const c = await db.collections.get(id);
  if (!c || c.deletedAt) throw new Error('This list no longer exists');
  return c;
}

const cleanList = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
