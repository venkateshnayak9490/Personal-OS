import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { buildStarterTree, splitList } from '@/core/domain/templates';
import { buildTree, descendantIds } from '@/core/domain/tree';
import { resetDb } from '@/test/db-reset';
import { createNode, deleteNode, moveNodeStep, moveNodeToParent, updateNode } from './nodes';
import { completeOnboarding, PROFILE_ID } from './profile';
import { createTag, deleteTag, updateTag } from './tags';
import {
  createTask,
  deleteTask,
  duplicateTask,
  revertTaskStatus,
  setTaskRepeat,
  setTaskStatus,
  updateTask,
} from './tasks';
import { autoPurgeTrash, deleteForever, listTrash, restoreFromTrash } from './trash';
import { savePage } from './pages';
import { purge } from './write';

beforeEach(resetDb);

const live = async () => (await db.nodes.toArray()).filter((n) => !n.deletedAt);

describe('write path', () => {
  it('logs creation and queues it for sync in the same transaction', async () => {
    const t = await createTask({ title: '  Read RT-2 paper ' });
    expect(t.title).toBe('Read RT-2 paper');
    const logs = await db.activityLog.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ entityTable: 'tasks', entityId: t.id, action: 'created' });
    expect(await db.outbox.count()).toBe(1);
  });

  it('logs only the fields that changed and bumps the version', async () => {
    const t = await createTask({ title: 'A', priority: 4 });
    await updateTask(t.id, { title: 'A', priority: 1 });
    const after = await db.tasks.get(t.id);
    expect(after?.version).toBe(2);
    const upd = (await db.activityLog.toArray()).find((l) => l.action === 'updated');
    expect(upd?.before).toEqual({ priority: 4 });
    expect(upd?.after).toEqual({ priority: 1 });
  });

  it('writes nothing when nothing changed', async () => {
    const t = await createTask({ title: 'A' });
    expect(await updateTask(t.id, { title: 'A' })).toBeNull();
    expect(await db.activityLog.count()).toBe(1);
  });

  it('rejects empty titles', async () => {
    await expect(createTask({ title: '   ' })).rejects.toThrow();
    await expect(createNode({ title: '' })).rejects.toThrow();
  });
});

describe('task status (honest progress)', () => {
  it('records completed / skipped / reopened as distinct actions', async () => {
    const t = await createTask({ title: 'Gym' });
    await setTaskStatus(t.id, 'skipped', { reason: 'Sick' });
    let cur = await db.tasks.get(t.id);
    expect(cur).toMatchObject({ status: 'skipped', skippedReason: 'Sick' });
    expect(cur?.completedAt).toBeUndefined();

    await setTaskStatus(t.id, 'not_started');
    await setTaskStatus(t.id, 'completed');
    cur = await db.tasks.get(t.id);
    expect(cur?.status).toBe('completed');
    expect(cur?.completedAt).toBeTypeOf('number');
    expect(cur?.skippedReason).toBeUndefined();

    const actions = (await db.activityLog.orderBy('ts').toArray()).map((l) => l.action);
    expect(actions).toEqual(['created', 'skipped', 'reopened', 'completed']);
  });

  it('undo restores the previous status exactly', async () => {
    const t = await createTask({ title: 'X' });
    const res = await setTaskStatus(t.id, 'completed');
    await revertTaskStatus(res!.before);
    const cur = await db.tasks.get(t.id);
    expect(cur?.status).toBe('not_started');
    expect(cur?.completedAt).toBeUndefined();
  });
});

describe('subtasks', () => {
  it('inherit the parent section, move with it, and are deleted/restored with it', async () => {
    const parent = await createTask({ title: 'Lit review', nodeId: 'n1' });
    const sub = await createTask({ title: 'Paper 1', parentTaskId: parent.id });
    expect(sub.nodeId).toBe('n1');

    await updateTask(parent.id, { nodeId: 'n2' });
    expect((await db.tasks.get(sub.id))?.nodeId).toBe('n2');

    const batch = await deleteTask(parent.id);
    expect((await db.tasks.get(sub.id))?.deletedAt).toBeTypeOf('number');
    const trash = await listTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatchObject({ batchId: parent.id, extra: { tasks: 1 } });

    await restoreFromTrash(batch!);
    expect((await db.tasks.get(sub.id))?.deletedAt).toBeUndefined();
    expect((await db.tasks.get(parent.id))?.trashBatchId).toBeUndefined();
  });

  it('duplicates with subtasks as fresh not-started tasks', async () => {
    const p = await createTask({ title: 'Plan', priority: 1, tags: ['t'] });
    const s = await createTask({ title: 'Step', parentTaskId: p.id });
    await setTaskStatus(s.id, 'completed');
    const copy = await duplicateTask(p.id);
    expect(copy).toMatchObject({ title: 'Plan (copy)', priority: 1, tags: ['t'], status: 'not_started' });
    const subs = await db.tasks.where('parentTaskId').equals(copy.id).toArray();
    expect(subs.map((x) => [x.title, x.status])).toEqual([['Step', 'not_started']]);
  });
});

describe('sections tree', () => {
  it('reorders siblings and moves between parents without cycles', async () => {
    const work = await createNode({ title: 'Work' });
    const a = await createNode({ title: 'A', parentId: work.id });
    const b = await createNode({ title: 'B', parentId: work.id });
    const c = await createNode({ title: 'C', parentId: work.id });

    await moveNodeStep(c.id, 'up');
    let tree = buildTree(await live());
    expect(tree[0]!.children.map((t) => t.node.title)).toEqual(['A', 'C', 'B']);
    await moveNodeStep(a.id, 'up'); // already first: no-op
    await moveNodeStep(a.id, 'down');
    tree = buildTree(await live());
    expect(tree[0]!.children.map((t) => t.node.title)).toEqual(['C', 'A', 'B']);

    await moveNodeToParent(b.id, a.id); // nest B under A
    await expect(moveNodeToParent(a.id, b.id)).rejects.toThrow(/inside itself/);
    await moveNodeToParent(a.id, undefined); // A (with B) to top level
    tree = buildTree(await live());
    expect(tree.map((t) => t.node.title)).toEqual(['Work', 'A']);
    expect(tree[1]!.children.map((t) => t.node.title)).toEqual(['B']);
  });

  it('renames, hides and recolors', async () => {
    const n = await createNode({ title: 'Reserch' });
    await updateNode(n.id, { title: 'Research', hidden: true, color: 'sky' });
    expect(await db.nodes.get(n.id)).toMatchObject({ title: 'Research', hidden: true, color: 'sky' });
  });

  it('deleting a section trashes its subtree and tasks as one entry; restore brings all back', async () => {
    const work = await createNode({ title: 'Work' });
    const research = await createNode({ title: 'Research', parentId: work.id });
    const topic = await createNode({ title: 'Physical AI', parentId: research.id });
    const t1 = await createTask({ title: 'Read paper', nodeId: topic.id });
    const other = await createTask({ title: 'Elsewhere' });

    await deleteNode(research.id);
    expect((await live()).map((n) => n.title)).toEqual(['Work']);
    expect((await db.tasks.get(t1.id))?.deletedAt).toBeTypeOf('number');
    expect((await db.tasks.get(other.id))?.deletedAt).toBeUndefined();

    const [entry] = await listTrash();
    expect(entry).toMatchObject({ batchId: research.id, extra: { nodes: 1, tasks: 1 } });

    await restoreFromTrash(research.id);
    expect((await live()).map((n) => n.title).sort()).toEqual(['Physical AI', 'Research', 'Work']);
    expect((await db.tasks.get(t1.id))?.deletedAt).toBeUndefined();
  });

  it('delete forever removes the whole batch and logs it', async () => {
    const n = await createNode({ title: 'Temp' });
    await createTask({ title: 'x', nodeId: n.id });
    await deleteNode(n.id);
    await deleteForever(n.id);
    expect(await db.nodes.count()).toBe(0);
    expect(await db.tasks.count()).toBe(0);
    expect((await db.activityLog.toArray()).filter((l) => l.action === 'purged')).toHaveLength(2);
    expect((await db.outbox.toArray()).filter((o) => o.op === 'delete')).toHaveLength(2);
  });

  it('auto-purges trash older than 30 days only', async () => {
    const oldTask = await createTask({ title: 'old' });
    const newTask = await createTask({ title: 'new' });
    await deleteTask(oldTask.id);
    await deleteTask(newTask.id);
    await db.tasks.update(oldTask.id, { deletedAt: Date.now() - 31 * 86_400_000 });
    expect(await autoPurgeTrash()).toBe(1);
    expect(await db.tasks.get(oldTask.id)).toBeUndefined();
    expect(await db.tasks.get(newTask.id)).toBeDefined();
  });

  it('undoing a create purges it', async () => {
    const t = await createTask({ title: 'oops' });
    await purge([{ tableName: 'tasks', id: t.id }]);
    expect(await db.tasks.get(t.id)).toBeUndefined();
  });
});

describe('tags', () => {
  it('normalizes names, dedupes case-insensitively, and blocks rename clashes', async () => {
    const a = await createTag('#Physical AI', 'violet');
    expect(a.name).toBe('Physical-AI');
    expect((await createTag('physical-ai')).id).toBe(a.id);
    const b = await createTag('smai');
    await expect(updateTag(b.id, { name: 'PHYSICAL-AI' })).rejects.toThrow(/already exists/);
    await deleteTag(b.id);
    expect((await db.tags.get(b.id))?.deletedAt).toBeTypeOf('number');
  });
});

describe('onboarding', () => {
  it('builds a researcher tree with personal topics and courses, merging profiles without duplicates', () => {
    const tree = buildStarterTree(['researcher', 'student'], {
      researchTopics: splitList('Physical AI'),
      courses: splitList('SMAI, '),
    });
    expect(tree.map((t) => t.title)).toEqual(['Work', 'Self-Improvement', 'Personal Life', 'Miscellaneous']);
    const work = tree[0]!.children!;
    expect(work.filter((c) => c.key === 'coursework')).toHaveLength(1);
    expect(work.find((c) => c.key === 'research')?.children?.map((c) => c.title)).toEqual(['Physical AI']);
    expect(work.find((c) => c.key === 'coursework')?.children?.map((c) => c.title)).toEqual(['SMAI']);
    expect(work.at(-1)?.title).toBe('Work Misc');
  });

  it('creates sections and the profile together, once', async () => {
    await completeOnboarding({
      profileTypes: ['researcher'],
      displayName: 'Venkatesh',
      adviserName: 'Prof. KS Rajan',
      personalization: { researchTopics: ['Physical AI'], courses: ['SMAI'] },
      timezone: 'Asia/Kolkata',
    });
    const profile = await db.profile.get(PROFILE_ID);
    expect(profile).toMatchObject({
      profileTypes: ['researcher'],
      timezone: 'Asia/Kolkata',
      weekStartsOn: 1,
      settings: { displayName: 'Venkatesh', adviserName: 'Prof. KS Rajan' },
    });
    const nodes = await live();
    const tree = buildTree(nodes);
    expect(tree.map((t) => t.node.title)).toEqual([
      'Work',
      'Self-Improvement',
      'Personal Life',
      'Miscellaneous',
    ]);
    const research = nodes.find((n) => n.moduleKey === 'research')!;
    expect(descendantIds(nodes, research.id).map((id) => nodes.find((n) => n.id === id)?.title)).toEqual([
      'Physical AI',
    ]);
    await expect(completeOnboarding({ profileTypes: ['other'] })).rejects.toThrow(/Already/);
    expect(await live()).toHaveLength(nodes.length); // the failed second run created nothing
  });
});

describe('pages (Notion-style)', () => {
  const doc = (text: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

  it('creates on first save, updates after, and keeps one history line while typing', async () => {
    const node = await createNode({ title: 'Research' });
    await savePage(node.id, doc('Plan'), 'Plan');
    await savePage(node.id, doc('Plan for the week'), 'Plan for the week');
    await savePage(node.id, doc('Plan for the week!'), 'Plan for the week!');
    const page = await db.pages.get(node.id);
    expect(page?.text).toBe('Plan for the week!');
    const log = await db.activityLog.where('[entityTable+entityId]').equals(['pages', node.id]).toArray();
    expect(log.map((l) => l.action)).toEqual(['created']); // later saves within 10 min add no lines
    expect(await db.outbox.where('table').equals('pages').count()).toBe(3); // but all reach sync
  });

  it('goes to Trash with its section and comes back on restore', async () => {
    const node = await createNode({ title: 'Ideas' });
    await savePage(node.id, doc('Idea'), 'Idea');
    const batch = await deleteNode(node.id);
    expect((await db.pages.get(node.id))?.deletedAt).toBeTruthy();
    await savePage(node.id, doc('typed after delete'), 'typed after delete'); // ignored
    await restoreFromTrash(batch!);
    const page = await db.pages.get(node.id);
    expect(page?.deletedAt).toBeUndefined();
    expect(page?.text).toBe('Idea');
  });
});

describe('repeating tasks', () => {
  const future = '2099-01-05'; // a Monday, far ahead so "skip past dates" doesn't kick in

  it('closing one occurrence creates the next; undo removes it again', async () => {
    const t = await createTask({ title: 'Weekly group meeting', dueDate: future });
    await createTask({ title: 'Prepare slides', parentTaskId: t.id });
    await setTaskRepeat(t.id, { freq: 'WEEKLY', interval: 1, byDay: ['MO'] });
    const res = await setTaskStatus(t.id, 'completed');
    expect(res?.next?.dueDate).toBe('2099-01-12');
    expect(res?.next?.status).toBe('not_started');
    const subs = await db.tasks.where('parentTaskId').equals(res!.next!.id).toArray();
    expect(subs.map((s) => s.title)).toEqual(['Prepare slides']);

    await revertTaskStatus(res!.before);
    const open = (await db.tasks.toArray()).filter((x) => x.title === 'Weekly group meeting');
    expect(open).toHaveLength(1); // the spawned one is gone
    expect(open[0]!.status).toBe('not_started');
  });

  it('skipping also moves on, and history stays honest', async () => {
    const t = await createTask({ title: 'Gym', dueDate: future });
    await setTaskRepeat(t.id, { freq: 'DAILY', interval: 1 });
    const res = await setTaskStatus(t.id, 'skipped', { reason: 'sick' });
    expect(res?.next?.dueDate).toBe('2099-01-06');
    expect((await db.tasks.get(t.id))?.status).toBe('skipped'); // not counted as done
  });

  it('a task done late jumps to the next date that is not in the past', async () => {
    const t = await createTask({ title: 'Water plants', dueDate: '2020-01-01' });
    await setTaskRepeat(t.id, { freq: 'DAILY', interval: 1 });
    const res = await setTaskStatus(t.id, 'completed');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(res!.next!.dueDate! >= today).toBe(true);
  });
});
