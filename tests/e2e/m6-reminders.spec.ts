import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

/** Reminder rounds recorded for something (straight from IndexedDB). */
async function rounds(page: Page, title: string) {
  return page.evaluate(
    async (t) =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('personal-os');
        open.onsuccess = () => {
          const tx = open.result.transaction(['reminders', 'habits'], 'readonly');
          const habits = tx.objectStore('habits').getAll();
          const rems = tx.objectStore('reminders').getAll();
          tx.oncomplete = () => {
            const ids = new Set(
              (habits.result as { id: string; title: string }[])
                .filter((h) => h.title === t)
                .map((h) => h.id),
            );
            resolve((rems.result as { target: { id: string } }[]).filter((r) => ids.has(r.target.id)).length);
          };
        };
      }),
    title,
  );
}

async function habitAt9(page: Page) {
  await page.goto('/habits');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Add DSA practice' }).click();
  const sheet = page.getByRole('dialog', { name: 'New habit' });
  await sheet.getByLabel('Remind me at').fill('09:00');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(main.getByRole('button', { name: 'Options for DSA practice' })).toBeVisible();
}

test('habit reminders: repeat hourly, snooze, dismiss never completes, done stops them', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:58:00+05:30') });
  await onboard(page);
  await habitAt9(page);
  const reminders = page.getByRole('region', { name: 'Reminders' });
  const card = reminders.getByRole('alert').filter({ hasText: 'DSA practice' });

  await page.clock.runFor(3 * 60_000); // 09:01
  await expect(card).toBeVisible({ timeout: 20_000 });
  // Dismiss: gone, but the habit isn't done.
  await reminders.getByRole('button', { name: 'Dismiss reminder for DSA practice' }).click();
  await expect(card).toHaveCount(0);
  const main = page.getByRole('main');
  await expect(
    main.getByRole('button', { name: 'DSA practice, Wednesday 18 Nov: not checked' }),
  ).toBeVisible();

  // An hour later it comes back (default: every 60 minutes).
  await page.clock.runFor(60 * 60_000); // 10:01
  await expect(card).toBeVisible({ timeout: 20_000 });

  // Snooze 30 minutes: hidden, then back.
  await card.getByRole('button', { name: 'Snooze DSA practice' }).click();
  await page.getByRole('menuitem', { name: '30 minutes' }).click();
  await expect(card).toHaveCount(0);
  await page.clock.runFor(20 * 60_000); // 10:21
  await expect(card).toHaveCount(0);
  await page.clock.runFor(15 * 60_000); // 10:36
  await expect(card).toBeVisible({ timeout: 20_000 });

  // Done: it stops, now and at the next round.
  await card.getByRole('button', { name: 'Mark done' }).click();
  await expect(main.getByRole('button', { name: 'DSA practice, Wednesday 18 Nov: done' })).toBeVisible();
  await page.clock.runFor(60 * 60_000);
  await expect(card).toHaveCount(0);
});

test('quiet hours hold reminders back; a reload catches up with what is due', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:58:00+05:30') });
  await onboard(page);
  await page.goto('/settings/reminders');
  await page.getByLabel('Quiet hours from').fill('08:00');
  await page.getByLabel('Quiet hours to').fill('10:00');
  // Saved (the fields show what's stored) before moving on.
  await expect(page.getByLabel('Quiet hours from')).toHaveValue('08:00');
  await expect(page.getByLabel('Quiet hours to')).toHaveValue('10:00');
  await page.waitForTimeout(300);
  await habitAt9(page);
  const card = page
    .getByRole('region', { name: 'Reminders' })
    .getByRole('alert')
    .filter({ hasText: 'DSA practice' });
  await page.clock.runFor(10 * 60_000); // 09:08, quiet
  await expect(card).toHaveCount(0);
  // The app is closed through 10:00; opening it again shows the 10:00 round.
  await page.clock.runFor(60 * 60_000);
  await page.reload();
  await expect(card).toBeVisible({ timeout: 20_000 });
});

test('two open tabs record each reminder round once', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:58:00+05:30') });
  await onboard(page);
  await habitAt9(page);
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-11-18T08:58:30+05:30') });
  await other.goto('/');
  await Promise.all([page.clock.runFor(3 * 60_000), other.clock.runFor(3 * 60_000)]);
  for (const p of [page, other])
    await expect(p.getByRole('region', { name: 'Reminders' }).getByText('DSA practice')).toBeVisible({
      timeout: 20_000,
    });
  expect(await rounds(page, 'DSA practice')).toBe(1);
});

test('offline: reminders still fire (they need no connection)', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:58:00+05:30') });
  await onboard(page);
  await habitAt9(page);
  await context.setOffline(true);
  await page.clock.runFor(3 * 60_000);
  await expect(page.getByRole('region', { name: 'Reminders' }).getByText('DSA practice')).toBeVisible({
    timeout: 20_000,
  });
  await context.setOffline(false);
});
