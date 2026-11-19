import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

test('Inbox: Move to a new note keeps the words; Undo brings the task back', async ({ page }) => {
  await onboard(page);
  await page.goto('/inbox');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Thoughts on RT-2');
  await page.keyboard.press('Enter');
  await main.getByLabel('Move Thoughts on RT-2 to a section').selectOption({ label: 'A new note' });
  await expect(page.getByText('Turned into a note')).toBeVisible();
  await expect(main.getByText('Thoughts on RT-2', { exact: true })).toBeHidden();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(main.getByText('Thoughts on RT-2', { exact: true })).toBeVisible();

  await main.getByLabel('Move Thoughts on RT-2 to a section').selectOption({ label: 'A new note' });
  await page.goto('/notes');
  await expect(page.getByRole('main').getByText('Thoughts on RT-2').first()).toBeVisible();
});

test('goals count themselves: a Papers goal follows the list status', async ({ page, isMobile }) => {
  await onboard(page);
  // A paper on the Research page's Papers list, marked Read.
  await openSection(page, 'Research', isMobile);
  const main = page.getByRole('main');
  await main.getByLabel('New paper').fill('RT-2');
  await page.keyboard.press('Enter');
  await expect(main.getByText('RT-2').first()).toBeVisible();

  await page.goto('/goals');
  await main.getByRole('button', { name: 'New goal' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'New goal' });
  await sheet.getByLabel('Goal', { exact: true }).fill('Read 30 papers');
  await sheet.getByLabel('What you count').fill('papers');
  await sheet.getByLabel('Target', { exact: true }).fill('30');
  await sheet.getByLabel('Counts').selectOption({ label: 'Items in a list status' });
  await sheet.getByLabel('List', { exact: true }).selectOption({ label: 'Papers' });
  await sheet.getByLabel('Status', { exact: true }).selectOption({ index: 0 });
  await sheet.getByRole('button', { name: 'Create' }).click();
  const goal = main.getByRole('listitem').filter({ hasText: 'Read 30 papers' });
  await expect(goal.getByText('1/30 papers')).toBeVisible();
});

test('People ↔ Occasions: a birthday entered in People shows on the Occasions calendar', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T08:00:00+05:30') });
  await onboard(page);
  await page.goto('/people');
  const main = page.getByRole('main');
  await main.getByLabel('New person').fill('Ravi');
  await page.keyboard.press('Enter');
  await main.getByText('Ravi', { exact: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Ravi' });
  await sheet.getByLabel('Birthday').fill('1999-11-24');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await openSection(page, 'Dates & Occasions', isMobile);
  const cal = main.getByRole('region', { name: 'Occasions calendar' });
  await expect(cal.getByRole('gridcell', { name: 'Tuesday 24 November 2026, 1 occasion' })).toBeVisible();
  await expect(cal.getByRole('list', { name: 'Upcoming occasions' })).toContainText('Ravi · Birthday');
  await cal.getByRole('gridcell', { name: /Tuesday 24 November 2026/ }).click();
  const row = cal
    .getByRole('list', { name: 'Occasions on this date' })
    .getByRole('listitem', { name: 'Ravi' });
  await expect(row).toContainText('27 years');
  await expect(row.getByRole('link', { name: 'From People' })).toBeVisible();

  // The occasion sheet suggests people for "For / with".
  await cal.getByRole('button', { name: 'Add occasion' }).click();
  await expect(page.locator('datalist#oc-people option[value="Ravi"]')).toHaveCount(1);
});
