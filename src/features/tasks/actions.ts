import { attempt, toast } from '@/app/toast';
import type { Task, TaskStatus } from '@/core/domain/types';
import {
  createTask,
  deleteTask,
  duplicateTask,
  revertTaskStatus,
  setTaskStatus,
  type NewTask,
} from '@/core/repos/tasks';
import { restoreFromTrash } from '@/core/repos/trash';

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
  if (res) toast(MESSAGES[status] ?? 'Status updated', () => revertTaskStatus(res.before));
}

/** Checkbox: completes an open task, reopens a closed one. */
export function toggleComplete(task: Task) {
  return changeStatus(task, task.status === 'completed' ? 'not_started' : 'completed');
}

/** New tasks appear in the list right away, so no toast (delete is one tap and undoable). */
export async function addTask(input: NewTask) {
  return attempt(() => createTask(input));
}

export async function removeTask(task: Task) {
  const batch = await attempt(() => deleteTask(task.id));
  if (batch) toast('Moved to Trash', () => restoreFromTrash(batch));
}

export async function copyTask(task: Task) {
  const t = await attempt(() => duplicateTask(task.id));
  if (t) toast('Duplicated', () => deleteTask(t.id));
  return t;
}
