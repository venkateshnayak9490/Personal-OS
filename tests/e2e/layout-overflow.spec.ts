import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// A long, ordinary title must truncate, never widen the page (it once made Today 807px wide on a phone).
test('a very long project name does not make Today scroll sideways', async ({ page }) => {
  await onboard(page);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page
    .getByLabel('New project name')
    .fill(
      'Thesis chapter three: literature review on vision-language-action models for robotic manipulation in cluttered scenes',
    );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projects\/.+/);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Active projects' })).toBeVisible();
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
});
