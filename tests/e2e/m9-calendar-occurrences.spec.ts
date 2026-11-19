import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('repeating event: change or delete one day, or this and following, with undo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T08:00:00+05:30') }); // a Monday
  await onboard(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'New event' }).click();
  const sheet = page.getByRole('dialog', { name: 'New event' });
  await sheet.getByLabel('Event', { exact: true }).fill('Stand-up');
  await sheet.getByLabel('Repeat').selectOption('daily');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(sheet).toBeHidden();

  const day = (d: string) => page.locator(`.fc-timegrid-col[data-date="${d}"]`).getByText('Stand-up');
  await expect(day('2026-11-18')).toHaveCount(1);

  // Change only Wednesday.
  await day('2026-11-18').click();
  let edit = page.getByRole('dialog', { name: 'Edit event' });
  await expect(edit.getByText('Only Wednesday 18 Nov.')).toBeVisible();
  await expect(edit.getByLabel('Repeat')).toBeDisabled();
  await edit.getByLabel('Where').fill('Room 2');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await day('2026-11-18').click();
  await expect(page.getByRole('dialog', { name: 'Edit event' }).getByLabel('Where')).toHaveValue('Room 2');
  await expect(page.getByRole('radio', { name: 'This event' })).toHaveCount(0); // now an event of its own
  await page.keyboard.press('Escape');
  await day('2026-11-17').click();
  await expect(page.getByRole('dialog', { name: 'Edit event' }).getByLabel('Where')).toHaveValue('');

  // Delete only Tuesday; Undo brings it back.
  await page.getByRole('button', { name: 'Delete this one' }).click();
  await expect(day('2026-11-17')).toHaveCount(0);
  await expect(day('2026-11-16')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(day('2026-11-17')).toHaveCount(1);

  // Delete Tuesday and every one after: Monday stays, and Wednesday (its own event now) too.
  await day('2026-11-17').click();
  edit = page.getByRole('dialog', { name: 'Edit event' });
  await edit.getByRole('radio', { name: 'This and following' }).click();
  await edit.getByRole('button', { name: 'Delete these' }).click();
  await expect(day('2026-11-17')).toHaveCount(0);
  await expect(day('2026-11-16')).toHaveCount(1);
  await expect(day('2026-11-18')).toHaveCount(1);
});
