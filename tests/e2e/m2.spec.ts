import { expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { onboard, openSection } from './helpers';

test('section page: Notion-style writing with "/" and markdown shortcuts, saved across reloads', async ({
  page,
  isMobile,
}) => {
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  const doc = page.getByRole('textbox', { name: 'Page' });
  await doc.click();
  await page.keyboard.type('# Weekly plan');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Focus on the grasping baseline.');
  await page.keyboard.press('Enter');
  // "/" menu → Checklist
  await page.keyboard.type('/check');
  await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Reproduce RT-2 numbers');
  await expect(doc.getByRole('heading', { level: 1, name: 'Weekly plan' })).toBeVisible();
  await expect(doc.getByRole('checkbox')).toHaveCount(1);

  await page.getByRole('main').getByRole('heading', { level: 1, name: 'Research' }).click(); // blur → save
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  const again = page.getByRole('textbox', { name: 'Page' });
  await expect(again.getByRole('heading', { level: 1, name: 'Weekly plan' })).toBeVisible();
  await expect(again.getByText('Reproduce RT-2 numbers').first()).toBeVisible();
});

test('date picker: one click to set a due date', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  await page.getByLabel('New task title').fill('Submit SMAI quiz');
  await page.getByRole('button', { name: 'Due date' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Tomorrow/ })
    .click();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByText('Tomorrow', { exact: true })).toBeVisible();
});

test('hide a section from the sidebar in one click, and show it again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The sidebar is a desktop feature.');
  await onboard(page);
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  await sidebar.getByRole('link', { name: 'Miscellaneous' }).hover();
  await sidebar.getByRole('button', { name: 'Hide Miscellaneous' }).click();
  await expect(sidebar.getByRole('link', { name: 'Miscellaneous' })).toBeHidden();
  await sidebar.getByRole('button', { name: /Hidden \(1\)/ }).click();
  await sidebar.getByRole('button', { name: 'Show Miscellaneous' }).click();
  await expect(sidebar.getByRole('link', { name: 'Miscellaneous' })).toBeVisible();
});

test('Inbox: plain-language capture, then sort into a section', async ({ page }) => {
  await onboard(page);
  await page.goto('/inbox');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Submit review fri 5pm #thesis !high');
  const understood = main.getByLabel('Understood');
  await expect(understood).toContainText('#thesis');
  await expect(understood).toContainText('High');
  await page.keyboard.press('Enter');
  await expect(main.getByText('Submit review', { exact: true })).toBeVisible();
  await expect(main.getByText('#thesis')).toBeVisible();
  await expect(main.getByText(/Fri.*17:00|Fri/).first()).toBeVisible();

  await main.getByLabel('Move Submit review to a section').selectOption({ label: 'Research' });
  await expect(main.getByText('Submit review', { exact: true })).toBeHidden();
  await expect(main.getByText('Inbox zero', { exact: false })).toBeVisible();
});

test('Ctrl+K: find a task, jump to a section, add a task', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard shortcut is a desktop feature.');
  await onboard(page);
  await page.goto('/tasks');
  await page.getByLabel('New task title').fill('Reproduce RT-2 numbers');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByText('Reproduce RT-2 numbers')).toBeVisible();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search' });
  await palette.getByLabel('Search').fill('rt-2');
  await page.keyboard.press('Enter');
  const editor = page.getByRole('dialog', { name: 'Task' });
  await expect(editor.getByLabel('Task title')).toHaveValue('Reproduce RT-2 numbers');
  await editor.getByRole('button', { name: 'Close' }).click();
  await expect(editor).toBeHidden();

  await page.keyboard.press('Control+k');
  await palette.getByLabel('Search').fill('coursework');
  await palette
    .getByRole('option', { name: /Coursework/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Coursework' })).toBeVisible();

  await page.keyboard.press('Control+k');
  await palette.getByLabel('Search').fill('Buy lab notebook tomorrow');
  await palette.getByRole('option', { name: /Add task: Buy lab notebook/ }).click();
  // Added where you are (the Coursework page), with a confirmation.
  await expect(page.getByText('Added “Buy lab notebook” to Coursework')).toBeVisible();
  await expect(page.getByRole('main').getByText('Buy lab notebook')).toBeVisible();
});

test('repeating task: completing it brings the next one', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Gym every monday');
  await page.keyboard.press('Enter');
  await expect(main.getByLabel('Repeats')).toBeVisible();
  await main.getByRole('checkbox', { name: 'Complete Gym' }).click();
  await expect(page.getByText(/Next one: Mon/)).toBeVisible();
  await expect(main.getByRole('checkbox', { name: 'Complete Gym' })).toBeVisible(); // the next occurrence
});

test('projects: create, add tasks, honest progress', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('New project name').fill('CoRL submission');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Project name')).toHaveValue('CoRL submission');
  const main = page.getByRole('main');
  for (const t of ['Run baseline', 'Write method section']) {
    await main.getByLabel('New task title').fill(t);
    await page.keyboard.press('Enter');
    await expect(main.getByText(t, { exact: true })).toBeVisible();
  }
  await main.getByRole('checkbox', { name: 'Complete Run baseline' }).click();
  await expect(main.getByText('50% · 1 of 2')).toBeVisible();
  await main.getByLabel('Add a milestone').fill('Baseline reproduced');
  await page.keyboard.press('Enter');
  await expect(main.getByText('Baseline reproduced')).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('main').getByText('1/2')).toBeVisible();
});

test('habits: create, check in today, see it on Today', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await page.goto('/habits');
  await page.getByRole('button', { name: 'New habit' }).first().click();
  await page.getByLabel('Habit', { exact: true }).fill('Read 20 pages');
  await page.getByRole('button', { name: 'Create' }).click();
  const todayLabel = format(new Date(), 'EEEE d MMM');
  await page.getByRole('button', { name: `Read 20 pages, ${todayLabel}: not checked` }).click();
  await expect(page.getByRole('button', { name: `Read 20 pages, ${todayLabel}: done` })).toBeVisible();
  await page.goto('/');
  const today = page.getByRole('region', { name: 'Habits today' });
  await expect(today.getByRole('button', { name: 'Read 20 pages, today: done' })).toBeVisible();
});

test('goals: measure progress with plus and minus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: 'New goal' }).first().click();
  await page.getByLabel('Goal', { exact: true }).fill('Read 30 papers this semester');
  await page.getByLabel('What you count').fill('papers');
  await page.getByLabel('Target', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Increase papers' }).click();
  await page.getByRole('button', { name: 'Increase papers' }).click();
  await expect(page.getByText('2/30 papers')).toBeVisible();
});
