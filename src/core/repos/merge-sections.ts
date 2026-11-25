import { db } from '@/core/db';
import type { BaseEntity, Collection, CollectionRecord, Page, SectionNode } from '@/core/domain/types';
import { savePage } from './pages';
import { updateProfileSettings } from './profile';
import { patch, softDeleteBatch, table, type BatchItem } from './write';

/** Tables whose records point at a section by `nodeId`. Pages and lists are merged separately. */
const NODE_REF_TABLES = [
  'tasks',
  'projects',
  'goals',
  'habits',
  'events',
  'meetings',
  'attachments',
  'focusSessions',
  'notes',
  'workoutSessions',
] as const;

type WithNode = BaseEntity & { nodeId?: string };

export interface SectionMerge {
  keep: SectionNode;
  drop: SectionNode;
}

/**
 * Starter sections that exist twice because two devices each ran setup before syncing: same
 * template, same place in the tree. Per group, the one with the most filed under it is kept
 * (then the oldest, then by id, so every device picks the same one). Parents come before children.
 */
export function planSectionMerges(
  nodes: SectionNode[],
  weight: (id: string) => number = () => 0,
): SectionMerge[] {
  const live = nodes.filter((n) => !n.deletedAt);
  const merges: SectionMerge[] = [];
  const walk = (parents: (string | undefined)[]) => {
    const groups = new Map<string, SectionNode[]>();
    for (const n of live) {
      if (!parents.includes(n.parentId)) continue;
      const key = typeof n.config?.templateKey === 'string' ? n.config.templateKey : n.id;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    for (const group of groups.values()) {
      group.sort(
        (a, b) => weight(b.id) - weight(a.id) || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      );
      const [keep, ...drops] = group;
      for (const drop of drops) merges.push({ keep: keep!, drop });
      walk(group.map((n) => n.id));
    }
  };
  walk([undefined]);
  return merges;
}

const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];

interface Doc {
  type?: string;
  content?: unknown[];
}

/**
 * Merge every duplicated starter section into one copy: tasks, projects, notes, list items, page
 * text, subsections and bottom-bar tabs move over. The spare copies go to the Trash as one entry.
 * Returns how many sections were merged. Safe to run again if it stops part-way.
 */
export async function mergeDuplicateSections(): Promise<number> {
  const nodes = await db.nodes.toArray();
  const weights = new Map<string, number>();
  const bump = (id?: string) => id && weights.set(id, (weights.get(id) ?? 0) + 1);
  for (const name of [...NODE_REF_TABLES, 'records'] as const)
    for (const r of await table<WithNode>(name).toArray()) if (!r.deletedAt) bump(r.nodeId);
  for (const p of await db.pages.toArray()) if (!p.deletedAt && p.text.trim()) bump(p.nodeId);

  const merges = planSectionMerges(nodes, (id) => weights.get(id) ?? 0);
  if (merges.length === 0) return 0;
  const dropped = new Set(merges.map((m) => m.drop.id));
  const trash: BatchItem[] = merges.map((m) => ({ tableName: 'nodes', id: m.drop.id }));

  for (const { keep, drop } of merges) {
    // Deleted records move too, so restoring one from the Trash puts it in the kept section.
    for (const name of NODE_REF_TABLES)
      for (const r of await table<WithNode>(name).toArray())
        if (r.nodeId === drop.id) await patch<WithNode>(name, r.id, { nodeId: keep.id });

    const lists = await db.collections.toArray();
    for (const c of lists.filter((l) => l.nodeId === drop.id)) {
      const twin = c.deletedAt
        ? undefined
        : lists.find((l) => l.nodeId === keep.id && !l.deletedAt && l.templateKey === c.templateKey);
      const records = (await db.records.toArray()).filter((r) => r.collectionId === c.id);
      if (!twin) {
        await patch<Collection>('collections', c.id, { nodeId: keep.id });
        for (const r of records) await patch<CollectionRecord>('records', r.id, { nodeId: keep.id });
        continue;
      }
      await patch<Collection>('collections', twin.id, {
        statusOptions: union(twin.statusOptions, c.statusOptions),
        doneStatuses: union(twin.doneStatuses, c.doneStatuses),
        fields: [...twin.fields, ...c.fields.filter((f) => !twin.fields.some((t) => t.key === f.key))],
      });
      for (const r of records)
        await patch<CollectionRecord>('records', r.id, { collectionId: twin.id, nodeId: keep.id });
      trash.push({ tableName: 'collections', id: c.id });
    }

    for (const child of nodes.filter((n) => n.parentId === drop.id && !dropped.has(n.id)))
      await patch<SectionNode>('nodes', child.id, { parentId: keep.id });

    const dropPage = await db.pages.get(drop.id);
    if (dropPage && !dropPage.deletedAt && dropPage.text.trim()) {
      const keepPage = await db.pages.get(keep.id);
      const both = keepPage && !keepPage.deletedAt && keepPage.text.trim() ? keepPage : null;
      await savePage(
        keep.id,
        both ? joinDocs(both, dropPage) : dropPage.doc,
        both ? `${both.text}\n\n${dropPage.text}` : dropPage.text,
      );
    }
    if (dropPage) trash.push({ tableName: 'pages', id: drop.id });
  }

  const keepOf = new Map(merges.map((m) => [`node:${m.drop.id}`, `node:${m.keep.id}`]));
  await updateProfileSettings((cur) =>
    Array.isArray(cur.bottomTabs)
      ? { bottomTabs: cur.bottomTabs.map((k: unknown) => (typeof k === 'string' && keepOf.get(k)) || k) }
      : {},
  );
  await softDeleteBatch(trash);
  return merges.length;
}

const blocks = (p: Page) => (p.doc as Doc | undefined)?.content ?? [];
const joinDocs = (a: Page, b: Page): Doc => ({ type: 'doc', content: [...blocks(a), ...blocks(b)] });
