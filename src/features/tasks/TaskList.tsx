import { ChevronRight, CircleCheck, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNow } from '@/app/use-now';
import { EmptyState } from '@/components/ui';
import { useProfile, useTags } from '@/core/hooks';
import { compareTasks, isClosed } from '@/core/domain/tasks';
import type { Task, TaskStatus } from '@/core/domain/types';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { addTask } from './actions';
import { TaskRow } from './TaskRow';

export type StatusFilter = 'open' | 'completed' | 'skipped' | 'cancelled' | 'all';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

function matches(status: TaskStatus, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'open') return !isClosed(status);
  return status === f;
}

/** Quick add: type a title, press Enter. */
export function QuickAdd({ nodeId, placeholder = 'Add a task…' }: { nodeId?: string; placeholder?: string }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void addTask({ title, nodeId });
        setTitle('');
      }}
      className="border-line bg-surface focus-within:border-accent flex items-center gap-2 rounded-xl border px-3"
    >
      <Plus className="text-muted size-4 shrink-0" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label="New task title"
        className="placeholder:text-muted/70 h-11 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
      />
      {title.trim() && (
        <button type="submit" className="bg-accent text-accent-fg rounded-md px-2.5 py-1 text-xs font-medium">
          Add
        </button>
      )}
    </form>
  );
}

interface Props {
  /** Top-level and subtasks for this scope (subtasks are shown inside their parent). */
  tasks: Task[];
  showSection?: boolean;
  /** Don't label tasks with this section (the page you're on). */
  currentNodeId?: string;
  emptyText?: string;
}

export function TaskList({ tasks, showSection, currentNodeId, emptyText = 'No tasks here yet.' }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [showClosed, setShowClosed] = useState(false);
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
  const visible = top.filter((t) => matches(t.status, filter)).sort((a, b) => compareTasks(a, b, now));
  // In the Open view, recently closed tasks can be revealed below.
  const recentlyClosed =
    filter === 'open'
      ? top
          .filter((t) => isClosed(t.status))
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
    />
  );

  return (
    <div>
      <div role="tablist" aria-label="Filter by status" className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              filter === f.value ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {f.label}
            <span className="ml-1 tabular-nums opacity-60">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={CircleCheck} title={filter === 'open' ? 'Nothing open' : 'Nothing here'}>
          {filter === 'open' ? emptyText : null}
        </EmptyState>
      ) : (
        <ul className="-mx-2">{visible.map(row)}</ul>
      )}

      {recentlyClosed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowClosed(!showClosed)}
            aria-expanded={showClosed}
            className="text-muted hover:text-fg flex items-center gap-1 text-xs font-medium"
          >
            <ChevronRight className={cn('size-3.5 transition-transform', showClosed && 'rotate-90')} />
            Recently closed ({recentlyClosed.length})
          </button>
          {showClosed && <ul className="-mx-2 mt-1">{recentlyClosed.map(row)}</ul>}
        </div>
      )}
    </div>
  );
}
