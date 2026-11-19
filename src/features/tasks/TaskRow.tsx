import {
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Ellipsis,
  ListChecks,
  Pencil,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  Trash,
} from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { useRef, useState, type PointerEvent } from 'react';
import { attempt, toast } from '@/app/toast';
import { flatten } from '@/core/domain/tree';
import { updateTask } from '@/core/repos/tasks';
import { useUIStore } from '@/app/ui-store';
import { Menu } from '@/components/Menu';
import { dueLabel, isClosed, isOverdue, STATUS_LABEL, toLocalDate } from '@/core/domain/tasks';
import type { Collection, Project, Tag, Task } from '@/core/domain/types';
import type { NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';
import { changeStatus, copyTask, moveTaskInto, removeTask, toggleComplete } from './actions';
import { SkipDialog } from './SkipDialog';
import { TagChip, TaskCheck } from './TaskBits';

const SWIPE_AT = 88; // px of travel that commits a swipe

/**
 * Phone gesture on a task row: swipe right to complete, left to move it to tomorrow.
 * Touch only (mouse and pen keep normal clicks and text selection). Vertical scrolling wins
 * when the finger moves more up/down than sideways.
 */
function useSwipe(onRight: () => void, onLeft: () => void, enabled: boolean) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; locked?: 'x' | 'y' } | null>(null);
  const swiped = useRef(false);

  const end = () => {
    if (start.current?.locked === 'x') {
      swiped.current = true;
      if (dx >= SWIPE_AT) onRight();
      else if (dx <= -SWIPE_AT) onLeft();
    }
    start.current = null;
    setDx(0);
  };

  return {
    dx,
    handlers: enabled
      ? {
          onPointerDown: (e: PointerEvent) => {
            if (e.pointerType !== 'touch') return;
            swiped.current = false;
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          },
          onPointerMove: (e: PointerEvent) => {
            const s = start.current;
            if (!s || s.id !== e.pointerId) return;
            const mx = e.clientX - s.x;
            const my = e.clientY - s.y;
            if (!s.locked && Math.hypot(mx, my) > 10) s.locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
            if (s.locked === 'x') setDx(Math.max(-140, Math.min(140, mx)));
          },
          onPointerUp: end,
          onPointerCancel: () => {
            start.current = null;
            setDx(0);
          },
          // A finished swipe must not also open the editor.
          onClickCapture: (e: React.MouseEvent) => {
            if (swiped.current) {
              e.preventDefault();
              e.stopPropagation();
              swiped.current = false;
            }
          },
        }
      : {},
  };
}

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
  /** Inbox: a "Move to…" picker on the row (sections, projects, lists, or a new note). */
  moveTo?: MoveTargets;
}

export interface MoveTargets {
  projects: Project[];
  lists: Collection[];
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
  moveTo,
}: Props) {
  const openEditor = useUIStore((s) => s.setEditingTaskId);
  const [skipping, setSkipping] = useState(false);
  const closed = isClosed(task.status);
  const overdue = isOverdue(task, now, timezone);
  const due = dueLabel(task, now);
  const node = task.nodeId ? tree?.byId.get(task.nodeId) : undefined;
  const subsDone = subtasks.filter((s) => s.status === 'completed').length;
  const taskTags = task.tags.map((id) => tags.get(id)).filter((t): t is Tag => !!t);

  const toTomorrow = async () => {
    const before = task.dueDate;
    const tomorrow = format(addDays(parseISO(toLocalDate(now, timezone)), 1), 'yyyy-MM-dd');
    const ok = await attempt(async () => {
      await updateTask(task.id, { dueDate: tomorrow });
      return true;
    });
    if (ok) toast('Moved to tomorrow', () => updateTask(task.id, { dueDate: before }));
  };
  const swipe = useSwipe(
    () => {
      if (task.status !== 'completed') onCompleted?.(task.id);
      void toggleComplete(task);
    },
    () => void toTomorrow(),
    !closed,
  );
  const { dx } = swipe;

  return (
    <li
      {...swipe.handlers}
      className={cn(
        'group border-line/70 relative touch-pan-y overflow-hidden border-b last:border-b-0',
        lingering && 'opacity-60 transition-opacity duration-500',
      )}
    >
      {dx !== 0 && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 flex items-center px-5 text-sm font-medium',
            dx > 0 ? 'bg-sec-self/20 justify-start' : 'bg-sec-work/20 justify-end',
          )}
        >
          {dx > 0 ? (
            <span className={cn('flex items-center gap-2', dx < SWIPE_AT && 'opacity-50')}>
              <Check className="size-5" /> Complete
            </span>
          ) : (
            <span className={cn('flex items-center gap-2', -dx < SWIPE_AT && 'opacity-50')}>
              Tomorrow <ArrowRight className="size-5" />
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'bg-bg relative flex items-start gap-3.5 py-3.5 md:gap-3 md:py-2.5',
          dx === 0 && 'transition-transform duration-150',
        )}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
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
            {task.recurrenceId && (
              <span className="inline-flex items-center" title="Repeats">
                <Repeat className="size-3.5" aria-label="Repeats" />
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
        {moveTo && tree && (
          <select
            aria-label={`Move ${task.title} to a section`}
            value=""
            onChange={(e) => {
              const [kind, id = ''] = e.target.value.split(':');
              if (kind === 'node') void attempt(() => updateTask(task.id, { nodeId: id }));
              if (kind === 'project') {
                const p = moveTo.projects.find((x) => x.id === id);
                void attempt(() => updateTask(task.id, { projectId: id, nodeId: p?.nodeId }));
              }
              if (kind === 'list') {
                const l = moveTo.lists.find((x) => x.id === id);
                if (l) void moveTaskInto(task, { list: l.id, name: l.name });
              }
              if (kind === 'note') void moveTaskInto(task, { note: true });
            }}
            className="border-line bg-surface text-muted hover:text-fg h-8 max-w-40 shrink-0 cursor-pointer rounded-lg border px-2 text-xs"
          >
            <option value="">Move to…</option>
            <optgroup label="Sections">
              {flatten(tree.visibleTree).map(({ node, depth }) => (
                <option key={node.id} value={`node:${node.id}`}>
                  {'  '.repeat(depth * 2)}
                  {node.title}
                </option>
              ))}
            </optgroup>
            {moveTo.projects.length > 0 && (
              <optgroup label="Projects (as a task)">
                {moveTo.projects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            )}
            {moveTo.lists.length > 0 && (
              <optgroup label="Lists (as an item)">
                {moveTo.lists.map((l) => (
                  <option key={l.id} value={`list:${l.id}`}>
                    {l.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Notes">
              <option value="note">A new note</option>
            </optgroup>
          </select>
        )}
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
      </div>
      {skipping && <SkipDialog task={task} onClose={() => setSkipping(false)} />}
    </li>
  );
}
