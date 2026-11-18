import { expect, test, type Page } from '@playwright/test';
import { onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

/** Research: 2 completed, 1 skipped, 1 missed (due yesterday), 1 open for later. */
async function seedWeek(page: Page, isMobile: boolean) {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') }); // Wed
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  const main = page.getByRole('main');
  for (const t of ['Read RT-2', 'Run baseline', 'Order GPU', 'Submit form yesterday', 'Write intro fri']) {
    await main.getByLabel('New task title').fill(t);
    await page.keyboard.press('Enter');
    await expect(main.getByText(t.replace(/ (yesterday|fri)$/, ''), { exact: true })).toBeVisible();
  }
  await main.getByRole('checkbox', { name: 'Complete Read RT-2' }).click();
  await main.getByRole('checkbox', { name: 'Complete Run baseline' }).click();
  await main.getByRole('button', { name: 'More actions for Order GPU' }).click();
  await page.getByRole('menuitem', { name: 'Skip…' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(main.getByText('Order GPU', { exact: true })).toBeHidden();
}

test('analytics: honest completion rate, drill-down by section', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
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
  test.skip(isMobile, 'Desktop first.');
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
