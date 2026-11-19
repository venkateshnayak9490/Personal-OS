import { expect, test } from '@playwright/test';
import { addList, addSectionTask, onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('sections have their own tools: a watchlist on Movies, no task box', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Movies & Series', isMobile);
  const main = page.getByRole('main');
  await expect(main.getByLabel('New line')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Lists' })).toHaveCount(0);
  await main.getByLabel('New title').fill('Interstellar');
  await page.keyboard.press('Enter');
  await expect(main.getByRole('button', { name: 'Interstellar' })).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Movies & series' })).toBeVisible();

  // Another list still fits, through the section menu.
  await addList(page, /^Places/);
  await expect(page).toHaveURL(/\/lists\//);
  await openSection(page, 'Movies & Series', isMobile);
  await expect(main.getByRole('heading', { name: 'More lists' })).toBeVisible();
});

test('task box depends on the section: full on Coursework, tucked away on Learning', async ({
  page,
  isMobile,
}) => {
  await onboard(page);
  await openSection(page, 'Coursework', isMobile);
  await expect(page.getByRole('main').getByLabel('New line')).toBeVisible(); // the full outline

  await openSection(page, 'Learning & Skills', isMobile);
  const main = page.getByRole('main');
  await expect(main.getByLabel('New resource')).toBeVisible();
  await expect(main.getByLabel('New line')).toHaveCount(0);
  await main.getByRole('button', { name: 'Add a task here' }).click();
  await addSectionTask(page, 'Finish CS231n lecture 3');
  await expect(main.getByLabel('Task Finish CS231n lecture 3')).toBeVisible();
});

test('occasions: on the calendar every year, with comments and a reminder on the day', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-20T08:58:00+05:30') });
  await onboard(page);
  await openSection(page, 'Dates & Occasions', isMobile);
  const main = page.getByRole('main');
  await expect(main.getByLabel('New line')).toHaveCount(0);
  await main.getByLabel('New occasion').fill('Amma and Nanna');
  await page.keyboard.press('Enter');
  await main.getByRole('button', { name: 'Amma and Nanna' }).click();
  const sheet = page.getByRole('dialog', { name: 'Amma and Nanna' });
  await sheet.getByLabel('Kind').selectOption('Anniversary');
  await sheet.getByLabel('Date', { exact: true }).fill('1995-11-20');
  await sheet.getByLabel('Comments').fill('Book dinner at their favourite place.');
  await sheet.getByRole('button', { name: 'Done' }).click();

  // 9:00 on the day: a reminder.
  await page.clock.runFor(3 * 60_000);
  await expect(
    page.getByRole('region', { name: 'Reminders' }).getByText('Today: Amma and Nanna · Anniversary'),
  ).toBeVisible({
    timeout: 20_000,
  });

  // It's on this year's calendar, and opening it shows the comment.
  await page.goto('/calendar');
  await page
    .locator('.fc')
    .getByText(/Amma and Nanna/)
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'Amma and Nanna' }).getByLabel('Comments')).toHaveValue(
    'Book dinner at their favourite place.',
  );
});
