import { expect, test } from '@playwright/test';
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
