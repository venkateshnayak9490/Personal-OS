import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('search opens on a phone (Home and More) and goes to every screen', async ({ page, isMobile }) => {
  await onboard(page);
  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Home' })
      .click();
    await page.getByRole('main').getByRole('button', { name: 'Search' }).click();
  } else await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search' });
  // Screens that used to be missing from "Go to".
  for (const name of ['Reviews', 'Analytics', 'Notes', 'Journal', 'Vault'])
    await expect(palette.getByRole('option', { name, exact: true })).toBeVisible();
  await palette.getByRole('combobox', { name: 'Search' }).fill('analy');
  await palette.getByRole('option', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();

  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'More' })
      .click();
    await page
      .getByRole('main')
      .getByRole('button', { name: /Search tasks, notes/ })
      .click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  }
});

test('Today: move everything overdue at once, with undo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T09:00:00+05:30') });
  await onboard(page);
  await page.goto('/');
  const main = page.getByRole('main');
  for (const t of ['Pay hostel fees', 'Email adviser']) {
    await main.getByPlaceholder('Add a task for today').fill(t);
    await page.keyboard.press('Enter');
    await expect(main.getByText(t)).toBeVisible();
  }
  // Two days later both are overdue.
  await page.clock.setFixedTime(new Date('2026-11-18T09:00:00+05:30'));
  await page.reload();
  const bar = main.getByRole('region', { name: 'Overdue tasks' });
  await expect(bar).toContainText('2 overdue');
  await bar.getByRole('button', { name: 'Tomorrow' }).click();
  await expect(page.getByText('Moved 2 overdue tasks to tomorrow')).toBeVisible();
  await expect(bar).toHaveCount(0);
  const todayList = main.getByRole('region', { name: 'Today', exact: true });
  await expect(todayList.getByText('Pay hostel fees')).toHaveCount(0); // due tomorrow now (Coming up)
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(bar).toContainText('2 overdue');
  await bar.getByRole('button', { name: 'Today' }).click();
  await expect(bar).toHaveCount(0);
  await expect(todayList.getByText('Pay hostel fees')).toBeVisible(); // due today, no longer overdue
});

test('Today: "while you were away" lists what came due while the app was closed', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:00:00+05:30') });
  await onboard(page);
  await page.goto('/');
  const main = page.getByRole('main');
  await main.getByPlaceholder('Add a task for today').fill('Submit the form 10am');
  await page.keyboard.press('Enter');
  await expect(main.getByText('Submit the form')).toBeVisible();

  // Close the app at 08:00, open it again at 13:00.
  await page.goto('about:blank');
  await page.clock.setFixedTime(new Date('2026-11-18T13:00:00+05:30'));
  await page.goto('/');
  const away = main.getByRole('region', { name: 'While you were away' });
  await expect(away).toContainText('1 reminder since Wed 08:00');
  await away.getByRole('button', { name: 'Show' }).click();
  await expect(away.getByRole('button', { name: /Submit the form.*Task due/ })).toBeVisible();
  await away.getByRole('button', { name: 'Dismiss while you were away' }).click();
  await expect(away).toHaveCount(0);
  await page.reload();
  await expect(main.getByRole('region', { name: 'While you were away' })).toHaveCount(0);
});
