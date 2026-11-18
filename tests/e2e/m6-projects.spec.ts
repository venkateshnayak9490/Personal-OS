import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('projects: a Notion-style outline with headings, subheadings, subtasks and moves', async ({
  page,
  isMobile,
}) => {
  await onboard(page);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('New project name').fill('Grasping paper');
  await page.keyboard.press('Enter');
  const main = page.getByRole('main');
  const outline = main.getByRole('list', { name: 'Project outline' });

  // Type it like a document: Enter after each line.
  await main.getByLabel('New line').fill('# Literature review');
  await page.keyboard.press('Enter');
  for (const line of [
    'Read RT-2',
    'Read Diffusion Policy',
    '## Datasets',
    'Collect grasp dataset',
    '# Writing',
    'Draft the intro',
  ]) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  await expect(outline.getByLabel('Heading Literature review')).toBeVisible();
  await expect(outline.getByLabel('Subheading Datasets')).toBeVisible();
  await expect(outline.getByLabel('Task Draft the intro')).toBeVisible();

  // Indent: Diffusion Policy becomes a subtask of RT-2 (Tab on desktop, the menu on phones).
  if (isMobile) {
    await outline.getByRole('button', { name: 'Options for Read Diffusion Policy' }).click();
    await page.getByRole('menuitem', { name: 'Make it a subtask (indent)' }).click();
  } else {
    await outline.getByLabel('Task Read Diffusion Policy').click();
    await page.keyboard.press('Tab');
  }
  await expect(
    outline.getByRole('listitem').filter({ has: page.getByLabel('Task Read Diffusion Policy') }),
  ).toHaveClass(/pl-8/);

  // Move "Draft the intro" up above the Writing heading.
  await outline.getByRole('button', { name: 'Options for Draft the intro' }).click();
  await page.getByRole('menuitem', { name: 'Move up' }).click();
  const order = async () =>
    outline
      .locator('input[aria-label]:not([aria-label="New line"])')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  await expect
    .poll(order)
    .toEqual([
      'Literature review',
      'Read RT-2',
      'Read Diffusion Policy',
      'Datasets',
      'Collect grasp dataset',
      'Draft the intro',
      'Writing',
    ]);

  // Collapse a heading hides what's under it; tasks still count toward progress.
  await outline.getByRole('button', { name: 'Collapse Literature review' }).click();
  await expect(outline.getByLabel('Task Read RT-2')).toHaveCount(0);
  await expect(outline.getByLabel('Subheading Datasets')).toHaveCount(0); // a subheading sits under its heading
  await outline.getByRole('button', { name: 'Expand Literature review' }).click();
  await outline.getByRole('checkbox', { name: 'Complete Read RT-2' }).click();
  await expect(main.getByText('33% · 1 of 3')).toBeVisible(); // subtasks don't count separately

  // Survives a reload; headings never show up as tasks elsewhere.
  await page.reload();
  await expect(outline.getByLabel('Heading Literature review')).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByRole('main').getByText('Literature review')).toHaveCount(0);
});
