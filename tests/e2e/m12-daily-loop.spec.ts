import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('Home: check-in and next up come first, the map folds away and stays folded', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T07:10:00+05:30') });
  await onboard(page);
  await page.goto('/home');
  const main = page.getByRole('main');
  const card = page.getByRole('region', { name: 'Check-in' });
  const map = page.getByRole('region', { name: 'Your sections' });
  // The check-in is above the map.
  const [checkinBox, mapBox] = [await card.boundingBox(), await map.boundingBox()];
  expect(checkinBox!.y).toBeLessThan(mapBox!.y);
  await expect(main.getByRole('region', { name: 'Next up' })).toContainText('No more events today');

  // The morning in one place: "I'm up" and breakfast log the time, as on Health.
  await card.getByRole('button', { name: 'I’m up' }).click();
  await expect(card.getByText('Up at 07:10')).toBeVisible();
  await card.getByRole('button', { name: 'Ate breakfast' }).click();
  await expect(card.getByRole('button', { name: 'Ate lunch' })).toBeVisible();

  await map.getByRole('button', { name: 'Hide' }).click();
  await expect(map.getByRole('link', { name: /Research/ })).toHaveCount(0);
  await page.reload();
  await expect(map.getByRole('button', { name: 'Show' })).toBeVisible();
});

test('app-icon shortcuts: New task and I’m up open straight from the icon', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T07:05:00+05:30') });
  await onboard(page);
  await page.goto('/?do=task');
  await expect(page.getByRole('dialog', { name: 'New task' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press('Escape');

  await page.goto('/?do=wake');
  await expect(page.getByText('Woke up at 07:05')).toBeVisible();
  await page.goto('/home');
  await expect(page.getByRole('region', { name: 'Check-in' }).getByText('Up at 07:05')).toBeVisible();
});

test('weekly plan: last week’s priorities show on Today all this week', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-22T18:00:00+05:30') }); // Sunday
  await onboard(page);
  await page.goto('/reviews?period=week&offset=0');
  const main = page.getByRole('main');
  await main
    .getByLabel('Top three priorities for next week? (shown on Today all week)')
    .fill('Submit the RSS draft');
  await main.getByRole('button', { name: 'Save review' }).click();
  await expect(main.getByText(/^Saved /)).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-11-25T09:00:00+05:30')); // Wednesday
  await page.goto('/');
  const block = page.getByRole('region', { name: 'This week’s priorities' });
  await expect(block).toContainText('Submit the RSS draft');
});
