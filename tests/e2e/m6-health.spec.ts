import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('health: set a plan, log meals, water and sleep on time, get reminded', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T08:40:00+05:30') });
  await onboard(page);
  await openSection(page, 'Health', isMobile);
  const health = page.getByRole('main').getByRole('region', { name: 'Health' });

  await health.getByRole('button', { name: 'Set my plan' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your daily plan' });
  await sheet.getByLabel('Lunch', { exact: true }).fill('13:00');
  await sheet.getByRole('button', { name: 'Save plan' }).click();
  await expect(health.getByRole('button', { name: 'Edit plan' })).toBeVisible();

  const today = health.getByRole('list', { name: 'Today’s plan' });
  await today.getByRole('button', { name: 'Ate breakfast' }).click();
  await expect(today.getByLabel('Breakfast at')).toHaveValue('08:40');
  await expect(
    today.getByRole('listitem').filter({ hasText: 'Breakfast' }).getByText('on time'),
  ).toBeVisible();
  await today.getByRole('button', { name: 'I’m up' }).click(); // records the device's time
  await today.getByLabel('Woke up at').fill('07:10'); // …and it can be corrected
  await expect(today.getByText('tapped 08:40')).toBeVisible(); // the original tap is kept
  await today.getByLabel('Went to bed at').fill('23:40');
  await expect(today.getByText('7.5 h')).toBeVisible();
  await today.getByRole('button', { name: 'Had a glass of water' }).click();
  await expect(today.getByText('1 of 8 glasses')).toBeVisible();

  // Lunch time: the reminder logs it in one tap.
  await page.clock.runFor(4.5 * 3_600_000);
  const reminders = page.getByRole('region', { name: 'Reminders' });
  await expect(reminders.getByText('Time for lunch')).toBeVisible({ timeout: 20_000 });
  await reminders
    .getByRole('alert')
    .filter({ hasText: 'Time for lunch' })
    .getByRole('button', { name: 'Ate now' })
    .click();
  await expect(today.getByLabel('Lunch at')).toHaveValue(/13:1\d/);
  await expect(reminders.getByText('Time for lunch')).toHaveCount(0);
});

test('health: book a doctor appointment with reminders, then note what they said', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T09:00:00+05:30') });
  await onboard(page);
  await openSection(page, 'Health', isMobile);
  const health = page.getByRole('main').getByRole('region', { name: 'Health' });
  await health.getByRole('button', { name: 'New appointment' }).click();
  const sheet = page.getByRole('dialog', { name: 'New appointment' });
  await sheet.getByLabel('With').fill('Dr. Rao');
  await sheet.getByLabel('Reason (optional)').fill('Check-up');
  await sheet.getByRole('button', { name: 'Appointment date' }).click();
  // Keyboard pick: under the test's frozen clock the popover never reports itself 'stable' for a click.
  await page.getByRole('button', { name: 'Thursday 19 November 2026' }).focus();
  await page.keyboard.press('Enter');
  await sheet.getByLabel('Time').fill('11:00');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(health.getByText('Dr. Rao')).toBeVisible();
  await expect(health.getByText(/Thu 19 Nov, 11:00 AM · Check-up/)).toBeVisible();

  // A day before (11:00 today... it's 09:00), so run to 11:00: the day-before reminder fires.
  await page.clock.runFor(2 * 3_600_000 + 60_000);
  await expect(page.getByRole('region', { name: 'Reminders' }).getByText('Dr. Rao')).toBeVisible({
    timeout: 20_000,
  });

  // It's on the calendar too.
  await page.goto('/calendar');
  await expect(page.locator('.fc').getByText('Dr. Rao').first()).toBeVisible();
});
