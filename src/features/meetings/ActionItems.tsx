import { format } from 'date-fns';
import { Flag, Plus } from 'lucide-react';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { Button, Input } from '@/components/ui';
import { parseCapture } from '@/core/domain/capture';
import { isFollowUp, meetingIdOf } from '@/core/domain/meetings';
import { dueLabel, isClosed, isOverdue } from '@/core/domain/tasks';
import type { Meeting, Task } from '@/core/domain/types';
import { setFollowUp } from '@/core/repos/meetings';
import { useNodeTree } from '@/features/structure/use-tree';
import { addCapturedTask, toggleComplete } from '@/features/tasks/actions';
import { cn } from '@/lib/cn';

/** Compact task rows with a "follow up next meeting" flag. Click a title for the full task editor. */
export function ActionItemList({
  tasks,
  meetings,
  label,
}: {
  tasks: Task[];
  /** When given, each row says which meeting it came from. */
  meetings?: Meeting[];
  label: string;
}) {
  const now = useNow();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const sorted = [...tasks].sort(
    (a, b) => Number(isClosed(a.status)) - Number(isClosed(b.status)) || a.createdAt - b.createdAt,
  );
  return (
    <ul aria-label={label} className="divide-line divide-y">
      {sorted.map((t) => {
        const closed = isClosed(t.status);
        const from = meetings?.find((m) => m.id === meetingIdOf(t));
        const due = dueLabel(t, now);
        return (
          <li key={t.id} className="flex min-h-11 items-center gap-3 py-1.5 md:min-h-9">
            <input
              type="checkbox"
              aria-label={`Complete ${t.title}`}
              checked={t.status === 'completed'}
              onChange={() => void toggleComplete(t)}
              className="size-4 shrink-0 accent-[var(--fg)]"
            />
            <button
              type="button"
              onClick={() => openTask(t.id)}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-[15px] md:text-sm',
                closed && 'text-muted line-through',
              )}
            >
              {t.title}
            </button>
            {from && (
              <span className="text-meta text-muted shrink-0 max-sm:hidden">
                from {format(from.start, 'd MMM')}
              </span>
            )}
            {due && (
              <span
                className={cn(
                  'text-meta shrink-0',
                  !closed && isOverdue(t, now) ? 'text-danger font-medium' : 'text-muted',
                )}
              >
                {!closed && isOverdue(t, now) ? `Overdue · ${due}` : due}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={isFollowUp(t)}
              aria-label={`Follow up on ${t.title} next meeting`}
              title="Bring this up at the next meeting"
              onClick={() => void attempt(() => setFollowUp(t.id, !isFollowUp(t)))}
              className={cn('-mr-2', isFollowUp(t) && 'text-warning hover:text-warning')}
            >
              <Flag className={cn('size-4', isFollowUp(t) && 'fill-current')} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Add an action item in plain language: "send draft fri", "#thesis", "!high". */
export function AddActionItem({ meeting }: { meeting: Meeting }) {
  const tree = useNodeTree();
  const [text, setText] = useState('');
  const add = async () => {
    const p = parseCapture(text, new Date(), tree?.nodes ?? []);
    if (!p.title) return;
    const t = await addCapturedTask(
      {
        title: p.title,
        nodeId: p.nodeId ?? meeting.nodeId,
        custom: { meetingId: meeting.id },
        ...(p.priority ? { priority: p.priority } : {}),
        ...(p.dueDate ? { dueDate: p.dueDate } : {}),
        ...(p.dueTime ? { dueTime: p.dueTime } : {}),
        ...(p.timezone ? { timezone: p.timezone } : {}),
      },
      p.tagNames,
      p.repeat,
    );
    if (t) setText('');
  };
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <Input
        aria-label="New action item"
        placeholder="Add an action item, e.g. “send draft fri”"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" disabled={!text.trim()}>
        <Plus className="size-4" /> Add
      </Button>
    </form>
  );
}
