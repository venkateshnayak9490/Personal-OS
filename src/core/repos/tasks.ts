import { format } from 'date-fns';
import { db } from '@/core/db';
import { formatRRule, nextDate, parseRRule, type Rule } from '@/core/domain/recurrence';
import type { ActivityAction, Recurrence, Task, TaskStatus } from '@/core/domain/types';
import { isClosed, isOverdue } from '@/core/domain/tasks';
import { createRecord } from './collections';
import { createNote, saveNoteBody } from './notes';
import { insert, patch, purge, softDeleteBatch, type BatchItem } from './write';

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
    | 'fixed'
    | 'optional'
    | 'tags'
    | 'order'
    | 'parentTaskId'
    | 'remindBeforeMin'
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
  const res = await patch<Task>('tasks', id, changes, actionFor(task.status, status));
  if (!res) return null;
  // Closing one occurrence of a repeating task creates the next one.
  const next = isClosed(status) && !isClosed(task.status) ? await spawnNext(res.after) : null;
  return { ...res, next };
}

/** Restore status fields exactly as they were (used by Undo). */
export async function revertTaskStatus(before: Task) {
  const cur = await db.tasks.get(before.id);
  if (!cur) return null;
  const res = await patch<Task>(
    'tasks',
    before.id,
    { status: before.status, completedAt: before.completedAt, skippedReason: before.skippedReason },
    actionFor(cur.status, before.status),
  );
  // Undoing a completion removes the next occurrence it created, if it hasn't been touched since.
  if (!isClosed(before.status)) {
    const spawned = (await db.tasks.toArray()).filter(
      (t) => !t.deletedAt && t.custom?.recurrenceFrom === before.id && t.version === 1,
    );
    const items: BatchItem[] = [];
    for (const t of spawned) {
      items.push({ tableName: 'tasks', id: t.id });
      for (const s of await db.tasks.where('parentTaskId').equals(t.id).toArray())
        items.push({ tableName: 'tasks', id: s.id });
    }
    await purge(items);
  }
  return res;
}

/* ---------- Repeating tasks ---------- */

/** The repeat rule of a task, or null. */
export async function ruleOf(task: Pick<Task, 'recurrenceId'>): Promise<Rule | null> {
  if (!task.recurrenceId) return null;
  const rec = await db.recurrences.get(task.recurrenceId);
  return rec && !rec.deletedAt ? parseRRule(rec.rrule) : null;
}

/** Make a task repeat (or stop repeating with null). A repeating task always has a due date. */
export async function setTaskRepeat(id: string, rule: Rule | null) {
  const task = await db.tasks.get(id);
  if (!task) throw new Error('Task not found');
  if (!rule) {
    if (task.recurrenceId) return patch<Task>('tasks', id, { recurrenceId: undefined });
    return null;
  }
  const rrule = formatRRule(rule);
  const due = task.dueDate ?? format(new Date(), 'yyyy-MM-dd');
  if (task.recurrenceId && (await db.recurrences.get(task.recurrenceId))) {
    await patch<Recurrence>('recurrences', task.recurrenceId, { rrule });
    return task.dueDate ? null : patch<Task>('tasks', id, { dueDate: due });
  }
  const rec = await insert<Recurrence>('recurrences', {
    rrule,
    startDate: due,
    exceptions: [],
    taskTemplate: {},
  });
  return patch<Task>('tasks', id, { recurrenceId: rec.id, dueDate: due });
}

/** Create the next occurrence after `task` (same fields, fresh status). Returns it, or null. */
async function spawnNext(task: Task): Promise<Task | null> {
  if (task.parentTaskId || !task.recurrenceId) return null;
  const rule = await ruleOf(task);
  if (!rule) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  let next = nextDate(rule, task.dueDate ?? today);
  // Done late? Skip ahead to the next date that isn't already in the past.
  for (let i = 0; i < 50_000 && next < today; i++) next = nextDate(rule, next);
  const open = (await db.tasks.where('recurrenceId').equals(task.recurrenceId).toArray()).find(
    (t) => !t.deletedAt && !isClosed(t.status) && t.dueDate === next,
  );
  if (open) return null;
  const copy = await createTask({
    ...fresh(task, task.title),
    dueDate: next,
    startDate: undefined,
    recurrenceId: task.recurrenceId,
    custom: { ...task.custom, recurrenceFrom: task.id },
  });
  const subs = (await db.tasks.where('parentTaskId').equals(task.id).toArray()).filter((s) => !s.deletedAt);
  for (const s of subs) await createTask({ ...fresh(s, s.title), parentTaskId: copy.id, dueDate: undefined });
  return copy;
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
    fixed: t.fixed,
    optional: t.optional,
    tags: [...t.tags],
    custom: { ...t.custom },
  };
}

/** A task's due date and time before a bulk move, for Undo. */
export type DueBefore = { id: string; dueDate?: string; dueTime?: string };

/**
 * Move several tasks to one date (re-plan everything overdue at once). Each keeps its time, unless
 * that would leave it still overdue (a time already gone today): then it's due that day, any time.
 * Returns what each had before, for Undo with `restoreDue`.
 */
export async function moveTasksTo(ids: string[], date: string, now = Date.now(), defaultTz?: string) {
  const before: DueBefore[] = [];
  for (const id of ids) {
    const t = await db.tasks.get(id);
    if (!t || t.deletedAt || isClosed(t.status)) continue;
    before.push({ id, dueDate: t.dueDate, dueTime: t.dueTime });
    const keepTime = t.dueTime && !isOverdue({ ...t, dueDate: date }, now, defaultTz);
    await patch<Task>('tasks', id, { dueDate: date, dueTime: keepTime ? t.dueTime : undefined });
  }
  return before;
}

export async function restoreDue(before: DueBefore[]) {
  for (const b of before) await patch<Task>('tasks', b.id, { dueDate: b.dueDate, dueTime: b.dueTime });
}

/**
 * Inbox "Move to…": turn a captured task into a list item or a note (title, and its description as
 * the note's text). The new item is made first, then the task goes to Trash, so nothing is lost.
 * Returns what to undo.
 */
export async function convertTask(
  id: string,
  to: { list: string } | { note: true },
): Promise<{ made: { table: 'records' | 'notes'; id: string }; trash: string | null }> {
  const task = await db.tasks.get(id);
  if (!task || task.deletedAt) throw new Error('This task no longer exists');
  let made: { table: 'records' | 'notes'; id: string };
  if ('list' in to) {
    const r = await createRecord(to.list, { title: task.title });
    made = { table: 'records', id: r.id };
  } else {
    const n = await createNote({ title: task.title, nodeId: task.nodeId });
    const lines = (task.description ?? '').split('\n').filter((l) => l.trim());
    if (lines.length)
      await saveNoteBody(
        n.id,
        {
          type: 'doc',
          content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
        },
        lines.join('\n'),
      );
    made = { table: 'notes', id: n.id };
  }
  return { made, trash: await deleteTask(id) };
}
