import { addDays, format, parseISO } from 'date-fns';
import { ArrowUp, CalendarDays, Check, Flag, Plus, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useNow } from '@/app/use-now';
import { useUIStore } from '@/app/ui-store';
import { Sheet } from '@/components/Sheet';
import { PRIORITY_LABEL } from '@/core/domain/tasks';
import { flatten } from '@/core/domain/tree';
import type { Priority, Task } from '@/core/domain/types';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';
import { addTask } from './actions';
import { PRIORITY_STYLE } from './TaskBits';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

function Chip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" aria-pressed={active} className={cn(chipClass(active), className)} {...props}>
      {children}
    </button>
  );
}

function chipClass(active?: boolean) {
  return cn(
    'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors md:h-8 md:text-xs',
    active ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
  );
}

/** A chip that wraps a native control, so phones get the system picker (easy on the thumb). */
function NativeChip({
  active,
  label,
  children,
}: {
  active?: boolean;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={cn(chipClass(active), 'focus-within:ring-fg/40 focus-within:ring-2')}>
      {label}
      {children}
    </span>
  );
}

function sectionLabel(tree: NodeTree | undefined, nodeId: string | undefined) {
  const node = nodeId ? tree?.byId.get(nodeId) : undefined;
  return node ? node.title : 'No section';
}

interface Props {
  variant: 'inline' | 'sheet';
  /** Section new tasks go to (changeable with the section chip). */
  nodeId?: string;
  /** Pre-select "Today" as the due date. */
  dueToday?: boolean;
  /** Show the section chip (hidden on a section's own page, where the section is obvious). */
  showSection?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onAdded?: (task: Task) => void;
}

/**
 * Add a task in one line: type, press Enter. Optional chips set the section, a due date and priority
 * without opening the full editor. Used inline on pages and in the "New task" sheet.
 */
export function TaskComposer({
  variant,
  nodeId: nodeProp,
  dueToday = false,
  showSection = true,
  placeholder = 'Add a task',
  autoFocus,
  onAdded,
}: Props) {
  const tree = useNodeTree();
  const now = useNow(60_000);
  const today = ymd(new Date(now));
  const tomorrow = ymd(addDays(new Date(now), 1));
  const initialDue = dueToday ? today : '';

  const [title, setTitle] = useState('');
  const [nodeId, setNodeId] = useState(nodeProp);
  const [due, setDue] = useState(initialDue);
  const [priority, setPriority] = useState<Priority>(4);
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the page's context when it changes (e.g. the section filter on All Tasks).
  const [seen, setSeen] = useState({ nodeProp, initialDue });
  if (seen.nodeProp !== nodeProp || seen.initialDue !== initialDue) {
    setSeen({ nodeProp, initialDue });
    setNodeId(nodeProp);
    setDue(initialDue);
  }

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    const task = await addTask({ title: t, nodeId, priority, ...(due ? { dueDate: due } : {}) });
    if (!task) return;
    setPriority(4);
    setAdded(
      `Added to ${sectionLabel(tree, nodeId)}${due === today ? ', due today' : due === tomorrow ? ', due tomorrow' : due ? `, due ${format(parseISO(due), 'EEE d MMM')}` : ''}`,
    );
    onAdded?.(task);
    inputRef.current?.focus();
  };

  const sections = tree ? flatten(tree.visibleTree) : [];
  const dueIsCustom = !!due && due !== today && due !== tomorrow;
  const nodeColor = nodeId ? colorFor(tree?.colorOf(nodeId)) : undefined;
  const sheet = variant === 'sheet';

  const chips = (
    <div className={cn('flex flex-wrap items-center gap-2', !sheet && 'pt-1 pb-2.5 pl-9')}>
      {showSection && (
        <NativeChip
          active={false}
          label={
            <>
              <span className={cn('size-2 rounded-full', nodeColor ? nodeColor.dot : 'bg-muted/60')} />
              <span className="max-w-40 truncate">{sectionLabel(tree, nodeId)}</span>
            </>
          }
        >
          <select
            aria-label="Section"
            value={nodeId ?? ''}
            onChange={(e) => setNodeId(e.target.value || undefined)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">No section</option>
            {sections.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(depth * 2)}
                {node.title}
              </option>
            ))}
          </select>
        </NativeChip>
      )}
      <Chip active={due === today} onClick={() => setDue(due === today ? '' : today)}>
        Today
      </Chip>
      <Chip active={due === tomorrow} onClick={() => setDue(due === tomorrow ? '' : tomorrow)}>
        Tomorrow
      </Chip>
      <NativeChip
        active={dueIsCustom}
        label={
          <>
            <CalendarDays className="size-3.5" />
            {dueIsCustom ? format(parseISO(due), 'EEE d MMM') : 'Date'}
          </>
        }
      >
        <input
          type="date"
          aria-label="Due date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              /* older browsers open it themselves */
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </NativeChip>
      {dueIsCustom && (
        <button
          type="button"
          aria-label="Clear due date"
          onClick={() => setDue('')}
          className="text-muted hover:text-fg -ml-1 grid size-8 place-items-center rounded-full"
        >
          <X className="size-3.5" />
        </button>
      )}
      <NativeChip
        active={false}
        label={
          <>
            <Flag className={cn('size-3.5', priority < 4 && PRIORITY_STYLE[priority].text)} />
            {priority < 4 ? PRIORITY_LABEL[priority] : 'Priority'}
          </>
        }
      >
        <select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) as Priority)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {([1, 2, 3, 4] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </NativeChip>
    </div>
  );

  if (sheet) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="New task title"
            autoComplete="off"
            className="placeholder:text-muted/70 h-12 min-w-0 flex-1 bg-transparent text-xl font-medium focus:outline-none md:text-lg"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Add task"
            className="bg-accent text-accent-fg grid size-11 shrink-0 place-items-center rounded-full transition-[opacity,transform] duration-150 active:scale-95 disabled:opacity-30"
          >
            <ArrowUp className="size-5" strokeWidth={2.5} />
          </button>
        </div>
        {chips}
        <p aria-live="polite" className="text-muted flex min-h-5 items-center gap-1.5 text-[13px]">
          {added && (
            <span key={added + title} className="anim-rise inline-flex items-center gap-1.5">
              <Check className="text-sec-self size-4" /> {added}. Type the next one.
            </span>
          )}
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="group border-line focus-within:border-fg/30 rounded-2xl border px-3 transition-colors md:rounded-xl"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-6 shrink-0 place-items-center">
          <Plus className="text-muted size-[18px]" />
        </span>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          aria-label="New task title"
          autoComplete="off"
          className="placeholder:text-muted/80 h-12 min-w-0 flex-1 bg-transparent text-base focus:outline-none md:h-11 md:text-sm"
        />
        {title.trim() && (
          <button
            type="submit"
            className="bg-accent text-accent-fg anim-rise h-8 rounded-full px-3.5 text-[13px] font-medium md:h-7 md:text-xs"
          >
            Add
          </button>
        )}
      </div>
      {/* Options appear once you start typing, and stay until the task is added: collapsing them on
          blur would move the list under your finger mid-tap. */}
      {title.trim() && chips}
    </form>
  );
}

/** The "New task" sheet: phone ＋ button, sidebar "New task", or the N key on desktop. */
export function NewTaskSheet() {
  const open = useUIStore((s) => s.composerOpen);
  const setOpen = useUIStore((s) => s.setComposerOpen);
  const ctx = useUIStore((s) => s.composerContext);
  return (
    <Sheet open={open} onOpenChange={setOpen} title="New task">
      <TaskComposer variant="sheet" nodeId={ctx.nodeId} dueToday={ctx.due === 'today'} autoFocus />
    </Sheet>
  );
}
