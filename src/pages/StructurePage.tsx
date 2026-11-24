import { ArrowDown, ArrowUp, Ellipsis, Eye, EyeOff, FolderTree, Pencil, Plus, Trash } from 'lucide-react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { Menu, type MenuItem } from '@/components/Menu';
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

  const actions: (MenuItem & { menuLabel: string; title?: string })[] = [
    {
      label: node.hidden ? `Show ${node.title}` : `Hide ${node.title}`,
      menuLabel: node.hidden ? 'Show' : 'Hide',
      title: node.hidden ? 'Hidden — click to show' : 'Hide from navigation',
      icon: node.hidden ? EyeOff : Eye,
      onSelect: () => void attempt(() => updateNode(node.id, { hidden: !node.hidden })),
    },
    {
      label: `Edit ${node.title}`,
      menuLabel: 'Edit',
      icon: Pencil,
      onSelect: () => open({ mode: 'edit', node }),
    },
    {
      label: `Add inside ${node.title}`,
      menuLabel: 'Add a section inside',
      icon: Plus,
      onSelect: () => open({ mode: 'create', parentId: node.id }),
    },
    {
      label: `Delete ${node.title}`,
      menuLabel: 'Delete',
      icon: Trash,
      danger: true,
      onSelect: () =>
        void attempt(async () => {
          const batch = await deleteNode(node.id);
          if (batch) toast(`Moved “${node.title}” to Trash`, () => restoreFromTrash(batch));
        }),
    },
  ];

  return (
    <>
      <li
        className={cn(
          'hover:bg-surface-2 flex items-center gap-1 py-1 pr-1 md:py-1',
          (node.hidden || hiddenByParent) && 'opacity-50',
        )}
        style={{ paddingLeft: 4 + depth * 22 }}
      >
        <NodeIcon name={node.icon} className={cn('mr-2 size-4 shrink-0', color.text)} />
        <Link
          to={nodePath(node.id)}
          className={cn(
            'min-w-0 flex-1 truncate py-2 text-base hover:underline md:py-0 md:text-sm',
            depth === 0 && 'font-semibold',
          )}
        >
          {node.title}
        </Link>
        <Button
          size="icon-sm"
          variant="ghost"
          className="max-md:size-11"
          aria-label={`Move ${node.title} up`}
          disabled={index === 0}
          onClick={() => void attempt(() => moveNodeStep(node.id, 'up'))}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="max-md:size-11"
          aria-label={`Move ${node.title} down`}
          disabled={index === count - 1}
          onClick={() => void attempt(() => moveNodeStep(node.id, 'down'))}
        >
          <ArrowDown className="size-4" />
        </Button>
        {/* Desktop: every action in the row. Phone: reorder stays, the rest goes in a menu. */}
        <div className="hidden items-center gap-1 md:flex">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="icon-sm"
              variant="ghost"
              aria-label={a.label}
              title={a.title}
              className={a.danger ? 'hover:text-danger' : undefined}
              onClick={a.onSelect}
            >
              {a.icon && <a.icon className="size-4" />}
            </Button>
          ))}
        </div>
        <Menu
          trigger={
            <Button
              size="icon"
              variant="ghost"
              aria-label={`More actions for ${node.title}`}
              className="md:hidden"
            >
              <Ellipsis className="size-4" />
            </Button>
          }
          items={actions.map((a) => ({ ...a, label: a.menuLabel }))}
        />
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
        <ul className="divide-line border-line-strong divide-y border-t" aria-label="Sections">
          {tree.tree.map((t, i) => (
            <Row key={t.node.id} t={t} tree={tree} index={i} count={tree.tree.length} />
          ))}
        </ul>
      )}
      <p className="text-meta text-muted mt-3">
        Tip: use <b>Edit</b> to move a section inside another one. Deleting moves it (with its subsections and
        tasks) to Trash for 30 days.
      </p>
    </>
  );
}
