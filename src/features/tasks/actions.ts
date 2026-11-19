import { format, parseISO } from 'date-fns';
import { attempt, toast } from '@/app/toast';
import type { Task, TaskStatus } from '@/core/domain/types';
import {
  convertTask,
  createTask,
  deleteTask,
  duplicateTask,
  revertTaskStatus,
  setTaskRepeat,
  setTaskStatus,
  type NewTask,
} from '@/core/repos/tasks';
import { createTag } from '@/core/repos/tags';
import type { Rule } from '@/core/domain/recurrence';
import { restoreFromTrash } from '@/core/repos/trash';
import { softDeleteBatch } from '@/core/repos/write';

/** UI-level task actions: run the change, then offer Undo in a toast. */

const MESSAGES: Partial<Record<TaskStatus, string>> = {
  completed: 'Marked complete',
  skipped: 'Skipped (not counted as done)',
  cancelled: 'Cancelled',
  in_progress: 'Marked in progress',
  not_started: 'Reopened',
};

export async function changeStatus(task: Task, status: TaskStatus, reason?: string) {
  const res = await attempt(() => setTaskStatus(task.id, status, { reason }));
  if (!res) return;
  const msg = MESSAGES[status] ?? 'Status updated';
  const next = res.next?.dueDate ? `. Next one: ${format(parseISO(res.next.dueDate), 'EEE d MMM')}` : '';
  toast(msg + next, () => revertTaskStatus(res.before));
}

/** Checkbox: completes an open task, reopens a closed one. */
export function toggleComplete(task: Task) {
  return changeStatus(task, task.status === 'completed' ? 'not_started' : 'completed');
}

/** New tasks appear in the list right away, so no toast (delete is one tap and undoable). */
export async function addTask(input: NewTask) {
  return attempt(() => createTask(input));
}

/** Add a task from quick capture: creates missing #tags and sets up repeating. */
export async function addCapturedTask(input: NewTask, tagNames: string[], repeat?: Rule) {
  return attempt(async () => {
    const tags = [];
    for (const name of tagNames) tags.push((await createTag(name)).id);
    const task = await createTask({ ...input, tags: [...new Set([...(input.tags ?? []), ...tags])] });
    if (repeat) await setTaskRepeat(task.id, repeat);
    return task;
  });
}

export async function removeTask(task: Task) {
  const batch = await attempt(() => deleteTask(task.id));
  if (batch) toast('Moved to Trash', () => restoreFromTrash(batch));
}

/** Inbox "Move to…" a list or a new note. Undo removes the new item and brings the task back. */
export async function moveTaskInto(task: Task, to: { list: string; name: string } | { note: true }) {
  const r = await attempt(() => convertTask(task.id, 'list' in to ? { list: to.list } : { note: true }));
  if (r)
    toast('list' in to ? `Moved to ${to.name}` : 'Turned into a note', async () => {
      await softDeleteBatch([{ tableName: r.made.table, id: r.made.id }]);
      if (r.trash) await restoreFromTrash(r.trash);
    });
}

export async function copyTask(task: Task) {
  const t = await attempt(() => duplicateTask(task.id));
  if (t) toast('Duplicated', () => deleteTask(t.id));
  return t;
}
