import { ChevronRight, Ellipsis, LayoutGrid, Plus, Settings2 } from 'lucide-react';
import { Link } from 'react-router';
import { comingSoon, nodePath, PRIMARY_NAV, SETTINGS_NAV, TRASH_NAV, type NavItem } from '@/app/nav';
import { useUIStore } from '@/app/ui-store';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui';
import type { TreeNode } from '@/core/domain/tree';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

function Row({ item, soon }: { item: NavItem; soon?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        'hover:bg-surface-2 active:bg-surface-2 flex min-h-14 items-center gap-3.5 px-4 transition-colors',
        soon && 'text-muted',
      )}
    >
      <Icon className="text-muted size-5 shrink-0" />
      <span className={cn('flex-1 truncate text-base', !soon && 'font-medium')}>{item.title}</span>
      {soon ? <span className="text-xs">Coming soon</span> : <ChevronRight className="text-muted size-4" />}
    </Link>
  );
}

function NodeRows({ t, tree }: { t: TreeNode; tree: NodeTree }) {
  const { node, depth, children } = t;
  return (
    <>
      <Link
        to={nodePath(node.id)}
        className={cn(
          'hover:bg-surface-2 active:bg-surface-2 flex items-center gap-3.5 px-4 transition-colors',
          depth === 0 ? 'min-h-14 text-base' : 'min-h-12 text-[15px]',
        )}
        style={{ paddingLeft: 16 + depth * 20 }}
      >
        <NodeIcon
          name={node.icon}
          className={cn('shrink-0', depth === 0 ? 'size-5' : 'size-4', colorFor(tree.colorOf(node.id)).text)}
        />
        <span className={cn('flex-1 truncate', depth === 0 && 'font-medium')}>{node.title}</span>
        <ChevronRight className="text-muted size-4" />
      </Link>
      {children.map((c) => (
        <NodeRows key={c.node.id} t={c} tree={tree} />
      ))}
    </>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-line border-line mb-4 divide-y overflow-hidden rounded-2xl border">{children}</div>
  );
}

/** Mobile "Sections" tab: your sections tree. */
export function SectionsPage() {
  const tree = useNodeTree();
  const open = useUIStore((s) => s.setNodeDialog);
  return (
    <>
      <PageHeader
        title="Sections"
        icon={LayoutGrid}
        actions={
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="New section"
              onClick={() => open({ mode: 'create' })}
            >
              <Plus className="size-5" />
            </Button>
            <Link
              to="/settings/sections"
              aria-label="Edit sections"
              className="text-muted hover:bg-surface-2 hover:text-fg -mr-2 grid size-11 place-items-center rounded-xl"
            >
              <Settings2 className="size-5" />
            </Link>
          </div>
        }
      />
      {tree?.visibleTree.map((t) => (
        <Group key={t.node.id}>
          <NodeRows t={t} tree={tree} />
        </Group>
      ))}
    </>
  );
}

/** Mobile "More" tab. */
export function MorePage() {
  const pick = (k: string) => PRIMARY_NAV.find((i) => i.key === k)!;
  return (
    <>
      <PageHeader title="More" icon={Ellipsis} />
      <Group>
        <Row item={pick('tasks')} />
        <Row item={SETTINGS_NAV} />
        <Row item={TRASH_NAV} />
      </Group>
      <h2 className="text-muted mt-8 mb-2 px-1 text-[13px] font-medium">Coming soon</h2>
      <Group>
        {comingSoon().map((i) => (
          <Row key={i.key} item={i} soon />
        ))}
      </Group>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted mt-1 text-sm">This page doesn’t exist (yet).</p>
      <Link to="/" className="text-accent mt-4 inline-block text-sm font-medium hover:underline">
        Go to Today
      </Link>
    </div>
  );
}
