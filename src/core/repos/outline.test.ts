import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { hiddenBy, outlineOf, parseLine } from '@/core/domain/outline';
import type { Task } from '@/core/domain/types';
import { resetDb } from '@/test/db-reset';
import {
  addLine,
  deleteHeading,
  headingToTask,
  indentTask,
  moveLine,
  outdentTask,
  sectionScope,
  updateHeading,
} from './outline';
import { createNode } from './nodes';
import { createProject } from './plans';
import { createTask } from './tasks';

beforeEach(resetDb);

async function view(projectId: string) {
  const p = (await db.projects.get(projectId))!;
  const rows = outlineOf(
    p.headings,
    (await db.tasks.toArray()).filter((t) => t.projectId === projectId),
  );
  return rows.map((r) =>
    r.kind === 'heading'
      ? `${'#'.repeat(r.heading.level)} ${r.heading.title}`
      : [r.task.title, ...r.subtasks.map((s) => `  ${s.title}`)].join('\n'),
  );
}

describe('project outline', () => {
  it('parses headings, subheadings and tasks', () => {
    expect(parseLine('# Literature review')).toEqual({
      kind: 'heading',
      level: 1,
      title: 'Literature review',
    });
    expect(parseLine('## Datasets')).toEqual({ kind: 'heading', level: 2, title: 'Datasets' });
    expect(parseLine('[] Read RT-2')).toEqual({ kind: 'task', title: 'Read RT-2' });
    expect(parseLine('#hashtag task')).toEqual({ kind: 'task', title: '#hashtag task' });
  });

  it('builds headings and tasks in the order you type them, inserting after any line', async () => {
    const p = await createProject({ title: 'Grasping paper' });
    const h = await addLine(p.id, '# Literature review');
    await addLine(p.id, 'Read RT-2');
    await addLine(p.id, '## Datasets');
    await addLine(p.id, 'Collect grasp dataset');
    await addLine(p.id, 'Read Diffusion Policy', { after: (h as { id: string }).id });
    expect(await view(p.id)).toEqual([
      '# Literature review',
      'Read Diffusion Policy',
      'Read RT-2',
      '## Datasets',
      'Collect grasp dataset',
    ]);
  });

  it('numbers old tasks that all share one order key before reordering', async () => {
    const p = await createProject({ title: 'Old project' });
    for (const t of ['A', 'B', 'C']) await createTask({ title: t, projectId: p.id }); // all 'a0'
    const c = (await db.tasks.toArray()).find((t) => t.title === 'C')!;
    await moveLine(p.id, c.id, -1);
    expect(await view(p.id)).toEqual(['A', 'C', 'B']);
    await moveLine(p.id, c.id, -1);
    await moveLine(p.id, c.id, -1); // already first: nothing happens
    expect(await view(p.id)).toEqual(['C', 'A', 'B']);
  });

  it('indents under the task above and back out again', async () => {
    const p = await createProject({ title: 'P' });
    await addLine(p.id, 'Run baseline');
    const b = await addLine(p.id, 'Tune learning rate');
    await addLine(p.id, 'Write results');
    expect(await indentTask(p.id, (b as { id: string }).id)).toBe(true);
    expect(await view(p.id)).toEqual(['Run baseline\n  Tune learning rate', 'Write results']);
    await addLine(p.id, 'Try cosine schedule', {
      parentTaskId: (await db.tasks.toArray()).find((t) => t.title === 'Run baseline')!.id,
    });
    expect(await view(p.id)).toEqual([
      'Run baseline\n  Tune learning rate\n  Try cosine schedule',
      'Write results',
    ]);
    await outdentTask(p.id, (b as { id: string }).id);
    expect(await view(p.id)).toEqual([
      'Run baseline\n  Try cosine schedule',
      'Tune learning rate',
      'Write results',
    ]);
  });

  it('edits, collapses, turns into a task and removes headings (tasks stay)', async () => {
    const p = await createProject({ title: 'P' });
    const h = (await addLine(p.id, '# Experiments')) as { id: string };
    await addLine(p.id, '## Ablations');
    await addLine(p.id, 'No vision encoder');
    await addLine(p.id, '# Writing');
    await addLine(p.id, 'Draft intro');
    await updateHeading(p.id, h.id, { title: 'Experiments (Dec)' });
    const proj = (await db.projects.get(p.id))!;
    const rows = outlineOf(
      proj.headings,
      (await db.tasks.toArray()).filter((t) => t.projectId === p.id),
    );
    const hidden = hiddenBy(rows, new Set([h.id]));
    expect(rows.filter((r) => hidden.has(r.id)).length).toBe(2); // Ablations + its task, not Writing
    await deleteHeading(p.id, h.id);
    const sub = (await db.projects.get(p.id))!.headings!.find((x) => x.title === 'Ablations')!;
    await headingToTask(p.id, sub.id);
    expect(await view(p.id)).toEqual(['Ablations', 'No vision encoder', '# Writing', 'Draft intro']);
  });

  it("a section's own outline: headings on the section, lines understand dates, priority and #tags", async () => {
    const node = await createNode({ title: 'Work Misc' });
    const scope = sectionScope(node.id);
    await addLine(scope, '# This week');
    const t = (await addLine(scope, 'Submit review fri 5pm !high #thesis')) as Task;
    expect(t).toMatchObject({ title: 'Submit review', nodeId: node.id, priority: 2, dueTime: '17:00' });
    expect(t.projectId).toBeUndefined();
    expect((await db.tags.get(t.tags[0]!))?.name).toBe('thesis');
    const n = (await db.nodes.get(node.id))!;
    expect((n.config.headings as { title: string }[]).map((h) => h.title)).toEqual(['This week']);
    const rows = outlineOf(
      n.config.headings as never,
      (await db.tasks.toArray()).filter((x) => x.nodeId === node.id),
    );
    expect(rows.map((r) => r.kind)).toEqual(['heading', 'task']);
  });
});
