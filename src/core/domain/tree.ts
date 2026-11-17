import type { SectionNode } from './types';

export interface TreeNode {
  node: SectionNode;
  children: TreeNode[];
  depth: number;
}

const byOrder = (a: SectionNode, b: SectionNode) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0);

/** Build a sorted tree from a flat list. Nodes whose parent is missing become roots. */
export function buildTree(nodes: SectionNode[]): TreeNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string | undefined, SectionNode[]>();
  for (const n of nodes) {
    const key = n.parentId && ids.has(n.parentId) ? n.parentId : undefined;
    const list = kids.get(key) ?? [];
    list.push(n);
    kids.set(key, list);
  }
  const build = (parentId: string | undefined, depth: number): TreeNode[] =>
    (kids.get(parentId) ?? [])
      .sort(byOrder)
      .map((node) => ({ node, depth, children: build(node.id, depth + 1) }));
  return build(undefined, 0);
}

export function sortedChildren(nodes: SectionNode[], parentId: string | undefined): SectionNode[] {
  return nodes.filter((n) => (n.parentId ?? undefined) === parentId).sort(byOrder);
}

/** All descendant ids (not including `id`). */
export function descendantIds(nodes: SectionNode[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId === cur) {
        out.push(n.id);
        stack.push(n.id);
      }
    }
  }
  return out;
}

/** Ancestors from the root down to (and including) `id`. */
export function pathTo(nodes: SectionNode[], id: string): SectionNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const path: SectionNode[] = [];
  let cur = map.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return path;
}

/** True if moving `id` under `newParentId` would put a node inside itself. */
export function wouldCreateCycle(nodes: SectionNode[], id: string, newParentId: string | undefined): boolean {
  if (!newParentId) return false;
  if (newParentId === id) return true;
  return descendantIds(nodes, id).includes(newParentId);
}

/** Root section a node belongs to (for colors). */
export function rootOf(nodes: SectionNode[], id: string): SectionNode | undefined {
  return pathTo(nodes, id)[0];
}

/** Flatten a tree for <select> lists, with indentation depth. */
export function flatten(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap((t) => [t, ...flatten(t.children)]);
}
