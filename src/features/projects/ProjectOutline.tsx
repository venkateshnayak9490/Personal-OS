import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Heading1,
  Heading2,
  IndentDecrease,
  IndentIncrease,
  ListChecks,
  PanelRightOpen,
  Plus,
  SkipForward,
  Trash,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { Menu, type MenuItem } from '@/components/Menu';
import { useAllTasks } from '@/core/hooks';
import { hiddenBy, outlineOf, type OutlineRow } from '@/core/domain/outline';
import { dueLabel, isClosed, isOverdue } from '@/core/domain/tasks';
import type { Project, ProjectHeading, SectionNode, Task } from '@/core/domain/types';
import {
  addLine,
  deleteHeading,
  headingToTask,
  indentTask,
  moveLine,
  outdentTask,
  restoreHeading,
  sectionScope,
  updateHeading,
} from '@/core/repos/outline';
import { updateTask } from '@/core/repos/tasks';
import { removeTask, toggleComplete } from '@/features/tasks/actions';
import { SkipDialog } from '@/features/tasks/SkipDialog';
import { TaskCheck } from '@/features/tasks/TaskBits';
import { cn } from '@/lib/cn';

/** Where a new line goes: after a row (or at the end), optionally as a subtask. */
type Draft = { after?: string; parentTaskId?: string; session?: number };
/** Each new typing line gets its own number, so a fresh one starts where you pressed Enter. */
let sessions = 0;
const nextSession = () => ++sessions;

const rowMenu = (label: string) => (
  <button
    type="button"
    aria-label={label}
    className="text-muted/70 hover:bg-surface-2 hover:text-fg grid size-9 shrink-0 place-items-center rounded-lg md:size-7 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:data-[state=open]:opacity-100"
  >
    <Ellipsis className="size-4" />
  </button>
);

/** One editable line: saves on blur or Enter; the key handler gets the outline shortcuts. */
function LineInput({
  value,
  label,
  className,
  onSave,
  onKeyDown,
  inputRef,
}: {
  value: string;
  label: string;
  className?: string;
  onSave: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>, current: string) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const save = () => {
    if (text !== null && text.trim() && text !== value) onSave(text.trim());
    setText(null);
  };
  return (
    <input
      ref={inputRef}
      aria-label={label}
      value={shown}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        onKeyDown?.(e, shown);
      }}
      className={cn('min-w-0 flex-1 bg-transparent outline-none', className)}
    />
  );
}

/** The line you type new things into. Enter adds and stays ready for the next one. */
function NewLine({
  placeholder,
  onAdd,
  onDone,
  autoFocus,
  indent,
  after,
}: {
  placeholder: string;
  /** Adds a line after `after` (undefined = the end) and returns the new line's id. */
  onAdd: (text: string, after: string | undefined) => Promise<string>;
  onDone?: () => void;
  autoFocus?: boolean;
  indent?: boolean;
  after?: string;
}) {
  const [text, setText] = useState('');
  // Fast typing: each Enter waits for the previous save, then goes after the line it made.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const last = useRef(after);
  const add = () => {
    if (!text.trim()) return onDone?.();
    const t = text;
    setText('');
    queue.current = queue.current.then(() =>
      attempt(async () => {
        last.current = await onAdd(t, last.current);
      }),
    );
  };
  const heading = /^#{1,2}\s/.test(text);
  return (
    <li className={cn('flex min-h-11 items-center gap-3 md:min-h-9', indent && 'pl-8')}>
      {heading ? (
        <span className="text-muted w-5 shrink-0 text-center text-xs font-semibold">H</span>
      ) : (
        <Plus className="text-muted size-5 shrink-0 md:size-4" />
      )}
      <input
        autoFocus={autoFocus}
        aria-label="New line"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Escape') {
            setText('');
            onDone?.();
          }
        }}
        onBlur={() => {
          if (text.trim()) add();
          else onDone?.();
        }}
        className={cn(
          'placeholder:text-muted/70 min-w-0 flex-1 bg-transparent text-[15px] outline-none md:text-sm',
          heading && 'font-semibold',
        )}
      />
    </li>
  );
}

/**
 * A project's tasks as a Notion-style outline: headings and subheadings to group the work, tasks
 * and subtasks under them. Type "# " for a heading, "## " for a subheading. Enter adds the next
 * line, Tab / Shift+Tab indent and outdent, Alt+↑/↓ move, Backspace on an empty line removes it.
 */
export function ProjectOutline({ project }: { project: Project }) {
  return (
    <TaskOutline
      scope={project.id}
      headings={project.headings}
      nodeId={project.nodeId}
      inScope={(t) => t.projectId === project.id}
    />
  );
}

/** A section's own tasks as the same outline (its subsections' and projects' tasks are listed apart). */
export function SectionOutline({ node, label }: { node: SectionNode; label?: string }) {
  return (
    <TaskOutline
      scope={sectionScope(node.id)}
      headings={node.config.headings as ProjectHeading[] | undefined}
      nodeId={node.id}
      inScope={(t) => t.nodeId === node.id && !t.projectId}
      label={label}
    />
  );
}

function TaskOutline({
  scope,
  headings,
  nodeId,
  inScope,
  label = 'Tasks',
}: {
  scope: string;
  headings?: ProjectHeading[];
  nodeId?: string;
  inScope: (t: Task) => boolean;
  label?: string;
}) {
  const allTasks = useAllTasks();
  const now = useNow();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hideDone, setHideDone] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [skipping, setSkipping] = useState<Task | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Line to focus once it's on screen (after a move or indent re-renders it). A ref: no extra renders.
  const focusId = useRef<string | null>(null);
  const setFocusId = (id: string) => (focusId.current = id);
  useEffect(() => {
    const el = focusId.current && inputs.current.get(focusId.current);
    if (el) {
      el.focus();
      focusId.current = null;
    }
  });

  if (!allTasks) return null;
  const tasks = allTasks.filter(inScope);
  const rows = outlineOf(headings, tasks);
  const hidden = hiddenBy(rows, collapsed);
  const pid = scope;
  const ref = (id: string) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  };
  // Every visible line, top to bottom (for "focus the line above" after a delete).
  const flat = rows.flatMap((r) => (r.kind === 'task' ? [r.id, ...r.subtasks.map((s) => s.id)] : [r.id]));
  const above = (id: string) => flat[flat.indexOf(id) - 1];

  const run = (fn: () => Promise<unknown>) => void attempt(fn);
  const addAfter = (d: Draft) => async (text: string, after: string | undefined) => {
    const made = (await addLine(pid, text, { ...d, after, nodeId })) as { id: string };
    // A line typed in the middle follows what you add (the one at the end stays at the end).
    if (d.after) setDraft({ ...d, after: made.id });
    return made.id;
  };

  const shortcuts = (
    e: KeyboardEvent<HTMLInputElement>,
    current: string,
    row: { id: string; sub?: Task; task?: Task },
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setDraft(
        row.sub
          ? { after: row.id, parentTaskId: row.sub.parentTaskId, session: nextSession() }
          : { after: row.id, session: nextSession() },
      );
    } else if (e.key === 'Tab' && row.task) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
      run(async () => {
        if (e.shiftKey) await outdentTask(pid, row.id);
        else await indentTask(pid, row.id);
        setFocusId(row.id);
      });
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      run(async () => {
        await moveLine(pid, row.id, e.key === 'ArrowUp' ? -1 : 1);
        setFocusId(row.id);
      });
    } else if (e.key === 'Backspace' && current === '' && row.task) {
      e.preventDefault();
      const prev = above(row.id);
      void removeTask(row.task);
      if (prev) setFocusId(prev);
    }
  };

  const headingRow = (r: Extract<OutlineRow, { kind: 'heading' }>) => {
    const h: ProjectHeading = r.heading;
    const isOpen = !collapsed.has(h.id);
    const items: (MenuItem | null)[] = [
      h.level === 1
        ? {
            label: 'Make it a subheading',
            icon: Heading2,
            onSelect: () => run(() => updateHeading(pid, h.id, { level: 2 })),
          }
        : {
            label: 'Make it a heading',
            icon: Heading1,
            onSelect: () => run(() => updateHeading(pid, h.id, { level: 1 })),
          },
      {
        label: 'Turn into a task',
        icon: ListChecks,
        onSelect: () => run(() => headingToTask(pid, h.id, nodeId)),
      },
      { label: 'Move up', icon: ArrowUp, onSelect: () => run(() => moveLine(pid, h.id, -1)) },
      { label: 'Move down', icon: ArrowDown, onSelect: () => run(() => moveLine(pid, h.id, 1)) },
      null,
      {
        label: 'Delete heading',
        icon: Trash,
        danger: true,
        onSelect: () =>
          run(async () => {
            const gone = await deleteHeading(pid, h.id);
            if (gone) toast(`Removed “${gone.title}” (its tasks stay)`, () => restoreHeading(pid, gone));
          }),
      },
    ];
    return (
      <li
        key={h.id}
        className={cn('group flex items-center gap-1', h.level === 1 ? 'mt-6 first:mt-0' : 'mt-4 first:mt-0')}
      >
        <button
          type="button"
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${h.title}`}
          aria-expanded={isOpen}
          onClick={() => {
            const next = new Set(collapsed);
            if (isOpen) next.add(h.id);
            else next.delete(h.id);
            setCollapsed(next);
          }}
          className="text-muted hover:text-fg grid size-8 shrink-0 place-items-center rounded-md md:size-6"
        >
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <LineInput
          value={h.title}
          label={h.level === 1 ? `Heading ${h.title}` : `Subheading ${h.title}`}
          inputRef={ref(h.id)}
          onSave={(title) => run(() => updateHeading(pid, h.id, { title }))}
          onKeyDown={(e, cur) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setDraft({ after: h.id, session: nextSession() });
            } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              run(() => moveLine(pid, h.id, e.key === 'ArrowUp' ? -1 : 1));
            } else if (e.key === 'Backspace' && cur === '') {
              e.preventDefault();
              items.at(-1)?.onSelect();
            }
          }}
          className={cn(
            'font-display font-semibold tracking-tight',
            h.level === 1 ? 'text-xl' : 'text-muted text-base',
          )}
        />
        <Menu trigger={rowMenu(`Options for ${h.title}`)} items={items} />
      </li>
    );
  };

  const taskRow = (t: Task, opts: { sub?: boolean; canIndent?: boolean }) => {
    const done = isClosed(t.status);
    const due = dueLabel(t, now);
    const overdue = isOverdue(t, now);
    const items: (MenuItem | null)[] = [
      { label: 'Open details', icon: PanelRightOpen, onSelect: () => openTask(t.id) },
      opts.sub
        ? {
            label: 'Move out (outdent)',
            icon: IndentDecrease,
            onSelect: () => run(() => outdentTask(pid, t.id)),
          }
        : opts.canIndent
          ? {
              label: 'Make it a subtask (indent)',
              icon: IndentIncrease,
              onSelect: () => run(() => indentTask(pid, t.id)),
            }
          : null,
      { label: 'Move up', icon: ArrowUp, onSelect: () => run(() => moveLine(pid, t.id, -1)) },
      { label: 'Move down', icon: ArrowDown, onSelect: () => run(() => moveLine(pid, t.id, 1)) },
      ...(!done ? [{ label: 'Skip…', icon: SkipForward, onSelect: () => setSkipping(t) }] : []),
      null,
      { label: 'Delete', icon: Trash, danger: true, onSelect: () => void removeTask(t) },
    ];
    return (
      <li key={t.id} className={cn('group flex min-h-11 items-center gap-3 md:min-h-9', opts.sub && 'pl-8')}>
        <TaskCheck
          status={t.status}
          priority={t.priority}
          small
          label={t.status === 'completed' ? `Reopen ${t.title}` : `Complete ${t.title}`}
          onClick={() => void toggleComplete(t)}
        />
        <LineInput
          value={t.title}
          label={`Task ${t.title}`}
          inputRef={ref(t.id)}
          onSave={(title) => run(() => updateTask(t.id, { title }))}
          onKeyDown={(e, cur) =>
            shortcuts(e, cur, opts.sub ? { id: t.id, sub: t, task: t } : { id: t.id, task: t })
          }
          className={cn('text-[15px] md:text-sm', done && 'text-muted decoration-muted/60 line-through')}
        />
        {due && (
          <span
            className={cn(
              'text-muted inline-flex shrink-0 items-center gap-1 text-xs',
              overdue && 'text-danger font-medium',
            )}
          >
            <CalendarClock className="size-3.5" /> {due}
          </span>
        )}
        <Menu trigger={rowMenu(`Options for ${t.title}`)} items={items} />
      </li>
    );
  };

  const show = (t: Task) => !hideDone || !isClosed(t.status);
  const draftLine = (d: Draft) => (
    <NewLine
      key={`draft-${d.session}`}
      autoFocus
      after={d.after}
      indent={!!d.parentTaskId}
      placeholder={d.parentTaskId ? 'Subtask' : 'Task, or # heading, ## subheading'}
      onAdd={addAfter(d)}
      onDone={() => setDraft(null)}
    />
  );
  const doneCount = tasks.filter((t) => isClosed(t.status)).length;
  const openCount = tasks.filter((t) => !t.parentTaskId && !isClosed(t.status)).length;

  return (
    <section aria-label={label}>
      {/* Block head (as BlockHeader): no "0 open"; with nothing open the add line below says what to do. */}
      <div className="border-line-strong mb-2 flex items-center gap-3 border-b pb-1">
        <h2 className="title-block flex-1">
          {label}
          {openCount > 0 && <span className="text-muted font-normal"> {openCount} open</span>}
        </h2>
        {doneCount > 0 && (
          <label className="text-muted flex h-9 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="accent-[var(--fg)]"
            />
            Hide done ({doneCount})
          </label>
        )}
      </div>
      <ul aria-label="Project outline">
        {rows.flatMap((r, i) => {
          if (hidden.has(r.id)) return [];
          const out = [];
          if (r.kind === 'heading') out.push(headingRow(r));
          else {
            if (show(r.task))
              out.push(taskRow(r.task, { canIndent: rows[i - 1]?.kind === 'task' && !r.subtasks.length }));
            for (const sub of r.subtasks) {
              if (show(sub)) out.push(taskRow(sub, { sub: true }));
              if (draft?.after === sub.id && draft.parentTaskId) out.push(draftLine(draft));
            }
          }
          if (draft?.after === r.id && !draft.parentTaskId) out.push(draftLine(draft));
          return out;
        })}
        {!draft && (
          <NewLine
            placeholder={
              rows.length
                ? 'Add a task, or # heading, ## subheading'
                : 'Start with a task, or type # for a heading'
            }
            onAdd={addAfter({})}
          />
        )}
      </ul>
      <p className="text-muted mt-3 hidden text-xs md:block">
        Enter: new line · Tab / Shift+Tab: indent · Alt+↑/↓: move · Backspace on an empty line: remove
      </p>
      {skipping && <SkipDialog task={skipping} onClose={() => setSkipping(null)} />}
    </section>
  );
}
