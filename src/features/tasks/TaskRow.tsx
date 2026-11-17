import {
  Ban,
  CalendarClock,
  Copy,
  Ellipsis,
  ListChecks,
  Pencil,
  Play,
  RotateCcw,
  SkipForward,
  Trash,
} from 'lucide-react';
import { useState } from 'react';
import { useUIStore } from '@/app/ui-store';
import { Menu } from '@/components/Menu';
import { dueLabel, isClosed, isOverdue, STATUS_LABEL } from '@/core/domain/tasks';
import type { Tag, Task } from '@/core/domain/types';
import type { NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';
import { changeStatus, copyTask, removeTask, toggleComplete } from './actions';
import { SkipDialog } from './SkipDialog';
import { TagChip, TaskCheck } from './TaskBits';

interface Props {
  task: Task;
  subtasks: Task[];
  tags: Map<string, Tag>;
  tree?: NodeTree;
  showSection?: boolean;
  timezone?: string;
  now: number;
  /** Just ticked: show it checked for a moment before it leaves the Open list. */
  lingering?: boolean;
  onCompleted?: (id: string) => void;
}

export function TaskRow({
  task,
  subtasks,
  tags,
  tree,
  showSection,
  timezone,
  now,
  lingering,
  onCompleted,
}: Props) {
  const openEditor = useUIStore((s) => s.setEditingTaskId);
  const [skipping, setSkipping] = useState(false);
  const closed = isClosed(task.status);
  const overdue = isOverdue(task, now, timezone);
  const due = dueLabel(task, now);
  const node = task.nodeId ? tree?.byId.get(task.nodeId) : undefined;
  const subsDone = subtasks.filter((s) => s.status === 'completed').length;
  const taskTags = task.tags.map((id) => tags.get(id)).filter((t): t is Tag => !!t);

  return (
    <li
      className={cn(
        'group border-line/70 relative flex items-start gap-3.5 border-b py-3.5 last:border-b-0 md:gap-3 md:py-2.5',
        lingering && 'opacity-60 transition-opacity duration-500',
      )}
    >
      <div className="pt-px md:pt-0.5">
        <TaskCheck
          status={task.status}
          priority={task.priority}
          animate={lingering}
          label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => {
            if (task.status !== 'completed') onCompleted?.(task.id);
            void toggleComplete(task);
          }}
        />
      </div>
      <button type="button" onClick={() => openEditor(task.id)} className="min-w-0 flex-1 text-left">
        <div
          className={cn(
            'text-base leading-snug md:text-sm',
            closed && 'text-muted decoration-muted/60 line-through',
          )}
        >
          {task.title}
        </div>
        <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] empty:hidden md:text-xs">
          {due && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-danger font-medium')}>
              <CalendarClock className="size-3.5" />
              {overdue ? `Overdue · ${due}` : due}
            </span>
          )}
          {task.status === 'in_progress' && (
            <span className="text-fg inline-flex items-center gap-1 font-medium">
              <Play className="size-3" /> In progress
            </span>
          )}
          {(task.status === 'skipped' || task.status === 'cancelled') && (
            <span>
              {STATUS_LABEL[task.status]}
              {task.skippedReason ? ` · ${task.skippedReason}` : ''}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" />
              {subsDone}/{subtasks.length}
            </span>
          )}
          {showSection && node && tree && (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', colorFor(tree.colorOf(node.id)).dot)} />
              {node.title}
            </span>
          )}
          {taskTags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      </button>
      <Menu
        trigger={
          <button
            type="button"
            aria-label={`More actions for ${task.title}`}
            className="text-muted/70 hover:bg-surface-2 hover:text-fg -my-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-lg md:my-0 md:mr-0 md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:data-[state=open]:opacity-100"
          >
            <Ellipsis className="size-4" />
          </button>
        }
        items={[
          { label: 'Edit', icon: Pencil, onSelect: () => openEditor(task.id) },
          closed
            ? { label: 'Reopen', icon: RotateCcw, onSelect: () => void changeStatus(task, 'not_started') }
            : task.status === 'in_progress'
              ? {
                  label: 'Mark not started',
                  icon: RotateCcw,
                  onSelect: () => void changeStatus(task, 'not_started'),
                }
              : {
                  label: 'Start (in progress)',
                  icon: Play,
                  onSelect: () => void changeStatus(task, 'in_progress'),
                },
          ...(!closed
            ? [
                { label: 'Skip…', icon: SkipForward, onSelect: () => setSkipping(true) },
                { label: 'Cancel task', icon: Ban, onSelect: () => void changeStatus(task, 'cancelled') },
              ]
            : []),
          { label: 'Duplicate', icon: Copy, onSelect: () => void copyTask(task) },
          null,
          { label: 'Delete', icon: Trash, danger: true, onSelect: () => void removeTask(task) },
        ]}
      />
      {skipping && <SkipDialog task={task} onClose={() => setSkipping(false)} />}
    </li>
  );
}
