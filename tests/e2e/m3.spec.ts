import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('lists: Papers from a template, details, board drag, table sort', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  await page.getByRole('button', { name: 'New list' }).click();
  // Templates that suit Research come first.
  const picker = page.getByRole('dialog', { name: 'New list' });
  await expect(picker.getByRole('button').nth(1)).toContainText('Papers');
  await picker.getByRole('button', { name: /^Papers/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Papers' })).toBeVisible();

  const main = page.getByRole('main');
  for (const t of ['RT-2', 'Diffusion Policy']) {
    await main.getByLabel('New paper').fill(t);
    await page.keyboard.press('Enter');
  }
  // Fill details in the item panel.
  await main.getByRole('button', { name: 'Diffusion Policy' }).click();
  const item = page.getByRole('dialog', { name: 'Diffusion Policy' });
  await item.getByLabel('Authors').fill('Chi et al.');
  await item.getByLabel('Year').fill('2023');
  await item.getByRole('radio', { name: '4 of 5' }).click();
  await item.getByRole('button', { name: 'Done' }).click();

  // Board: drag a card to "Reading".
  await main.getByRole('tab', { name: 'Board' }).click();
  const toRead = main.getByRole('region', { name: 'To read' });
  await expect(toRead.getByText('Chi et al.')).toBeVisible();
  await toRead
    .getByRole('button', { name: /Diffusion Policy/ })
    .dragTo(main.getByRole('region', { name: 'Reading' }));
  await expect(main.getByRole('region', { name: 'Reading' }).getByText('Diffusion Policy')).toBeVisible();

  // Table: the view is remembered; sort by year puts empty values last.
  await page.reload();
  await expect(main.getByRole('region', { name: 'Reading' })).toBeVisible();
  await main.getByRole('tab', { name: 'Table' }).click();
  await main.getByRole('button', { name: 'Year' }).click();
  await expect(main.getByRole('row').nth(1)).toContainText('Diffusion Policy');
  await expect(main.getByLabel('Status of Diffusion Policy')).toHaveValue('Reading');

  // Ctrl+K finds items by any text.
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('chi et');
  await expect(page.getByRole('option', { name: /Diffusion Policy/ })).toBeVisible();
});

test('lists: fields and statuses can be changed without losing items', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  await page.getByRole('button', { name: 'New list' }).click();
  await page
    .getByRole('dialog', { name: 'New list' })
    .getByRole('button', { name: /^Blank list/ })
    .click();
  const main = page.getByRole('main');
  await main.getByLabel('New item').fill('Grasp dataset');
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: 'Fields & statuses' }).click();
  const s = page.getByRole('dialog', { name: 'Fields & statuses' });
  await s.getByLabel('List name').fill('Datasets');
  await s.getByLabel('New field name').fill('Size');
  await s.getByLabel('New field name').press('Enter');
  await expect(s.getByLabel('Field name Size')).toBeVisible();
  await s.getByLabel('Status 1').fill('Wanted');
  await s.getByRole('button', { name: 'Save statuses' }).click();
  await s.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Datasets' })).toBeVisible();
  await expect(main.getByRole('columnheader', { name: 'Size' })).toBeVisible();
  await expect(main.getByLabel('Status of Grasp dataset')).toHaveValue('Wanted');
});

test('conference deadline in AoE: your time, Coming up and the calendar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  await page.getByRole('button', { name: 'New list' }).click();
  await page
    .getByRole('dialog', { name: 'New list' })
    .getByRole('button', { name: /^Conference deadlines/ })
    .click();
  const main = page.getByRole('main');
  await main.getByLabel('New deadline').fill('CoRL 2027');
  await page.keyboard.press('Enter');
  await main.getByRole('button', { name: 'CoRL 2027' }).click();

  const item = page.getByRole('dialog', { name: 'CoRL 2027' });
  await item.getByRole('button', { name: 'Paper deadline', exact: true }).click();
  await page.getByRole('button', { name: 'Tuesday 24 November 2026' }).click();
  await expect(item.getByLabel('Paper deadline timezone')).toHaveValue('Etc/GMT+12');
  // 23:59 AoE on the 24th is 17:29 on the 25th in India.
  await expect(item.getByText(/Your time: Wed 25 Nov, 17:29/)).toBeVisible();
  await item.getByRole('button', { name: 'Done' }).click();
  await expect(main.getByRole('cell', { name: '24 Nov 2026 23:59 AoE' })).toBeVisible();

  await page.goto('/');
  const coming = page.getByRole('region', { name: 'Coming up' });
  await expect(coming.getByText(/CoRL 2027 · Paper deadline · 17:29 \(23:59 AoE\)/)).toBeVisible();
  await coming.getByRole('button', { name: /CoRL 2027/ }).click();
  await expect(page.getByRole('dialog', { name: 'CoRL 2027' })).toBeVisible();

  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Next week' }).first().click();
  await expect(page.locator('.fc').getByText('CoRL 2027 · Paper deadline')).toBeVisible();

  // Submitted: it leaves Coming up.
  await page.goto('/');
  await coming.getByRole('button', { name: /CoRL 2027/ }).click();
  await page.getByRole('dialog', { name: 'CoRL 2027' }).getByLabel('Status').selectOption('Submitted');
  await page.goto('/');
  await expect(page.getByText(/CoRL 2027/)).toHaveCount(0);
});
