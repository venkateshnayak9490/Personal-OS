import { expect, test } from '@playwright/test';
import { onboard, openScreen, sectionLink } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('home: the section map opens sections; check-in lives here, not on Today', async ({ page }) => {
  await onboard(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Check-in' })).toHaveCount(0);
  await page.goto('/home');
  await expect(page.getByRole('region', { name: 'Check-in' })).toBeVisible();
  const map = page.getByRole('region', { name: 'Your sections' });
  await expect(map.getByRole('link', { name: sectionLink('Work') })).toBeVisible();
  await map.getByRole('link', { name: sectionLink('Thesis') }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thesis' })).toBeVisible();
});

test('habits: add a suggested habit, check in, see its history; it reminds you', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T17:58:00+05:30') });
  await onboard(page);
  await page.goto('/habits');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Add DSA practice' }).click();
  const sheet = page.getByRole('dialog', { name: 'New habit' });
  await expect(sheet.getByLabel('Habit')).toHaveValue('DSA practice');
  await expect(sheet.getByLabel('Remind me at')).toHaveValue('18:00');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(main.getByRole('button', { name: 'Add DSA practice' })).toHaveCount(0);

  // 18:00: the reminder shows; "Mark done" checks today in.
  await page.clock.runFor(3 * 60_000);
  const reminders = page.getByRole('region', { name: 'Reminders' });
  await expect(reminders.getByText('DSA practice')).toBeVisible({ timeout: 20_000 });
  await reminders.getByRole('button', { name: 'Mark done' }).click();
  await expect(main.getByRole('button', { name: /DSA practice, Wednesday 18 Nov: done/ })).toBeVisible();

  await main.getByRole('button', { name: 'Options for DSA practice' }).click();
  await page.getByRole('menuitem', { name: 'History' }).click();
  const detail = page.getByRole('dialog', { name: 'DSA practice' });
  await expect(detail.getByText('Done in total')).toBeVisible();
  await expect(detail.getByRole('img', { name: /^1 days done/ })).toBeVisible();
});

test('goals: a goal built by a habit counts its check-ins', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await page.goto('/habits');
  await page.getByRole('main').getByRole('button', { name: 'Add Gym' }).click();
  await page.getByRole('dialog', { name: 'New habit' }).getByRole('button', { name: 'Create' }).click();
  const todayCell = page
    .getByRole('main')
    .getByRole('button', { name: 'Gym, Wednesday 18 Nov: not checked' });
  await expect(todayCell).toBeVisible();

  await openScreen(page, 'Goals', isMobile);
  await page.getByRole('main').getByRole('button', { name: 'Add goal 120 gym sessions this year' }).click();
  const sheet = page.getByRole('dialog', { name: 'New goal' });
  await expect(sheet.getByRole('button', { name: 'Gym', pressed: true })).toBeVisible(); // linked already
  await sheet.getByRole('button', { name: 'Create' }).click();
  const goal = page.getByRole('main').getByRole('listitem').filter({ hasText: '120 gym sessions this year' });
  await expect(goal.getByText('0/120 sessions')).toBeVisible();

  // Check in at the gym today: the goal moves.
  await page.goto('/habits');
  await todayCell.click();
  await expect(
    page.getByRole('main').getByRole('button', { name: 'Gym, Wednesday 18 Nov: done' }),
  ).toBeVisible();
  await page.goto('/goals');
  await expect(goal.getByText('1/120 sessions')).toBeVisible();
});

test('sidebar: drag its edge to resize; the width is remembered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The sidebar is a desktop feature.');
  await onboard(page);
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
  const before = (await sidebar.boundingBox())!.width;
  const handle = page.getByRole('separator', { name: 'Resize sidebar' });
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + 200);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + 200, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(before + 60);
  await page.reload();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(before + 60);
});
