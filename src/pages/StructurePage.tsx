import { ArrowDown, ArrowUp, Eye, EyeOff, FolderTree, Pencil, Plus, Trash } from 'lucide-react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui';
import type { TreeNode } from '@/core/domain/tree';
import { deleteNode, moveNodeStep, updateNode } from '@/core/repos/nodes';
import { restoreFromTrash } from '@/core/repos/trash';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

function Row({ t, tree, index, count }: { t: TreeNode; tree: NodeTree; index: number; count: number }) {
  const open = useUIStore((s) => s.setNodeDialog);
  const { node, depth, children } = t;
  const color = colorFor(tree.colorOf(node.id));
  const hiddenByParent =
    !node.hidden &&
    tree
      .path(node.id)
      .slice(0, -1)
      .some((a) => a.hidden);

  return (
    <>
      <li
        className={cn('flex items-center gap-1 py-1.5 pr-2', (node.hidden || hiddenByParent) && 'opacity-50')}
        style={{ paddingLeft: 8 + depth * 22 }}
      >
        <NodeIcon name={node.icon} className={cn('mr-2 size-4 shrink-0', color.text)} />
        <Link
          to={nodePath(node.id)}
          className={cn('min-w-0 flex-1 truncate text-sm hover:underline', depth === 0 && 'font-semibold')}
        >
          {node.title}
        </Link>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Move ${node.title} up`}
          disabled={index === 0}
          onClick={() => void attempt(() => moveNodeStep(node.id, 'up'))}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Move ${node.title} down`}
          disabled={index === count - 1}
          onClick={() => void attempt(() => moveNodeStep(node.id, 'down'))}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={node.hidden ? `Show ${node.title}` : `Hide ${node.title}`}
          title={node.hidden ? 'Hidden — click to show' : 'Hide from navigation'}
          onClick={() => void attempt(() => updateNode(node.id, { hidden: !node.hidden }))}
        >
          {node.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Edit ${node.title}`}
          onClick={() => open({ mode: 'edit', node })}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Add inside ${node.title}`}
          onClick={() => open({ mode: 'create', parentId: node.id })}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete ${node.title}`}
          className="hover:text-danger"
          onClick={() =>
            void attempt(async () => {
              const batch = await deleteNode(node.id);
              if (batch) toast(`Moved “${node.title}” to Trash`, () => restoreFromTrash(batch));
            })
          }
        >
          <Trash className="size-4" />
        </Button>
      </li>
      {children.map((c, i) => (
        <Row key={c.node.id} t={c} tree={tree} index={i} count={children.length} />
      ))}
    </>
  );
}

/** Settings → Sections: the whole tree, with reorder / hide / rename / nest / delete. */
export function StructurePage() {
  const tree = useNodeTree();
  const open = useUIStore((s) => s.setNodeDialog);
  return (
    <>
      <PageHeader
        title="Sections"
        icon={FolderTree}
        subtitle="Add, rename, reorder, nest, hide and recolor. Hidden sections keep their data."
        actions={
          <Button size="sm" variant="primary" onClick={() => open({ mode: 'create' })}>
            <Plus className="size-4" /> New section
          </Button>
        }
      />
      {tree && (
        <ul className="border-line bg-surface rounded-xl border py-1" aria-label="Sections">
          {tree.tree.map((t, i) => (
            <Row key={t.node.id} t={t} tree={tree} index={i} count={tree.tree.length} />
          ))}
        </ul>
      )}
      <p className="text-muted mt-3 text-xs">
        Tip: use <b>Edit</b> to move a section inside another one. Deleting moves it (with its subsections and
        tasks) to Trash for 30 days.
      </p>
    </>
  );
}
