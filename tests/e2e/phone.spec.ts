import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

/** A real finger swipe (touch pointer events) across an element, via Chrome DevTools. */
async function swipe(page: Page, selector: ReturnType<Page['locator']>, dx: number) {
  const box = (await selector.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', x0);
  for (let i = 1; i <= 8; i++) await touch('touchMove', x0 + (dx * i) / 8);
  await touch('touchEnd', x0 + dx);
}

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'Phone gestures and the bottom bar.');

  test('swipe right completes a task, swipe left moves it to tomorrow', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
    await onboard(page);
    await page.goto('/tasks');
    const main = page.getByRole('main');
    for (const t of ['Email Prof. Rajan', 'Read RT-2 paper']) {
      await main.getByLabel('New task title').fill(t);
      await page.keyboard.press('Enter');
      await expect(main.getByText(t)).toBeVisible();
    }

    await swipe(page, main.getByRole('listitem').filter({ hasText: 'Email Prof. Rajan' }), 160);
    await expect(page.getByText('Marked complete')).toBeVisible();

    await swipe(page, main.getByRole('listitem').filter({ hasText: 'Read RT-2 paper' }), -160);
    await expect(page.getByText('Moved to tomorrow')).toBeVisible();
    await expect(main.getByRole('listitem').filter({ hasText: 'Read RT-2 paper' })).toContainText('Tomorrow');
    // A swipe never also opens the task.
    await expect(page.getByRole('dialog', { name: 'Task' })).toBeHidden();
  });

  test('choose the bottom bar tabs', async ({ page }) => {
    await onboard(page);
    await page.goto('/settings');
    await page.getByLabel('Bottom bar tab 2').selectOption('calendar');
    await page.getByLabel('Bottom bar tab 3').selectOption({ label: 'Section: Gym & Fitness' });
    const bar = page.getByRole('navigation', { name: 'Main navigation' });
    await bar.getByRole('link', { name: 'Calendar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');
    await bar.getByRole('link', { name: 'Gym & Fitness' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gym & Fitness' })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'More' })).toBeVisible();
  });

  test('calendar opens on 3 days with working arrow icons', async ({ page }) => {
    const blocked: string[] = [];
    page.on('console', (m) => m.text().includes('Content Security Policy') && blocked.push(m.text()));
    await onboard(page);
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: '3 days' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.fc-next-button').click();
    await expect.poll(() => page.evaluate(() => document.fonts.check('1em fcicons'))).toBe(true);
    expect(blocked).toEqual([]);
  });
});
