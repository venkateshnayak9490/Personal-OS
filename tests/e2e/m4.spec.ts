import { expect, test, type Page } from '@playwright/test';
import { addSectionTask, onboard, openScreen, openSection, setupVault } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

/** Research: 2 completed, 1 skipped, 1 missed (due yesterday), 1 open for later. */
async function seedWeek(page: Page, isMobile: boolean) {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') }); // Wed
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  const main = page.getByRole('main');
  for (const t of ['Read RT-2', 'Run baseline', 'Order GPU', 'Submit form yesterday', 'Write intro fri']) {
    await addSectionTask(page, t);
    await expect(main.getByLabel(`Task ${t.replace(/ (yesterday|fri)$/, '')}`)).toBeVisible();
  }
  await main.getByRole('checkbox', { name: 'Complete Read RT-2' }).click();
  await main.getByRole('checkbox', { name: 'Complete Run baseline' }).click();
  await main.getByRole('button', { name: 'Options for Order GPU' }).click();
  await page.getByRole('menuitem', { name: 'Skip…' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(main.getByLabel('Task Order GPU')).toHaveClass(/line-through/); // skipped
  // Overdue tasks would keep reminding (and their card can cover buttons): just once here.
  await page.goto('/settings/reminders');
  await page.getByLabel('Remind again every').selectOption('0');
}

test('analytics: honest completion rate, drill-down by section', async ({ page, isMobile }) => {
  await seedWeek(page, isMobile);
  await page.goto('/analytics');
  const main = page.getByRole('main');
  const tile = (name: string) => main.locator(`dt:text-is("${name}") + dd`);
  await expect(tile('Completed')).toHaveText('2');
  // 2 ÷ (2 completed + 1 skipped + 1 missed); "Write intro" isn't due yet.
  await expect(tile('Completion rate')).toHaveText('50%');
  await expect(main.getByText('1 skipped · 1 missed')).toBeVisible();
  await expect(main.getByRole('img', { name: /Wed 18 Nov: 2/ })).toBeVisible();

  // Drill down: Work → Research.
  const table = main.getByRole('table');
  await expect(table.getByRole('row', { name: /Work 2 50%/ })).toBeVisible();
  await table.getByRole('button', { name: 'Work' }).click();
  await main.getByRole('table').getByRole('button', { name: 'Research' }).click();
  await expect(main.getByRole('navigation', { name: 'Scope' })).toContainText('Research');
  await expect(tile('Completed')).toHaveText('2');

  // Last week had nothing.
  await main.getByRole('button', { name: 'Previous period' }).click();
  await expect(tile('Completed')).toHaveText('0');
  await expect(tile('Completion rate')).toHaveText('—');
});

test('reviews: weekly review with numbers, nudged from Today', async ({ page, isMobile }) => {
  await seedWeek(page, isMobile);
  // Sunday: the week ends today, so Today asks for the review.
  await page.clock.setFixedTime(new Date('2026-11-22T18:00:00+05:30'));
  await page.goto('/');
  await page.getByRole('link', { name: /Take five minutes for your weekly review/ }).click();
  await expect(page).toHaveURL(/\/reviews\?period=week&offset=0/);
  const main = page.getByRole('main');
  await expect(main.getByText('16 Nov – 22 Nov 2026')).toBeVisible();
  await expect(main.getByText('1 skipped · 2 missed')).toBeVisible(); // "Write intro" (Fri) is now missed too
  await main.getByText('What you completed').click();
  await expect(main.getByText('Read RT-2')).toBeVisible();
  await main.getByLabel('What went well this week?').fill('Baseline finally runs.');
  await main.getByRole('button', { name: 'Save review' }).click();
  await expect(main.getByText(/^Saved /)).toBeVisible();

  // Next Monday: no nudge for a reviewed week; the review is listed.
  await page.clock.setFixedTime(new Date('2026-11-23T09:00:00+05:30'));
  await page.goto('/');
  await expect(page.getByText(/weekly review/)).toHaveCount(0);
  await page.goto('/reviews');
  await main.getByRole('button', { name: /16 Nov – 22 Nov 2026/ }).click();
  await expect(main.getByLabel('What went well this week?')).toHaveValue('Baseline finally runs.');
  await expect(main.getByText('As it was when you wrote this')).toBeVisible();
});

test('notes: write, pin, find with Ctrl+K, delete to Trash', async ({ page }) => {
  await onboard(page);
  await page.goto('/notes');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'New note' }).click();
  await main.getByLabel('Note title').fill('Grasping ideas');
  await main.getByRole('textbox', { name: 'Note', exact: true }).click();
  await page.keyboard.type('Try tactile sensing with a soft gripper.');
  await main.getByLabel('Note title').click(); // blur saves
  await expect(main.getByText('Saved', { exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Pin note' }).click();
  await expect(main.getByRole('button', { name: 'Unpin note' })).toBeVisible();

  await page.reload();
  const list = main.getByRole('complementary', { name: 'All notes' });
  await expect(list.getByRole('link', { name: /Grasping ideas/ })).toBeVisible();
  await expect(main.getByRole('textbox', { name: 'Note', exact: true })).toContainText('soft gripper');

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('tactile');
  await expect(page.getByRole('option', { name: /Grasping ideas/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await main.getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByText('Moved “Grasping ideas” to Trash')).toBeVisible();
  await page.goto('/trash');
  await expect(page.getByRole('main').getByText('Grasping ideas')).toBeVisible();
});

test('journal: one page a day, mood, private entries stay out of search', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T21:00:00+05:30') });
  await onboard(page);
  await setupVault(page); // private entries are encrypted with the Vault key
  // In-app navigation: a reload would lock the Vault again (its key lives only in memory).
  await openScreen(page, 'Journal', isMobile);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Wednesday 18 November 2026' })).toBeVisible();
  await main.getByRole('radio', { name: 'Good' }).click();
  await main.getByRole('textbox', { name: 'Journal entry' }).click();
  await page.keyboard.type('Baseline finally converged.');
  await main.getByRole('radio', { name: 'Good' }).focus(); // blur saves
  await expect(main.getByText('Saved', { exact: true })).toBeVisible();

  // Yesterday: a private entry.
  await main.getByRole('button', { name: 'Previous day' }).click();
  await expect(main.getByRole('heading', { name: 'Tuesday 17 November 2026' })).toBeVisible();
  await main.getByRole('textbox', { name: 'Journal entry' }).click();
  await page.keyboard.type('Something personal about converged plans.');
  await main.getByLabel('Private').click(); // checked state comes from the saved entry
  await expect(main.getByLabel('Private')).toBeChecked();
  await expect(main.getByText(/encrypted with your Vault key/)).toBeVisible();

  const past = main.getByRole('complementary');
  await expect(past.getByRole('button', { name: /Wed 18 Nov Good Baseline finally/ })).toBeVisible();
  await expect(past.getByRole('button', { name: /Tue 17 Nov Private/ })).toBeVisible();
  await expect(past.getByText('Something personal')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('converged');
  await expect(page.getByRole('option', { name: /Baseline finally converged/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /Something personal/ })).toHaveCount(0);
});
