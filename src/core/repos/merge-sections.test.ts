import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { buildStarterTree } from '@/core/domain/templates';
import { resetDb } from '@/test/db-reset';
import { createCollection, createRecord } from './collections';
import { mergeDuplicateSections, planSectionMerges } from './merge-sections';
import { createNode, seedNodes } from './nodes';
import { savePage } from './pages';
import { completeOnboarding, updateProfileSettings } from './profile';
import { createTask } from './tasks';
import { listTrash, restoreFromTrash } from './trash';

beforeEach(resetDb);

const live = async () => (await db.nodes.toArray()).filter((n) => !n.deletedAt);
const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('merging sections duplicated by two devices', () => {
  it('keeps one copy of each starter section, moves everything into it, and trashes the spares together', async () => {
    const tree = buildStarterTree(['researcher', 'student']);
    await completeOnboarding({ profileTypes: ['researcher', 'student'], tree });
    const firstCount = (await live()).length;
    await seedNodes(tree); // what the second device's setup brings in through sync
    const all = await live();
    expect(all).toHaveLength(firstCount * 2);

    // Pick a top-level section and a subsection, and file things under the *second* copies.
    const top = all.filter((n) => !n.parentId);
    const key = top[0]!.config.templateKey;
    const [a, b] = top.filter((n) => n.config.templateKey === key);
    const sub = all.find((n) => n.parentId === b!.id);
    const own = await createNode({ title: 'My own subsection', parentId: b!.id });
    const task = await createTask({ title: 'Filed under the copy', nodeId: b!.id });
    const subTask = sub ? await createTask({ title: 'In the copy’s subsection', nodeId: sub.id }) : null;
    const listA = await createCollection({ templateKey: 'papers', nodeId: a!.id });
    const listB = await createCollection({ templateKey: 'papers', nodeId: b!.id });
    const rec = await createRecord(listB.id, { title: 'RT-2 paper' });
    await savePage(a!.id, doc('From the laptop'), 'From the laptop');
    await savePage(b!.id, doc('From the phone'), 'From the phone');
    await updateProfileSettings({ bottomTabs: ['today', `node:${a!.id}`, `node:${b!.id}`] });

    expect(planSectionMerges(await db.nodes.toArray()).length).toBe(firstCount);
    expect(await mergeDuplicateSections()).toBe(firstCount);

    const after = await live();
    expect(after).toHaveLength(firstCount + 1); // + "My own subsection"
    expect(planSectionMerges(after)).toEqual([]);

    // b had more filed under it, so b is the one kept.
    expect(after.some((n) => n.id === b!.id)).toBe(true);
    expect(after.some((n) => n.id === a!.id)).toBe(false);
    expect((await db.nodes.get(own.id))!.parentId).toBe(b!.id);
    expect((await db.tasks.get(task.id))!.nodeId).toBe(b!.id);
    if (subTask) expect(after.some((n) => n.id === (subTask.nodeId as string))).toBe(true);

    // Lists of the same kind become one list, with every item.
    expect((await db.records.get(rec.id))!.collectionId).toBe(listB.id);
    expect((await db.collections.get(listA.id))!.deletedAt).toBeTruthy();

    // Both page texts survive, in one page.
    expect((await db.pages.get(b!.id))!.text).toBe('From the phone\n\nFrom the laptop');

    const tabs = (await db.profile.toArray())[0]!.settings.bottomTabs;
    expect(tabs).toEqual(['today', `node:${b!.id}`, `node:${b!.id}`]);

    // One Trash entry, and running it again changes nothing.
    expect((await listTrash()).length).toBe(1);
    expect(await mergeDuplicateSections()).toBe(0);
  });

  it('leaves sections alone when nothing is duplicated, and the Trash entry restores the spares', async () => {
    const tree = buildStarterTree(['student']);
    await completeOnboarding({ profileTypes: ['student'], tree });
    expect(await mergeDuplicateSections()).toBe(0);

    await seedNodes(tree);
    const n = (await live()).length;
    await mergeDuplicateSections();
    const [entry] = await listTrash();
    await restoreFromTrash(entry!.batchId);
    expect((await live()).length).toBe(n);
  });
});
