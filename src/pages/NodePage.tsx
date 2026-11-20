import {
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  ListPlus,
  Pencil,
  Plus,
  Settings2,
  Trash,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { Menu } from '@/components/Menu';
import { Confirm } from '@/components/Sheet';
import { BlockHeader, Button, EmptyState, Loading } from '@/components/ui';
import { useAllTasks } from '@/core/hooks';
import { descendantIds, type TreeNode } from '@/core/domain/tree';
import { isClosed } from '@/core/domain/tasks';
import { deleteNode, updateNode } from '@/core/repos/nodes';
import { restoreFromTrash } from '@/core/repos/trash';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { SectionOutline } from '@/features/projects/ProjectOutline';
import { TaskList } from '@/features/tasks/TaskList';
import { cn } from '@/lib/cn';
import { ListsSection, TemplatePicker } from '@/features/collections/ListsSection';
import { OccasionsCalendar } from '@/features/collections/OccasionsCalendar';
import { SectionList } from '@/features/collections/SectionList';
import { sectionKind } from '@/features/structure/section-kinds';
import { MeetingsSection } from '@/features/meetings/MeetingsSection';
import { HealthSection } from '@/features/life/Health';
import { ThesisSection } from '@/features/life/ThesisSection';
import { GymSection } from '@/features/life/Gym';
import { MotivationLine } from '@/features/messages/MotivationLine';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

// The editor is loaded only when a section page opens (keeps the first load small).
import { LinkedNotes } from '@/features/notes/LinkedNotes';
import { CourseClasses, CourseworkDue } from '@/features/collections/Coursework';
const PageEditor = lazy(() => import('@/features/pages/PageEditor'));

export function NodePage() {
  const { nodeId = '' } = useParams();
  const t = useNodeTree();
  const tasks = useAllTasks();
  const navigate = useNavigate();
  const openDialog = useUIStore((s) => s.setNodeDialog);
  const includeSubs = true; // subsections' tasks are listed under the section's own outline
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickingList, setPickingList] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  useComposerContext({ nodeId });

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

  if (!t || !tasks) return <Loading />;
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
  const openCount = scoped.filter((x) => !x.parentTaskId && !isClosed(x.status)).length;
  // Tasks shown apart from the outline: in subsections, or in projects filed under this section.
  const others = scoped.filter((x) => x.nodeId !== node.id || !!x.projectId);
  const isGym = node.moduleKey === 'fitness';
  const isHealth = node.moduleKey === 'health';
  /** Sections with their own tools skip the generic meetings, lists and task box. */
  const ownTools = isGym || isHealth;
  // Each kind of section has its own tools: its own list (Papers, Watchlist…) and how much of the task box.
  const kind = sectionKind(node, node.parentId ? t.byId.get(node.parentId) : undefined);
  const tasksShown = kind.tasks === 'main' || openCount > 0 || (kind.tasks === 'more' && showTasks);

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
        <nav
          aria-label="Breadcrumb"
          className="text-meta text-muted mb-3 flex flex-wrap items-center gap-1"
        >
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
        <div className="min-w-0 flex-1">
          {/* Matches PageHeader: the title over a 2px ink rule, the section icon in its colour on the title line. */}
          <h1 className="title-page border-fg inline-flex max-w-full items-center gap-2 border-b-2 pb-2">
            <NodeIcon name={node.icon} className={cn('size-5 shrink-0', color.text)} />
            <span className="min-w-0">{node.title}</span>
          </h1>
          {node.hidden && <p className="text-meta text-muted mt-2">Hidden from navigation</p>}
          <MotivationLine
            key={node.id}
            keys={[...path].reverse().map((p) => (p.config.templateKey as string) ?? '')}
            nodeIds={path.map((p) => p.id)}
          />
        </div>
        <Menu
          trigger={
            <Button variant="ghost" size="icon" aria-label="Section options" className="-mr-2">
              <Settings2 className="size-5" />
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
            { label: 'Add a list here', icon: ListPlus, onSelect: () => setPickingList(true) },
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

      {isGym && <GymSection nodeId={node.id} />}
      {isHealth && <HealthSection />}

      {children.length > 0 && (
        <nav
          aria-label="Subsections"
          className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
        >
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
                  'border-line-strong hover:bg-surface-2 flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-[15px] transition-colors md:h-9 md:text-sm',
                  c.hidden && 'opacity-60',
                )}
              >
                <span aria-hidden className={cn('size-2 shrink-0 rounded-xs', cc.dot)} />
                <span className="font-medium">{c.title}</span>
                {open > 0 && <span className="text-meta text-muted tabular-nums">{open} open</span>}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Tools first: the section's own module, list and meetings, then its tasks, then the notes area. */}
      {node.moduleKey === 'thesis' && <ThesisSection />}

      {node.moduleKey === 'coursework' && <CourseworkDue node={node} tree={t} />}
      {kind.list === 'course' && <CourseClasses node={node} />}

      {kind.list === 'occasions' && <OccasionsCalendar nodeId={node.id} />}
      {kind.list && <SectionList nodeId={node.id} templateKey={kind.list} />}

      {!ownTools && <MeetingsSection nodeId={node.id} isMeetingsSection={node.moduleKey === 'meetings'} />}

      <ListsSection nodeId={node.id} ownTemplate={kind.list} />
      <TemplatePicker
        open={pickingList}
        onClose={() => setPickingList(false)}
        nodeId={node.id}
        suggested={path.map((p) => (p.config.templateKey as string) ?? '')}
      />

      {!tasksShown && kind.tasks === 'more' && (
        <Button variant="ghost" className="mb-8 -ml-4" onClick={() => setShowTasks(true)}>
          <Plus className="size-4" /> Add a task here
        </Button>
      )}

      {tasksShown && (
        <div className="mb-10">
          {/* This section's own tasks, written like a Notion page: "# " heading, Enter, Tab… */}
          <SectionOutline node={node} />
          {others.length > 0 && (
            <section aria-labelledby="others-heading" className="mt-8">
              <BlockHeader
                id="others-heading"
                title={
                  <>
                    From {children.length ? 'subsections and ' : ''}projects{' '}
                    <span className="text-muted font-normal">
                      {others.filter((x) => !isClosed(x.status)).length} open
                    </span>
                  </>
                }
              />
              <TaskList tasks={others} hideFilters showSection currentNodeId={node.id} />
            </section>
          )}
        </div>
      )}

      {/* The notes area: notes filed here, then this section's own free-form page (one quiet line when empty). */}
      <LinkedNotes nodeId={node.id} />
      <div className="-mt-4 mb-8">
        <Suspense fallback={<div className="min-h-10" />}>
          <PageEditor
            nodeId={node.id}
            placeholder="Write anything: notes, plans, ideas. Type “/” for headings, lists and checklists."
          />
        </Suspense>
      </div>

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
