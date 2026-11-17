import { ChevronRight, Eye, EyeOff, FolderPlus, Pencil, Settings2, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { MODULES, nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { Menu } from '@/components/Menu';
import { MilestoneBadge } from '@/components/PageHeader';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState } from '@/components/ui';
import { useAllTasks } from '@/core/hooks';
import { descendantIds, type TreeNode } from '@/core/domain/tree';
import { isClosed } from '@/core/domain/tasks';
import { deleteNode, updateNode } from '@/core/repos/nodes';
import { restoreFromTrash } from '@/core/repos/trash';
import { useNodeTree } from '@/features/structure/use-tree';
import { QuickAdd, TaskList } from '@/features/tasks/TaskList';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

/** Short original lines; the context-aware message engine arrives in M2. */
const LINES: Record<string, string> = {
  work: 'Small, steady steps compound into discoveries.',
  research: 'Curiosity first, rigor always.',
  thesis: 'A page a day becomes a thesis.',
  coursework: 'Understand it, don’t just finish it.',
  meetings: 'Bring questions; leave with next steps.',
  ideas: 'Write it down before it disappears.',
  self: 'Show up today. Progress follows the habit, not the mood.',
  fitness: 'Show up today. Progress follows the habit, not the mood.',
  learning: 'Every expert kept going as a beginner.',
  personal: 'Make room for the people and moments that matter.',
  misc: 'A clear list makes a calm mind.',
};

export function NodePage() {
  const { nodeId = '' } = useParams();
  const t = useNodeTree();
  const tasks = useAllTasks();
  const navigate = useNavigate();
  const openDialog = useUIStore((s) => s.setNodeDialog);
  const [includeSubs, setIncludeSubs] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const node = t?.byId.get(nodeId);
  const scopeIds = useMemo(
    () =>
      t && node
        ? new Set([node.id, ...(includeSubs ? descendantIds(t.nodes, node.id) : [])])
        : new Set<string>(),
    [t, node, includeSubs],
  );
  const scoped = useMemo(
    () => (tasks ?? []).filter((x) => x.nodeId && scopeIds.has(x.nodeId)),
    [tasks, scopeIds],
  );

  if (!t || !tasks) return null;
  if (!node) {
    return (
      <EmptyState title="This section doesn’t exist">
        It may have been deleted.{' '}
        <Link to="/trash" className="text-accent font-medium hover:underline">
          Open Trash
        </Link>
      </EmptyState>
    );
  }

  const path = t.path(node.id);
  const color = colorFor(t.colorOf(node.id));
  const children = findChildren(t.tree, node.id) ?? [];
  const templateKey = (node.config.templateKey as string | undefined) ?? '';
  const line = LINES[templateKey] ?? LINES[(path[0]?.config.templateKey as string) ?? ''];
  const mod = node.moduleKey ? MODULES[node.moduleKey] : undefined;
  const openCount = scoped.filter((x) => !x.parentTaskId && !isClosed(x.status)).length;

  const remove = async () => {
    const batch = await attempt(() => deleteNode(node.id));
    if (batch) {
      toast(`Moved “${node.title}” to Trash`, () => restoreFromTrash(batch));
      navigate(node.parentId ? nodePath(node.parentId) : '/', { replace: true });
    }
  };

  return (
    <>
      {path.length > 1 && (
        <nav aria-label="Breadcrumb" className="text-muted mb-2 flex flex-wrap items-center gap-1 text-xs">
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <Link to={nodePath(p.id)} className="hover:text-fg">
                {p.title}
              </Link>
              <ChevronRight className="size-3" />
            </span>
          ))}
        </nav>
      )}

      <header className="mb-6 flex items-start gap-3">
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', color.soft)}>
          <NodeIcon name={node.icon} className={cn('size-5', color.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {node.title}
            {node.hidden && (
              <span className="text-muted ml-2 align-middle text-xs font-normal">(hidden)</span>
            )}
          </h1>
          {line && <p className="text-muted mt-0.5 text-sm italic">{line}</p>}
        </div>
        <Menu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Section options">
              <Settings2 className="size-4" />
            </Button>
          }
          items={[
            {
              label: 'Edit name, icon, color',
              icon: Pencil,
              onSelect: () => openDialog({ mode: 'edit', node }),
            },
            {
              label: 'Add subsection',
              icon: FolderPlus,
              onSelect: () => openDialog({ mode: 'create', parentId: node.id }),
            },
            node.hidden
              ? {
                  label: 'Show in navigation',
                  icon: Eye,
                  onSelect: () => void attempt(() => updateNode(node.id, { hidden: false })),
                }
              : {
                  label: 'Hide from navigation',
                  icon: EyeOff,
                  onSelect: () =>
                    void attempt(async () => {
                      await updateNode(node.id, { hidden: true });
                      toast(`“${node.title}” hidden`, () => updateNode(node.id, { hidden: false }));
                    }),
                },
            null,
            { label: 'Delete section…', icon: Trash, danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>

      {mod && (
        <div className="border-line mb-6 flex items-start justify-between gap-4 rounded-xl border border-dashed px-4 py-3">
          <p className="text-muted text-sm">{mod.summary}</p>
          <MilestoneBadge milestone={mod.milestone} />
        </div>
      )}

      {children.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map(({ node: c }) => {
            const cc = colorFor(t.colorOf(c.id));
            const sub = new Set([c.id, ...descendantIds(t.nodes, c.id)]);
            const open = tasks.filter(
              (x) => x.nodeId && sub.has(x.nodeId) && !x.parentTaskId && !isClosed(x.status),
            ).length;
            return (
              <Link
                key={c.id}
                to={nodePath(c.id)}
                className={cn(
                  'border-line bg-surface hover:bg-surface-2 flex items-center gap-3 rounded-xl border p-3.5 transition-colors',
                  c.hidden && 'opacity-60',
                )}
              >
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg', cc.soft)}>
                  <NodeIcon name={c.icon} className={cn('size-[18px]', cc.text)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="text-muted text-xs">
                    {open} open {open === 1 ? 'task' : 'tasks'}
                    {c.hidden ? ' · hidden' : ''}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <section aria-labelledby="tasks-heading">
        <div className="mb-3 flex items-center gap-3">
          <h2 id="tasks-heading" className="flex-1 text-sm font-semibold">
            Tasks <span className="text-muted font-normal">· {openCount} open</span>
          </h2>
          {children.length > 0 && (
            <label className="text-muted flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeSubs}
                onChange={(e) => setIncludeSubs(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Include subsections
            </label>
          )}
        </div>
        <div className="mb-3">
          <QuickAdd nodeId={node.id} placeholder={`Add a task to ${node.title}…`} />
        </div>
        <TaskList tasks={scoped} showSection={includeSubs && children.length > 0} currentNodeId={node.id} />
      </section>

      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${node.title}”?`}
        description={
          <>
            It moves to Trash with its subsections and tasks. You can restore it for 30 days. To keep it but
            stop seeing it, use <b>Hide from navigation</b> instead.
          </>
        }
        confirmLabel="Move to Trash"
        danger
        onConfirm={remove}
      />
    </>
  );
}

function findChildren(tree: TreeNode[], id: string): TreeNode[] | undefined {
  for (const t of tree) {
    if (t.node.id === id) return t.children;
    const hit = findChildren(t.children, id);
    if (hit) return hit;
  }
  return undefined;
}
