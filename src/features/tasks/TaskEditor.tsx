import { ChevronRight, Copy, History, Plus, Timer, Trash, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { startFocus } from '@/core/repos/focus';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useAllTasks, useHistory, useProfile, useProjects, useTags, useTask } from '@/core/hooks';
import { AOE_TZ, isClosed, KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '@/core/domain/tasks';
import { flatten } from '@/core/domain/tree';
import type { ActivityLogEntry, Priority, Task, TaskKind, TaskStatus } from '@/core/domain/types';
import { db } from '@/core/db';
import {
  describeRule,
  parseRRule,
  presetOf,
  presetRule,
  repeatOptions,
  type RepeatPreset,
} from '@/core/domain/recurrence';
import { setTaskRepeat, updateTask, type TaskChanges } from '@/core/repos/tasks';
import { TagPicker } from '@/features/tags/TagPicker';
import { Attachments } from '@/features/attachments/Attachments';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { addTask, changeStatus, copyTask, removeTask, toggleComplete } from './actions';
import { SkipDialog } from './SkipDialog';
import { PRIORITY_STYLE, TaskCheck } from './TaskBits';

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  description: 'notes',
  priority: 'priority',
  kind: 'type',
  nodeId: 'section',
  startDate: 'start date',
  dueDate: 'due date',
  dueTime: 'due time',
  timezone: 'time zone',
  tags: 'tags',
  estimateMin: 'estimate',
};

function describe(e: ActivityLogEntry, tree?: NodeTree): string {
  switch (e.action) {
    case 'created':
      return 'Created';
    case 'completed':
      return 'Completed';
    case 'skipped':
      return `Skipped${typeof e.after?.skippedReason === 'string' ? ` — ${e.after.skippedReason}` : ''}`;
    case 'reopened':
      return 'Reopened';
    case 'status_changed':
      return `Status → ${STATUS_LABEL[(e.after?.status as TaskStatus) ?? 'not_started'] ?? 'changed'}`;
    case 'deleted':
      return 'Moved to Trash';
    case 'restored':
      return 'Restored from Trash';
    case 'updated': {
      const fields = Object.keys(e.after ?? {});
      if (fields.length === 1 && fields[0] === 'priority')
        return `Priority: ${PRIORITY_LABEL[e.before?.priority as Priority]} → ${PRIORITY_LABEL[e.after?.priority as Priority]}`;
      if (fields.length === 1 && fields[0] === 'dueDate')
        return `Due date: ${(e.before?.dueDate as string) ?? '—'} → ${(e.after?.dueDate as string) ?? '—'}`;
      if (fields.length === 1 && fields[0] === 'nodeId') {
        const name = (id: unknown) => (typeof id === 'string' ? (tree?.byId.get(id)?.title ?? '?') : 'none');
        return `Moved: ${name(e.before?.nodeId)} → ${name(e.after?.nodeId)}`;
      }
      return `Changed ${fields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}`;
    }
    default:
      return e.action;
  }
}

function SubtaskList({ parent }: { parent: Task }) {
  const all = useAllTasks();
  const subs = useMemo(
    () => (all ?? []).filter((t) => t.parentTaskId === parent.id).sort((a, b) => a.createdAt - b.createdAt),
    [all, parent.id],
  );
  const [title, setTitle] = useState('');
  return (
    <div>
      <ul className="space-y-1">
        {subs.map((s) => (
          <li key={s.id} className="group flex min-h-11 items-center gap-3 rounded-md md:min-h-8 md:gap-2.5">
            <TaskCheck
              small
              status={s.status}
              priority={s.priority}
              label={s.status === 'completed' ? `Reopen ${s.title}` : `Complete ${s.title}`}
              onClick={() => void toggleComplete(s)}
            />
            <span
              className={cn(
                'flex-1 text-[15px] md:text-sm',
                s.status === 'completed' && 'text-muted line-through',
              )}
            >
              {s.title}
            </span>
            <button
              type="button"
              aria-label={`Delete subtask ${s.title}`}
              onClick={() => void removeTask(s)}
              className="text-muted hover:text-danger rounded p-1 opacity-60 md:opacity-0 md:group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-1 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void addTask({ title, parentTaskId: parent.id, nodeId: parent.nodeId });
          setTitle('');
        }}
      >
        <Plus className="text-muted size-4" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask"
          aria-label="Add a subtask"
          className="placeholder:text-muted/80 h-11 flex-1 bg-transparent text-[15px] focus:outline-none md:h-8 md:text-sm"
        />
      </form>
    </div>
  );
}

function HistoryList({ task }: { task: Task }) {
  const entries = useHistory('tasks', task.id);
  const tree = useNodeTree();
  const [open, setOpen] = useState(false);
  if (!entries?.length) return null;
  const shown = open ? entries : entries.slice(0, 3);
  return (
    <div>
      <ol className="border-line space-y-1.5 border-l pl-3">
        {shown.map((e) => (
          <li key={e.id} className="text-xs">
            <span className="text-fg">{describe(e, tree)}</span>
            <span className="text-muted ml-2">
              {new Date(e.ts).toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </li>
        ))}
      </ol>
      {entries.length > 3 && (
        <button type="button" onClick={() => setOpen(!open)} className="text-accent mt-2 text-xs font-medium">
          {open ? 'Show less' : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}

function RepeatField({ task }: { task: Task }) {
  const rec = useLiveQuery(
    async () => ({
      id: task.recurrenceId,
      rec: task.recurrenceId ? await db.recurrences.get(task.recurrenceId) : null,
    }),
    [task.recurrenceId],
  );
  if (!rec || rec.id !== task.recurrenceId) return null;
  const rule = task.recurrenceId && rec.rec && !rec.rec.deletedAt ? parseRRule(rec.rec.rrule) : null;
  const current = presetOf(rule);
  const due = task.dueDate ?? format(new Date(), 'yyyy-MM-dd');
  const options = repeatOptions(due);
  return (
    <Field
      label="Repeat"
      htmlFor="te-repeat"
      hint={rule ? 'When you close this one, the next one appears.' : undefined}
    >
      <Select
        id="te-repeat"
        value={current}
        onChange={(e) =>
          void attempt(() => setTaskRepeat(task.id, presetRule(e.target.value as RepeatPreset, due)))
        }
      >
        {current === 'custom' && rule && <option value="custom">{describeRule(rule)}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Editor({ task, onClose }: { task: Task; onClose: () => void }) {
  const navigate = useNavigate();
  const tree = useNodeTree();
  const profile = useProfile();
  useTags(); // keep tag list warm for the picker
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [skipping, setSkipping] = useState(false);

  // Keep local text in sync if the task changes elsewhere (e.g. undo) — "derive from props" pattern.
  const [seen, setSeen] = useState({ title: task.title, description: task.description });
  if (seen.title !== task.title || seen.description !== task.description) {
    setSeen({ title: task.title, description: task.description });
    setTitle(task.title);
    setDescription(task.description ?? '');
  }

  const projects = useProjects();
  const save = (changes: TaskChanges) => void attempt(() => updateTask(task.id, changes));
  const sections = tree ? flatten(tree.tree) : [];
  const tzLabel = profile?.timezone ?? 'My time zone';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="pt-2">
          <TaskCheck
            status={task.status}
            priority={task.priority}
            label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
            onClick={() => void toggleComplete(task)}
          />
        </div>
        <textarea
          value={title}
          rows={1}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          aria-label="Task title"
          aria-invalid={!title.trim()}
          aria-describedby={!title.trim() ? 'te-title-hint' : undefined}
          className="field-sizing-content min-h-10 flex-1 resize-none bg-transparent py-1 text-xl leading-snug font-medium focus:outline-none md:text-lg"
        />
      </div>
      {!title.trim() && (
        // Said, not silently undone: an empty title keeps the old one when you leave the field.
        <p id="te-title-hint" role="status" className="text-warning -mt-2 text-xs md:text-[13px]">
          A task needs a title. Leave it empty and “{task.title}” stays.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="te-status">
          <Select
            id="te-status"
            value={task.status}
            onChange={(e) => {
              const s = e.target.value as TaskStatus;
              if (s === 'skipped') setSkipping(true);
              else void changeStatus(task, s);
            }}
          >
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section" htmlFor="te-node">
          <Select
            id="te-node"
            value={task.nodeId ?? ''}
            onChange={(e) => save({ nodeId: e.target.value || undefined })}
          >
            <option value="">No section</option>
            {sections.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(depth * 2)}
                {node.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Priority">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Priority">
          {([1, 2, 3, 4] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={task.priority === p}
              onClick={() => save({ priority: p })}
              className={cn(
                'flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-medium md:h-9 md:rounded-lg md:text-xs',
                task.priority === p
                  ? 'border-fg/60 bg-surface-2 text-fg'
                  : 'border-line text-muted hover:text-fg',
              )}
            >
              <span className={cn('size-2 rounded-full', PRIORITY_STYLE[p].fill)} />
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <DatePicker
            value={task.dueDate ?? ''}
            weekStartsOn={profile?.weekStartsOn}
            onChange={(v) =>
              save(v ? { dueDate: v } : { dueDate: undefined, dueTime: undefined, timezone: undefined })
            }
          >
            <DateButton label="Due date" value={task.dueDate} />
          </DatePicker>
        </Field>
        {task.dueDate && (
          <Field label="Due time" htmlFor="te-time">
            <Input
              id="te-time"
              type="time"
              value={task.dueTime ?? ''}
              onChange={(e) => save({ dueTime: e.target.value || undefined })}
            />
          </Field>
        )}
        {task.dueDate && (
          <Field label="Time zone for deadline" htmlFor="te-tz" className="col-span-2">
            <Select
              id="te-tz"
              value={task.timezone === AOE_TZ ? 'aoe' : ''}
              onChange={(e) => save({ timezone: e.target.value === 'aoe' ? AOE_TZ : undefined })}
            >
              <option value="">{tzLabel}</option>
              <option value="aoe">AoE (Anywhere on Earth, UTC−12), for conference deadlines</option>
            </Select>
          </Field>
        )}
      </div>

      <RepeatField task={task} />
      {task.dueDate && (
        <Field
          label="Remind me before"
          htmlFor="te-before"
          hint="Plus a reminder at the deadline, then again until it's done (Settings → Remind again)."
        >
          <Select
            id="te-before"
            value={String(task.remindBeforeMin?.[0] ?? '')}
            onChange={(e) =>
              void attempt(() =>
                updateTask(task.id, {
                  remindBeforeMin: e.target.value ? [Number(e.target.value)] : undefined,
                }),
              )
            }
          >
            <option value="">Only at the deadline</option>
            <option value="10">10 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="180">3 hours before</option>
            <option value="1440">1 day before</option>
          </Select>
        </Field>
      )}

      {projects && projects.length > 0 && (
        <Field label="Project" htmlFor="te-project">
          <Select
            id="te-project"
            value={task.projectId ?? ''}
            onChange={(e) => save({ projectId: e.target.value || undefined })}
          >
            <option value="">No project</option>
            {projects
              .filter((p) => p.status !== 'cancelled' || p.id === task.projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </Select>
        </Field>
      )}

      <Field label="Tags">
        <TagPicker value={task.tags} onChange={(tags) => save({ tags })} />
      </Field>

      <Field label="Notes" htmlFor="te-notes">
        <Textarea
          id="te-notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (task.description ?? '') && save({ description: description || undefined })
          }
          placeholder="Details, links, paper references…"
        />
      </Field>

      <Field label="Files">
        <Attachments target={{ table: 'tasks', id: task.id }} nodeId={task.nodeId} />
      </Field>

      {!task.parentTaskId && (
        <Field label="Subtasks">
          <SubtaskList parent={task} />
        </Field>
      )}

      <details className="group">
        <summary className="text-muted hover:text-fg flex h-10 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium md:h-8 md:text-xs [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" /> More details
        </summary>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Field label="Start date">
            <DatePicker
              value={task.startDate ?? ''}
              weekStartsOn={profile?.weekStartsOn}
              onChange={(v) => save({ startDate: v || undefined })}
            >
              <DateButton label="Start date" value={task.startDate} />
            </DatePicker>
          </Field>
          <Field label="Type" htmlFor="te-kind">
            <Select
              id="te-kind"
              value={task.kind}
              onChange={(e) => save({ kind: e.target.value as TaskKind })}
            >
              {(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimate (minutes)" htmlFor="te-est">
            <Input
              id="te-est"
              type="number"
              inputMode="numeric"
              min={0}
              step={5}
              defaultValue={task.estimateMin ?? ''}
              onBlur={(e) => {
                const n = e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : undefined;
                if (n !== task.estimateMin) save({ estimateMin: n });
              }}
            />
          </Field>
          <fieldset className="col-span-2 space-y-2">
            <legend className="text-muted mb-1 text-[13px] font-medium md:text-xs">
              When your day is adjusted
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={task.kind === 'deadline' || !!task.fixed}
                disabled={task.kind === 'deadline'}
                onChange={(e) => save({ fixed: e.target.checked || undefined })}
                className="mt-0.5 accent-[var(--fg)]"
              />
              <span>
                Fixed time
                <span className="text-muted block text-xs">
                  {task.kind === 'deadline' ? 'Deadlines never move.' : 'Never moved to another time.'}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!task.optional}
                onChange={(e) => save({ optional: e.target.checked || undefined })}
                className="mt-0.5 accent-[var(--fg)]"
              />
              <span>
                Optional
                <span className="text-muted block text-xs">
                  First to move to another day when the day is full.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      </details>

      <div>
        <div className="text-muted mb-2 flex items-center gap-1.5 text-[13px] font-medium md:text-xs">
          <History className="size-3.5" /> History
        </div>
        <HistoryList task={task} />
      </div>

      <div className="border-line flex gap-2 border-t pt-4">
        {!isClosed(task.status) && (
          <Button
            size="sm"
            onClick={() =>
              void attempt(async () => {
                await startFocus({ plannedMin: 25, taskId: task.id, nodeId: task.nodeId });
                onClose();
                navigate('/focus');
              })
            }
          >
            <Timer className="size-3.5" /> Focus 25 min
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => void copyTask(task).then((t) => t && useUIStore.getState().setEditingTaskId(t.id))}
        >
          <Copy className="size-3.5" /> Duplicate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => {
            onClose();
            void removeTask(task);
          }}
        >
          <Trash className="size-3.5" /> Delete
        </Button>
      </div>

      {skipping && <SkipDialog task={task} onClose={() => setSkipping(false)} />}
    </div>
  );
}

/** Task editor panel, opened by setting `editingTaskId` in the UI store. Changes save as you go. */
export function TaskEditor() {
  const id = useUIStore((s) => s.editingTaskId);
  const setId = useUIStore((s) => s.setEditingTaskId);
  const task = useTask(id ?? undefined);
  const close = () => setId(null);

  if (!id) return null;
  // Task deleted (or not found) while open → close.
  if (task === null || task?.deletedAt) {
    queueMicrotask(close);
    return null;
  }
  if (!task) return null;

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && close()}
      title={task.parentTaskId ? 'Subtask' : 'Task'}
      variant="side"
    >
      {/* Remount when switching tasks so local text state resets. */}
      <Editor key={task.id} task={task} onClose={close} />
    </Sheet>
  );
}
