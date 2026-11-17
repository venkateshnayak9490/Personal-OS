import { db } from '@/core/db';
import type { ActivityAction, Task, TaskStatus } from '@/core/domain/types';
import { isClosed } from '@/core/domain/tasks';
import { insert, patch, softDeleteBatch } from './write';

export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deviceId'>> & {
  title: string;
};

export async function createTask(input: NewTask): Promise<Task> {
  const title = input.title.trim();
  if (!title) throw new Error('A task needs a title');
  let nodeId = input.nodeId;
  if (input.parentTaskId && !nodeId) nodeId = (await db.tasks.get(input.parentTaskId))?.nodeId;
  return insert<Task>('tasks', {
    priority: 4,
    status: 'not_started',
    kind: 'general',
    tags: [],
    custom: {},
    order: 'a0',
    ...input,
    title,
    nodeId,
  });
}

/** Editable fields. Status changes go through setTaskStatus so they're logged with the right action. */
export type TaskChanges = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'nodeId'
    | 'projectId'
    | 'priority'
    | 'kind'
    | 'startDate'
    | 'dueDate'
    | 'dueTime'
    | 'timezone'
    | 'estimateMin'
    | 'tags'
  >
>;

export async function updateTask(id: string, changes: TaskChanges) {
  if (changes.title !== undefined) {
    changes = { ...changes, title: changes.title.trim() };
    if (!changes.title) throw new Error('A task needs a title');
  }
  const res = await patch<Task>('tasks', id, changes);
  // Subtasks follow their parent when it moves to another section.
  if (res && 'nodeId' in changes) {
    const subs = await db.tasks.where('parentTaskId').equals(id).toArray();
    for (const s of subs) if (!s.deletedAt) await patch<Task>('tasks', s.id, { nodeId: changes.nodeId });
  }
  return res;
}

function actionFor(from: TaskStatus, to: TaskStatus): ActivityAction {
  if (to === 'completed') return 'completed';
  if (to === 'skipped') return 'skipped';
  if (isClosed(from) && !isClosed(to)) return 'reopened';
  return 'status_changed';
}

/**
 * Change status. "Completed" is only ever set here, by an explicit user action (build.md §11).
 * Skipped keeps an optional reason and never counts as completed.
 */
export async function setTaskStatus(id: string, status: TaskStatus, opts: { reason?: string } = {}) {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('Task not found');
  if (task.status === status) return null;
  const changes: Partial<Task> = {
    status,
    completedAt: status === 'completed' ? Date.now() : undefined,
    skippedReason: status === 'skipped' ? opts.reason?.trim() || undefined : undefined,
  };
  return patch<Task>('tasks', id, changes, actionFor(task.status, status));
}

/** Restore status fields exactly as they were (used by Undo). */
export async function revertTaskStatus(before: Task) {
  const cur = await db.tasks.get(before.id);
  if (!cur) return null;
  return patch<Task>(
    'tasks',
    before.id,
    { status: before.status, completedAt: before.completedAt, skippedReason: before.skippedReason },
    actionFor(cur.status, before.status),
  );
}

/** Soft-delete a task and its subtasks (one Trash entry). */
export async function deleteTask(id: string): Promise<string | null> {
  const subs = (await db.tasks.where('parentTaskId').equals(id).toArray()).filter((s) => !s.deletedAt);
  return softDeleteBatch([
    { tableName: 'tasks', id },
    ...subs.map((s) => ({ tableName: 'tasks' as const, id: s.id })),
  ]);
}

/** Copy a task (and its subtasks) as new, not-started tasks. */
export async function duplicateTask(id: string): Promise<Task> {
  const src = await db.tasks.get(id);
  if (!src) throw new Error('Task not found');
  const copy = await createTask(fresh(src, `${src.title} (copy)`));
  const subs = (await db.tasks.where('parentTaskId').equals(id).toArray()).filter((s) => !s.deletedAt);
  for (const s of subs) await createTask({ ...fresh(s, s.title), parentTaskId: copy.id });
  return copy;
}

function fresh(t: Task, title: string): NewTask {
  return {
    title,
    description: t.description,
    nodeId: t.nodeId,
    projectId: t.projectId,
    parentTaskId: t.parentTaskId,
    priority: t.priority,
    kind: t.kind,
    startDate: t.startDate,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    timezone: t.timezone,
    estimateMin: t.estimateMin,
    tags: [...t.tags],
    custom: { ...t.custom },
  };
}
