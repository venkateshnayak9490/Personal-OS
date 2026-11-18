import { generateKeyBetween } from 'fractional-indexing';
import { db } from '@/core/db';
import type { NodeSeed } from '@/core/domain/templates';
import { descendantIds, sortedChildren, wouldCreateCycle } from '@/core/domain/tree';
import type { SectionNode } from '@/core/domain/types';
import { insert, patch, softDeleteBatch, type BatchItem } from './write';

async function liveNodes(): Promise<SectionNode[]> {
  return (await db.nodes.toArray()).filter((n) => !n.deletedAt);
}

async function orderAtEnd(parentId: string | undefined): Promise<string> {
  const siblings = sortedChildren(await liveNodes(), parentId);
  return generateKeyBetween(siblings.at(-1)?.order ?? null, null);
}

export interface NewNode {
  parentId?: string;
  title: string;
  icon?: string;
  color?: string;
  moduleKey?: string;
}

export async function createNode(input: NewNode): Promise<SectionNode> {
  const title = input.title.trim();
  if (!title) throw new Error('A section needs a name');
  return insert<SectionNode>('nodes', {
    parentId: input.parentId,
    title,
    icon: input.icon,
    color: input.color,
    moduleKey: input.moduleKey,
    order: await orderAtEnd(input.parentId),
    hidden: false,
    config: {},
  });
}

export type NodeChanges = Partial<Pick<SectionNode, 'title' | 'icon' | 'color' | 'hidden' | 'config'>>;

export async function updateNode(id: string, changes: NodeChanges) {
  if (changes.title !== undefined) {
    changes = { ...changes, title: changes.title.trim() };
    if (!changes.title) throw new Error('A section needs a name');
  }
  return patch<SectionNode>('nodes', id, changes);
}

/** Move one step up or down among its siblings. */
export async function moveNodeStep(id: string, direction: 'up' | 'down') {
  const nodes = await liveNodes();
  const node = nodes.find((n) => n.id === id);
  if (!node) return null;
  const sibs = sortedChildren(nodes, node.parentId);
  const i = sibs.findIndex((s) => s.id === id);
  let order: string;
  if (direction === 'up') {
    if (i <= 0) return null;
    order = generateKeyBetween(sibs[i - 2]?.order ?? null, sibs[i - 1]!.order);
  } else {
    if (i === -1 || i >= sibs.length - 1) return null;
    order = generateKeyBetween(sibs[i + 1]!.order, sibs[i + 2]?.order ?? null);
  }
  return patch<SectionNode>('nodes', id, { order });
}

/** Move under another parent (or to the top level when `parentId` is undefined). */
export async function moveNodeToParent(id: string, parentId: string | undefined) {
  const nodes = await liveNodes();
  if (wouldCreateCycle(nodes, id, parentId)) throw new Error('A section cannot be moved inside itself');
  const node = nodes.find((n) => n.id === id);
  if (!node || node.parentId === parentId) return null;
  const order = generateKeyBetween(sortedChildren(nodes, parentId).at(-1)?.order ?? null, null);
  return patch<SectionNode>('nodes', id, { parentId, order });
}

/** Soft-delete a section together with its subsections and their tasks (one Trash entry). */
export async function deleteNode(id: string): Promise<string | null> {
  const nodes = await liveNodes();
  const subtree = [id, ...descendantIds(nodes, id)];
  const inTree = new Set(subtree);
  const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && t.nodeId && inTree.has(t.nodeId));
  const pages = (await db.pages.toArray()).filter((p) => !p.deletedAt && inTree.has(p.nodeId));
  const lists = (await db.collections.toArray()).filter(
    (c) => !c.deletedAt && c.nodeId && inTree.has(c.nodeId),
  );
  const listIds = new Set(lists.map((c) => c.id));
  const records = (await db.records.toArray()).filter((r) => !r.deletedAt && listIds.has(r.collectionId));
  const meetings = (await db.meetings.toArray()).filter(
    (m) => !m.deletedAt && m.nodeId && inTree.has(m.nodeId),
  );
  const notes = (await db.notes.toArray()).filter((n) => !n.deletedAt && n.nodeId && inTree.has(n.nodeId));
  const items: BatchItem[] = [
    ...subtree.map((nid) => ({ tableName: 'nodes' as const, id: nid })),
    ...tasks.map((t) => ({ tableName: 'tasks' as const, id: t.id })),
    ...pages.map((p) => ({ tableName: 'pages' as const, id: p.id })),
    ...lists.map((c) => ({ tableName: 'collections' as const, id: c.id })),
    ...records.map((r) => ({ tableName: 'records' as const, id: r.id })),
    ...meetings.map((m) => ({ tableName: 'meetings' as const, id: m.id })),
    ...notes.map((n) => ({ tableName: 'notes' as const, id: n.id })),
  ];
  return softDeleteBatch(items);
}

/** Create a whole template tree (used by onboarding). Returns created nodes keyed by template key. */
export async function seedNodes(seeds: NodeSeed[]): Promise<Map<string, SectionNode>> {
  const created = new Map<string, SectionNode>();
  const walk = async (list: NodeSeed[], parentId: string | undefined) => {
    let prev: string | null = null;
    for (const s of list) {
      const order = generateKeyBetween(prev, null);
      prev = order;
      const node = await insert<SectionNode>('nodes', {
        parentId,
        title: s.title,
        icon: s.icon,
        color: s.color,
        moduleKey: s.moduleKey,
        order,
        hidden: false,
        config: { templateKey: s.key },
      });
      created.set(s.key, node);
      if (s.children?.length) await walk(s.children, node.id);
    }
  };
  // Append after any existing top-level sections.
  const existing = sortedChildren(await liveNodes(), undefined);
  if (existing.length) {
    const start = existing.at(-1)!.order;
    let prev: string | null = start;
    for (const s of seeds) {
      const order = generateKeyBetween(prev, null);
      prev = order;
      const node = await insert<SectionNode>('nodes', {
        title: s.title,
        icon: s.icon,
        color: s.color,
        moduleKey: s.moduleKey,
        order,
        hidden: false,
        config: { templateKey: s.key },
      });
      created.set(s.key, node);
      if (s.children?.length) await walk(s.children, node.id);
    }
    return created;
  }
  await walk(seeds, undefined);
  return created;
}
