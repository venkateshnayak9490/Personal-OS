import { ChevronRight, CircleCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNow } from '@/app/use-now';
import { EmptyState, Segmented } from '@/components/ui';
import { useProfile, useTags } from '@/core/hooks';
import { compareTasks, isClosed } from '@/core/domain/tasks';
import type { Task, TaskStatus } from '@/core/domain/types';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { TaskRow, type MoveTargets } from './TaskRow';

export type StatusFilter = 'open' | 'completed' | 'skipped' | 'cancelled' | 'all';

// Cancelled tasks are rare; they show under "All".
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'all', label: 'All' },
];

/** How long a just-ticked task stays in the Open list (checked) before it leaves. */
const LINGER_MS = 900;

function matches(status: TaskStatus, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'open') return !isClosed(status);
  return status === f;
}

interface Props {
  /** Top-level and subtasks for this scope (subtasks are shown inside their parent). */
  tasks: Task[];
  showSection?: boolean;
  /** Don't label tasks with this section (the page you're on). */
  currentNodeId?: string;
  emptyText?: string;
  /** Hide the Open/Completed/Skipped/All switch (e.g. on Today, which only shows what's open). */
  hideFilters?: boolean;
  /** Inbox: rows get a "Move to…" picker. */
  moveTo?: MoveTargets;
}

export function TaskList({
  tasks,
  showSection,
  currentNodeId,
  emptyText = 'No tasks here yet.',
  hideFilters,
  moveTo,
}: Props) {
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [showClosed, setShowClosed] = useState(false);
  const [linger, setLinger] = useState<string[]>([]);
  const onCompleted = (id: string) => {
    setLinger((l) => [...l, id]);
    setTimeout(() => setLinger((l) => l.filter((x) => x !== id)), LINGER_MS);
  };
  const tagList = useTags();
  const tree = useNodeTree();
  const profile = useProfile();
  const tags = useMemo(() => new Map((tagList ?? []).map((t) => [t.id, t])), [tagList]);

  const { top, subsOf, counts } = useMemo(() => {
    const subsOf = new Map<string, Task[]>();
    for (const t of tasks)
      if (t.parentTaskId) subsOf.set(t.parentTaskId, [...(subsOf.get(t.parentTaskId) ?? []), t]);
    const ids = new Set(tasks.map((t) => t.id));
    // A subtask whose parent is outside this list is shown as a normal row.
    const top = tasks.filter((t) => !t.parentTaskId || !ids.has(t.parentTaskId));
    const counts = Object.fromEntries(
      FILTERS.map((f) => [f.value, top.filter((t) => matches(t.status, f.value)).length]),
    );
    return { top, subsOf, counts };
  }, [tasks]);

  const now = useNow();
  // A lingering task keeps its place (sorted as if still open) until it leaves.
  const asOpen = (t: Task): Task => (linger.includes(t.id) ? { ...t, status: 'not_started' } : t);
  const visible = top
    .filter((t) => matches(t.status, filter) || (filter === 'open' && linger.includes(t.id)))
    .sort((a, b) => compareTasks(asOpen(a), asOpen(b), now));
  // In the Open view, recently closed tasks can be revealed below.
  const recentlyClosed =
    filter === 'open'
      ? top
          .filter((t) => isClosed(t.status) && !linger.includes(t.id))
          .sort((a, b) => compareTasks(a, b, now))
          .slice(0, 20)
      : [];

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      subtasks={subsOf.get(t.id) ?? []}
      tags={tags}
      tree={tree}
      showSection={showSection && t.nodeId !== currentNodeId}
      timezone={profile?.timezone}
      now={now}
      lingering={linger.includes(t.id)}
      moveTo={isClosed(t.status) ? undefined : moveTo}
      onCompleted={onCompleted}
    />
  );

  return (
    <div>
      {!hideFilters && (
        <div className="mb-1">
          <Segmented
            as="tabs"
            full
            label="Filter by status"
            options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            value={filter}
            onChange={setFilter}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState compact icon={CircleCheck} title={filter === 'open' ? 'All clear' : 'Nothing here'}>
          {filter === 'open' ? emptyText : null}
        </EmptyState>
      ) : (
        <ul>{visible.map(row)}</ul>
      )}

      {recentlyClosed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowClosed(!showClosed)}
            aria-expanded={showClosed}
            className="text-muted hover:text-fg flex h-10 items-center gap-1 text-[13px] font-medium md:h-8 md:text-xs"
          >
            <ChevronRight className={cn('size-3.5 transition-transform', showClosed && 'rotate-90')} />
            Recently closed ({recentlyClosed.length})
          </button>
          {showClosed && <ul>{recentlyClosed.map(row)}</ul>}
        </div>
      )}
    </div>
  );
}
