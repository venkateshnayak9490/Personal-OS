import { newId } from '@/core/domain/entity';
import { keyBetween, needsRenumber, outlineOf, parseLine, renumber } from '@/core/domain/outline';
import type { ProjectHeading, Task } from '@/core/domain/types';
import { db } from '@/core/db';
import { updateProject } from './plans';
import { createTask, updateTask } from './tasks';

/** Outline edits read, then write: one at a time, so quick typing never loses a line. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

async function load(projectId: string) {
  const project = await db.projects.get(projectId);
  if (!project || project.deletedAt) throw new Error('Project not found');
  const tasks = (await db.tasks.where('projectId').equals(projectId).toArray()).filter((t) => !t.deletedAt);
  return { project, tasks, rows: outlineOf(project, tasks) };
}

/** Give every row its own key in display order (older tasks all share one). */
async function ensureOrdered(projectId: string) {
  let s = await load(projectId);
  const subsNeed = s.rows.some((r) => r.kind === 'task' && needsRenumber(r.subtasks));
  if (!needsRenumber(s.rows) && !subsNeed) return s;
  const keys = renumber(s.rows.length);
  const headings: ProjectHeading[] = [];
  for (const [i, r] of s.rows.entries()) {
    if (r.kind === 'heading') headings.push({ ...r.heading, order: keys[i]! });
    else {
      if (r.task.order !== keys[i]) await updateTask(r.id, { order: keys[i]! });
      const sk = renumber(r.subtasks.length);
      for (const [j, sub] of r.subtasks.entries())
        if (sub.order !== sk[j]) await updateTask(sub.id, { order: sk[j]! });
    }
  }
  if (headings.length) await updateProject(projectId, { headings });
  s = await load(projectId);
  return s;
}

/**
 * Add a line after a row (or at the end). "# " makes a heading, "## " a subheading, else a task.
 * With `parentTaskId` it's a subtask, placed after `after` among that task's subtasks.
 */
export function addLine(
  projectId: string,
  text: string,
  opts: { after?: string; parentTaskId?: string; nodeId?: string } = {},
) {
  return serial(async () => {
    const line = parseLine(text);
    if (!line.title) throw new Error('Type something first');
    const { project, rows } = await ensureOrdered(projectId);
    if (opts.parentTaskId) {
      const parent = rows.find((r) => r.id === opts.parentTaskId);
      const subs = parent?.kind === 'task' ? parent.subtasks : [];
      const i = opts.after ? subs.findIndex((s) => s.id === opts.after) : subs.length - 1;
      return createTask({
        title: line.title,
        projectId,
        nodeId: opts.nodeId,
        parentTaskId: opts.parentTaskId,
        order: keyBetween(subs[i]?.order, subs[i + 1]?.order),
      });
    }
    const i = opts.after ? rows.findIndex((r) => r.id === opts.after) : rows.length - 1;
    const order = keyBetween(rows[i]?.order, rows[i + 1]?.order);
    if (line.kind === 'heading') {
      const h: ProjectHeading = {
        id: newId(),
        title: line.title,
        level: line.level,
        order,
        createdAt: Date.now(),
      };
      await updateProject(projectId, { headings: [...(project.headings ?? []), h] });
      return h;
    }
    return createTask({ title: line.title, projectId, nodeId: opts.nodeId, order });
  });
}

export function updateHeading(
  projectId: string,
  id: string,
  changes: Partial<Pick<ProjectHeading, 'title' | 'level'>>,
) {
  return serial(async () => {
    const { project } = await load(projectId);
    if (changes.title !== undefined && !changes.title.trim()) throw new Error('A heading needs words');
    await updateProject(projectId, {
      headings: (project.headings ?? []).map((h) => (h.id === id ? { ...h, ...changes } : h)),
    });
  });
}

/** Removes a heading (its tasks stay, they just move up under the one before). Returns it for Undo. */
export function deleteHeading(projectId: string, id: string) {
  return serial(async () => {
    const { project } = await load(projectId);
    const gone = (project.headings ?? []).find((h) => h.id === id);
    await updateProject(projectId, { headings: (project.headings ?? []).filter((h) => h.id !== id) });
    return gone;
  });
}

export function restoreHeading(projectId: string, h: ProjectHeading) {
  return serial(async () => {
    const { project } = await load(projectId);
    await updateProject(projectId, { headings: [...(project.headings ?? []), h] });
  });
}

/** Move a line one place up or down (a subtask moves among its siblings). */
export function moveLine(projectId: string, id: string, dir: -1 | 1) {
  return serial(async () => {
    const { rows } = await ensureOrdered(projectId);
    const sub = rows.flatMap((r) => (r.kind === 'task' ? r.subtasks : [])).find((s) => s.id === id);
    const list: { id: string; order: string }[] = sub
      ? (rows.find((r) => r.id === sub.parentTaskId) as { subtasks: Task[] }).subtasks
      : rows;
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // Land just past the neighbour: between it and the one after it (in the direction of travel).
    const order =
      dir < 0
        ? keyBetween(list[j - 1]?.order, list[j]!.order)
        : keyBetween(list[j]!.order, list[j + 1]?.order);
    const row = sub ? undefined : rows[i];
    if (row?.kind === 'heading') await setHeadingOrder(projectId, id, order);
    else await updateTask(id, { order });
  });
}

async function setHeadingOrder(projectId: string, id: string, order: string) {
  const { project } = await load(projectId);
  await updateProject(projectId, {
    headings: (project.headings ?? []).map((h) => (h.id === id ? { ...h, order } : h)),
  });
}

/** Tab: make a task a subtask of the task just above it. */
export function indentTask(projectId: string, id: string) {
  return serial(async () => {
    const { rows } = await ensureOrdered(projectId);
    const i = rows.findIndex((r) => r.id === id);
    const above = rows[i - 1];
    const row = rows[i];
    if (!row || row.kind !== 'task' || above?.kind !== 'task') return false;
    if (row.subtasks.length) throw new Error('This task has its own subtasks, so it can’t go inside another');
    await updateTask(id, {
      parentTaskId: above.id,
      order: keyBetween(above.subtasks.at(-1)?.order, undefined),
    });
    return true;
  });
}

/** Shift+Tab: a subtask becomes a task again, right after its parent. */
export function outdentTask(projectId: string, id: string) {
  return serial(async () => {
    const { rows } = await ensureOrdered(projectId);
    const i = rows.findIndex((r) => r.kind === 'task' && r.subtasks.some((s) => s.id === id));
    if (i < 0) return false;
    await updateTask(id, { parentTaskId: undefined, order: keyBetween(rows[i]!.order, rows[i + 1]?.order) });
    return true;
  });
}

/** A heading turned into a task, in the same place. */
export function headingToTask(projectId: string, id: string, nodeId?: string) {
  return serial(async () => {
    const { project } = await load(projectId);
    const h = (project.headings ?? []).find((x) => x.id === id);
    if (!h) return;
    await updateProject(projectId, { headings: (project.headings ?? []).filter((x) => x.id !== id) });
    await createTask({ title: h.title, projectId, nodeId, order: h.order });
  });
}
