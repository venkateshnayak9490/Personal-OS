import { useMemo } from 'react';
import { useNodes } from '@/core/hooks';
import { buildTree, pathTo, type TreeNode } from '@/core/domain/tree';
import type { SectionNode } from '@/core/domain/types';

export interface NodeTree {
  nodes: SectionNode[];
  /** Full tree including hidden nodes. */
  tree: TreeNode[];
  /** Tree without hidden nodes (and without children of hidden nodes) — for navigation. */
  visibleTree: TreeNode[];
  byId: Map<string, SectionNode>;
  /** Effective color: own color, else nearest ancestor's. */
  colorOf: (id: string | undefined) => string | undefined;
  path: (id: string) => SectionNode[];
}

export function useNodeTree(): NodeTree | undefined {
  const nodes = useNodes();
  return useMemo(() => {
    if (!nodes) return undefined;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const tree = buildTree(nodes);
    const visibleTree = buildTree(
      nodes.filter((n) => !n.hidden && !pathTo(nodes, n.id).some((a) => a.hidden)),
    );
    const colorOf = (id: string | undefined) => {
      if (!id) return undefined;
      for (const n of pathTo(nodes, id).reverse()) if (n.color) return n.color;
      return undefined;
    };
    return { nodes, tree, visibleTree, byId, colorOf, path: (id: string) => pathTo(nodes, id) };
  }, [nodes]);
}
