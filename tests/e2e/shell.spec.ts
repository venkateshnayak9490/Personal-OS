import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('first run goes through setup, then lands on Today', async ({ page }) => {
  await onboard(page);
  await expect(page).toHaveTitle('Personal OS');
  // Reload: setup is remembered.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Venkatesh/ })).toBeVisible();
});

test('shows the right navigation for the screen size', async ({ page, isMobile }) => {
  await onboard(page);
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  const bottomNav = page.locator('nav[aria-label="Main navigation"]').last();
  if (isMobile) {
    await expect(sidebar).toBeHidden();
    await expect(bottomNav).toBeVisible();
    await bottomNav.getByRole('link', { name: 'Home' }).click();
    await page
      .getByRole('region', { name: 'Your sections' })
      .getByRole('link', { name: 'Research', exact: true })
      .click();
  } else {
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: 'Work', exact: true }).click();
    await page
      .getByRole('main')
      .getByRole('link', { name: /Research/ })
      .first()
      .click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Research' })).toBeVisible();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/);
});

test('deep links work on reload (SPA fallback)', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings/sections');
  await expect(page.getByRole('heading', { level: 1, name: 'Sections' })).toBeVisible();
});

test('New task (＋): adds a task for today in a couple of taps', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'New task' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'New task' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('New task title').fill('Email Prof. Rajan');
  await page.keyboard.press('Enter');
  await expect(sheet.getByText(/Added to Inbox, due today/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // On Today, new tasks default to today, so it shows up right away.
  await expect(page.getByRole('main').getByText('Email Prof. Rajan')).toBeVisible();
});

test('desktop Refresh reloads the app and keeps your data', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the refresh button is in the desktop sidebar');
  await onboard(page);
  await page.getByRole('button', { name: 'New task' }).first().click();
  await page
    .getByRole('dialog', { name: 'New task' })
    .getByLabel('New task title')
    .fill('Survives a refresh');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.evaluate(() => ((window as unknown as { mark: number }).mark = 1));
  await page
    .getByRole('complementary', { name: 'Main navigation' })
    .getByRole('button', { name: 'Refresh' })
    .click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { mark?: number }).mark)).toBeUndefined();
  await expect(page.getByRole('main').getByText('Survives a refresh')).toBeVisible();
});

test('a missing section shows a message inside the app, not a blank page', async ({ page, isMobile }) => {
  await onboard(page);
  await page.goto('/s/does-not-exist');
  await expect(page.getByText('This section doesn’t exist')).toBeVisible();
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('theme choice survives a reload', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings/general');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('is a valid installable PWA and works offline', async ({ page, context }) => {
  await onboard(page);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const json = (await manifest.json()) as { name: string; icons: { sizes: string }[] };
  expect(json.name).toBe('Personal OS');
  expect(json.icons.map((i) => i.sizes)).toContain('512x512');

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { level: 1, name: 'All Tasks' })).toBeVisible();
  // Writing still works offline (local database).
  await page.getByLabel('New task title').fill('Offline task');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByText('Offline task')).toBeVisible();
  await context.setOffline(false);
});
