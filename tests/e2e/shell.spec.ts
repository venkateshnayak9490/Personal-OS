import { expect, test } from '@playwright/test';

test('loads the dashboard with a greeting', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good|Working late/);
  await expect(page).toHaveTitle('Personal OS');
});

test('shows the right navigation for the screen size', async ({ page, isMobile }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  const bottomNav = page.locator('nav[aria-label="Main navigation"]').last();
  if (isMobile) {
    await expect(sidebar).toBeHidden();
    await expect(bottomNav).toBeVisible();
    await bottomNav.getByRole('link', { name: 'Sections' }).click();
    await page.getByRole('link', { name: 'Research' }).click();
    await expect(page).toHaveURL(/\/work\/research$/);
  } else {
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();
  }
});

test('deep links work on reload (SPA fallback)', async ({ page }) => {
  await page.goto('/personal/trips');
  await expect(page.getByRole('heading', { level: 1, name: 'Trips' })).toBeVisible();
});

test('opens Quick Capture', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Quick Capture' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Quick Capture' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('theme choice survives a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('is a valid installable PWA and works offline', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const json = (await manifest.json()) as { name: string; icons: { sizes: string }[] };
  expect(json.name).toBe('Personal OS');
  expect(json.icons.map((i) => i.sizes)).toContain('512x512');

  // Wait for the service worker to take control, then go offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the SW
  await context.setOffline(true);
  await page.goto('/self/fitness');
  await expect(page.getByRole('heading', { level: 1, name: 'Gym & Fitness' })).toBeVisible();
  await context.setOffline(false);
});

test('creates the local database', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name)))
    .toContain('personal-os');
});
