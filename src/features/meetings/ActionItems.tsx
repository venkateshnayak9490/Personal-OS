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
          <li key={t.id} className="flex items-center gap-3 py-2">
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
              className={cn('min-w-0 flex-1 truncate text-left text-sm', closed && 'text-muted line-through')}
            >
              {t.title}
            </button>
            {from && <span className="text-muted shrink-0 text-xs">{format(from.start, 'd MMM')}</span>}
            {due && (
              <span className={cn('shrink-0 text-xs', isOverdue(t, now) ? 'text-danger' : 'text-muted')}>
                {due}
              </span>
            )}
            <button
              type="button"
              aria-pressed={isFollowUp(t)}
              aria-label={`Follow up on ${t.title} next meeting`}
              title="Bring this up at the next meeting"
              onClick={() => void attempt(() => setFollowUp(t.id, !isFollowUp(t)))}
              className={cn(
                'hover:bg-surface-2 rounded-md p-1.5',
                isFollowUp(t) ? 'text-sec-misc' : 'text-muted/60',
              )}
            >
              <Flag className={cn('size-3.5', isFollowUp(t) && 'fill-current')} />
            </button>
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
