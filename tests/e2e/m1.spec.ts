import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { format, subMonths } from 'date-fns';
import { addSectionTask, onboard, openSection } from './helpers';

test('tasks: add, complete with undo, skip with reason, history, persist', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  const main = page.getByRole('main');

  await addSectionTask(page, 'Read RT-2 paper');
  await addSectionTask(page, 'Run baseline experiment');
  await expect(main.getByLabel('Task Read RT-2 paper')).toBeVisible();
  // The rest on All Tasks (status tabs, skip, editor): the same tasks.
  await page.goto('/tasks');

  // Complete, then undo.
  await main.getByRole('checkbox', { name: 'Complete Read RT-2 paper' }).click();
  await expect(main.getByText('Read RT-2 paper')).toBeHidden(); // leaves the Open list
  await page.getByRole('button', { name: /Undo/ }).last().click();
  await expect(main.getByText('Read RT-2 paper')).toBeVisible();

  // Skip with a reason: never counted as completed.
  await main.getByRole('button', { name: 'More actions for Run baseline experiment' }).click();
  await page.getByRole('menuitem', { name: 'Skip…' }).click();
  await page.getByLabel('Reason (optional)').fill('GPU unavailable');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await main.getByRole('tab', { name: /Skipped/ }).click();
  await expect(main.getByText('GPU unavailable')).toBeVisible();
  await main.getByRole('tab', { name: /Completed/ }).click();
  await expect(main.getByText('Run baseline experiment')).toBeHidden();

  // Editor: due date in the past → overdue; AoE option; history shows changes.
  await main.getByRole('tab', { name: /Open/ }).click();
  await main.getByText('Read RT-2 paper').click();
  const editor = page.getByRole('dialog', { name: 'Task' });
  await editor.getByRole('button', { name: 'Due date' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  const lastMonth15 = subMonths(new Date(), 1);
  lastMonth15.setDate(15);
  await page.getByRole('button', { name: format(lastMonth15, 'EEEE d MMMM yyyy'), exact: true }).click();
  await editor.getByLabel('Time zone for deadline').selectOption('aoe');
  await editor.getByRole('radio', { name: 'Urgent' }).click();
  await editor.getByLabel('Add a subtask').fill('Summarize section 3');
  await page.keyboard.press('Enter');
  await expect(editor.getByText('Summarize section 3')).toBeVisible();
  await expect(editor.getByText('Priority: Low → Urgent')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(main.getByText(/Overdue · .*AoE/)).toBeVisible();
  await expect(main.getByText('0/1')).toBeVisible(); // subtask counter

  // Everything survives a reload.
  await page.reload();
  await expect(main.getByText('Read RT-2 paper')).toBeVisible();
  await expect(main.getByText(/Overdue/)).toBeVisible();
});

test('sections: create nested, hide, delete to Trash and restore', async ({ page, isMobile }) => {
  await onboard(page);
  await page.goto('/settings/sections');
  const main = page.getByRole('main');
  // Phone keeps these in each row's "⋯" menu.
  const rowAction = async (title: string, desktop: string, phone: string) => {
    if (!isMobile) return main.getByRole('button', { name: `${desktop} ${title}` }).click();
    await main.getByRole('button', { name: `More actions for ${title}`, exact: true }).click();
    await page.getByRole('menuitem', { name: phone }).click();
  };

  // New sub-section inside Research.
  await rowAction('Research', 'Add inside', 'Add a section inside');
  const dlg = page.getByRole('dialog', { name: 'New section' });
  await dlg.getByLabel('Name').fill('Robot Learning');
  await dlg.getByRole('button', { name: 'Create' }).click();
  await expect(main.getByRole('link', { name: 'Robot Learning' })).toBeVisible();

  // Reorder: move Personal Life up above Self-Improvement.
  await main.getByRole('button', { name: 'Move Personal Life up' }).click();
  const tops = main.locator('li').filter({ has: page.locator('a.font-semibold') });
  await expect(tops.nth(1)).toContainText('Personal Life');

  // Hide Miscellaneous: gone from navigation, still in the editor.
  await rowAction('Miscellaneous', 'Hide', 'Hide');
  if (!isMobile) {
    await expect(page.getByRole('complementary').getByRole('link', { name: 'Miscellaneous' })).toBeHidden();
  }
  await expect(main.getByRole('link', { name: 'Miscellaneous' })).toBeVisible();

  // Delete Research (with its sub-sections) → Trash → restore.
  await rowAction('Research', 'Delete', 'Delete');
  await expect(main.getByRole('link', { name: 'Research', exact: true })).toBeHidden();
  await page.goto('/trash');
  await expect(main.getByText('Research')).toBeVisible();
  await expect(main.getByText(/\+2 subsections/)).toBeVisible(); // Physical AI + Robot Learning
  await main.getByRole('button', { name: 'Restore' }).click();
  await expect(main.getByText('Trash is empty')).toBeVisible();
  await page.goto('/settings/sections');
  await expect(main.getByRole('link', { name: 'Robot Learning' })).toBeVisible();
});

test('backup: download, erase device, import restores everything', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  await page.getByLabel('New task title').fill('Survives backup');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByText('Survives backup')).toBeVisible(); // saved

  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^personal-os-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const json = JSON.parse(await readFile(path, 'utf-8')) as {
    app: string;
    tables: { tasks: { title: string }[] };
  };
  expect(json.app).toBe('personal-os');
  expect(json.tables.tasks.map((t) => t.title)).toContain('Survives backup');
  await expect(page.getByText(/Last backup: Today/)).toBeVisible();

  // Erase → back to setup.
  await page.getByRole('button', { name: 'Erase…' }).click();
  await page.getByRole('button', { name: 'Erase this device' }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  // Set up again, then import the backup (replace).
  await onboard(page, 'Temp');
  await page.goto('/settings');
  await page.getByLabel('Choose backup file').setInputFiles(path);
  const dlg = page.getByRole('dialog', { name: 'Import backup' });
  await expect(dlg).toBeVisible();
  const safety = page.waitForEvent('download'); // replace downloads a safety copy first
  await dlg.getByRole('button', { name: /Replace everything/ }).click();
  await safety;
  await expect(page.getByText(/Imported:/)).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByRole('main').getByText('Survives backup')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Venkatesh/ })).toBeVisible();
});

test('tags: create from a task and filter by tag', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  const main = page.getByRole('main');
  for (const t of ['Tagged task', 'Untagged task']) {
    await main.getByLabel('New task title').fill(t);
    await page.keyboard.press('Enter');
  }
  await main.getByText('Tagged task', { exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Task' });
  await editor.getByLabel('Add a tag').fill('urgent-review');
  await page.keyboard.press('Enter');
  await expect(editor.getByText('#urgent-review')).toBeVisible();
  await page.keyboard.press('Escape');

  await main.getByLabel('Filter by tag').selectOption({ label: '#urgent-review' });
  await expect(main.getByText('Tagged task', { exact: true })).toBeVisible();
  await expect(main.getByText('Untagged task')).toBeHidden();
});
