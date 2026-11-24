import { expect, test } from '@playwright/test';
import { addList, onboard, openScreen, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('lists: Papers from a template, details, board drag, table sort', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  // Research has its Papers list right on the page; the first paper starts it.
  const main = page.getByRole('main');
  for (const t of ['RT-2', 'Diffusion Policy']) {
    await main.getByLabel('New paper').fill(t);
    await page.keyboard.press('Enter');
    await expect(main.getByRole('button', { name: t, exact: true })).toBeVisible();
  }
  await expect(main.getByRole('heading', { level: 2, name: 'Papers' })).toBeVisible();
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
  if (isMobile)
    await toRead.getByLabel('Move Diffusion Policy to').selectOption('Reading'); // no drag and drop on touch
  else
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
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  await addList(page, /^Blank list/);
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
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  await addList(page, /^Conference deadlines/);
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
  // Phones open on a 3-day view, so the 25th is two pages ahead.
  for (let i = 0; i < (isMobile ? 2 : 1); i++) await page.locator('.fc-next-button').click();
  await expect(page.locator('.fc').getByText('CoRL 2027 · Paper deadline')).toBeVisible();

  // Submitted: it leaves Coming up.
  await page.goto('/');
  await coming.getByRole('button', { name: /CoRL 2027/ }).click();
  await page.getByRole('dialog', { name: 'CoRL 2027' }).getByLabel('Status').selectOption('Submitted');
  await page.goto('/');
  await expect(page.getByText(/CoRL 2027/)).toHaveCount(0);
});

test('meetings: notes, action items, and carry-over to the next meeting', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T10:30:00+05:30') });
  await onboard(page);
  await openSection(page, 'Adviser Meetings', isMobile);
  await page.getByRole('button', { name: 'New meeting' }).click();
  const main = page.getByRole('main');
  await main.getByLabel('Meeting title').fill('Meeting with Prof. Rajan');
  await main.getByLabel('With').fill('Prof. KS Rajan');
  for (const t of ['Run the grasping baseline', 'Read RT-2 fri']) {
    await main.getByLabel('New action item').fill(t);
    await page.keyboard.press('Enter');
  }
  const items = main.getByRole('list', { name: 'Action items' });
  await expect(items.getByText('Read RT-2')).toBeVisible();
  await expect(items.getByText('Fri', { exact: false })).toBeVisible(); // "fri" became a due date
  await items.getByRole('button', { name: 'Follow up on Read RT-2 next meeting' }).click();
  await items.getByRole('checkbox', { name: 'Complete Read RT-2' }).click();
  await expect(items.getByRole('checkbox', { name: 'Complete Read RT-2' })).toBeChecked();

  await main.getByRole('textbox', { name: 'Meeting notes' }).click();
  await page.keyboard.type('Decided to try diffusion policy next.');
  await main.getByLabel('Meeting title').click(); // blur saves
  await expect(main.getByText('Saved', { exact: true })).toBeVisible();

  // Action items are tasks.
  await page.goto('/tasks');
  await expect(page.getByRole('main').getByText('Run the grasping baseline')).toBeVisible();

  // Next week's meeting reuses the title and brings things over.
  await openSection(page, 'Adviser Meetings', isMobile);
  await page.getByRole('button', { name: 'New meeting' }).click();
  await expect(main.getByLabel('Meeting title')).toHaveValue('Meeting with Prof. Rajan');
  await main.getByRole('button', { name: 'Meeting date' }).click();
  await page.getByRole('button', { name: /^Next week/ }).click();
  const earlier = main.getByRole('list', { name: 'From earlier meetings' });
  await expect(earlier.getByText('Run the grasping baseline')).toBeVisible(); // still open
  await expect(earlier.getByText('Read RT-2')).toBeVisible(); // done, but flagged to follow up

  // Ctrl+K finds the notes.
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('diffusion policy');
  await expect(page.getByRole('option', { name: /Meeting with Prof. Rajan/ })).toBeVisible();
});

test('meetings: open notes from a calendar event', async ({ page }) => {
  await onboard(page);
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'New event' }).click();
  const sheet = page.getByRole('dialog', { name: 'New event' });
  await sheet.getByLabel('Event', { exact: true }).fill('Lab sync');
  await sheet.getByLabel('Repeat').selectOption('weekly');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await page.locator('.fc').getByText('Lab sync').first().click();
  await page.getByRole('button', { name: 'Meeting notes' }).click();
  const main = page.getByRole('main');
  await expect(main.getByLabel('Meeting title')).toHaveValue('Lab sync');
  await expect(main.getByText('(from your calendar)')).toBeVisible();
  const url = page.url();
  // Opening the same occurrence again returns the same meeting.
  await page.goto('/calendar');
  await page.locator('.fc').getByText('Lab sync').first().click();
  await page.getByRole('button', { name: 'Meeting notes' }).click();
  await expect(page).toHaveURL(url);
});

test('people: birthdays come round every year on Today and the calendar', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await openScreen(page, 'People', isMobile);
  await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
  const main = page.getByRole('main');
  await main.getByLabel('New person').fill('Amma');
  await page.keyboard.press('Enter');
  await expect(main.getByRole('columnheader', { name: 'Relation' })).toBeVisible();
  await main.getByLabel('Relation of Amma').selectOption('Family');
  await main.getByRole('button', { name: 'Amma' }).click();
  const sheet = page.getByRole('dialog', { name: 'Amma' });
  // Born years ago; the birthday still shows this year.
  await sheet.getByLabel('Birthday').fill('1970-11-24');
  await sheet.getByRole('button', { name: 'Done' }).click();

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Coming up' }).getByText('Amma · Birthday')).toBeVisible();
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.locator('.fc').getByText('Amma · Birthday')).toBeVisible();
});

test('course: assessments with weights give a grade so far', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'SMAI', isMobile);
  // A course's Assessments list is right on its page.
  const main = page.getByRole('main');
  await main.getByLabel('New assessment').fill('Assignment 1');
  await page.keyboard.press('Enter');
  await main.getByRole('button', { name: 'Assignment 1' }).click();
  const sheet = page.getByRole('dialog', { name: 'Assignment 1' });
  await sheet.getByLabel('Weight %').fill('10');
  await sheet.getByLabel('Score', { exact: true }).fill('8');
  await sheet.getByLabel('Out of').fill('10');
  await sheet.getByLabel('Status').selectOption('Graded');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(main.getByText('So far: 8 of 10 marks graded (80%).')).toBeVisible();
  await expect(main.getByText('Weights add up to 10%, not 100%.')).toBeVisible();
});

test('focus: a session from a task counts as deep work, even across a reload', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await page.goto('/tasks');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Write related work');
  await page.keyboard.press('Enter');
  await main.getByText('Write related work').click();
  await page.getByRole('button', { name: 'Focus 25 min' }).click();
  await expect(page).toHaveURL(/\/focus$/);
  await expect(main.getByRole('timer', { name: 'Time left' })).toHaveText('25:00');
  await expect(main.getByText(/Write related work · until 10:25/)).toBeVisible();

  // The sidebar shows the countdown elsewhere; the session survives a reload.
  await page.clock.runFor(10 * 60_000);
  await page.goto('/');
  // Phones show a floating pill instead.
  const clock = isMobile
    ? page.getByRole('link', { name: /^Focus timer/ })
    : page.getByRole('complementary', { name: 'Main navigation' }).getByRole('link', { name: /Focus/ });
  await expect(clock).toContainText(/15:00|14:[45]\d/); // the clock keeps running while the page loads

  // Time runs out while away: it finishes and is saved.
  // fastForward: jump ahead without also running the toast's own close timer.
  await page.clock.fastForward(16 * 60_000);
  await expect(page.getByText('Focus session done: 25m. Take a short break.')).toBeVisible();
  await page.goto('/focus');
  await expect(main.getByText(/Today\s*25m/)).toBeVisible();
  await expect(main.getByRole('button', { name: 'Write related work' })).toBeVisible();

  // Stop early: only the minutes worked count.
  await main.getByRole('button', { name: 'Start 25 min' }).click();
  await page.clock.runFor(5 * 60_000 + 10_000);
  await main.getByRole('button', { name: 'Stop and save' }).click();
  await expect(page.getByText('Saved 5m of focus')).toBeVisible();
  await expect(main.getByText(/Today\s*30m/)).toBeVisible();
});

test('attachments: add a file to a task, open it, remove it', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Review proposal');
  await page.keyboard.press('Enter');
  await main.getByText('Review proposal').click();
  await page.getByLabel('Attach files').setInputFiles({
    name: 'proposal.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  const files = page.getByRole('region', { name: 'Attachments' });
  await expect(files.getByText('proposal.pdf')).toBeVisible();
  await expect(files.getByText('13 B')).toBeVisible();
  // Still there after a reload.
  await page.reload();
  await page.getByRole('main').getByText('Review proposal').click();
  await expect(files.getByText('proposal.pdf')).toBeVisible();
  const popup = page.waitForEvent('popup');
  await files.getByRole('button', { name: 'proposal.pdf 13 B' }).click();
  // A blob: page, or an empty URL where headless Chromium hands the PDF to its downloader.
  expect((await popup).url()).toMatch(/^(blob:|$)/);
  await files.getByRole('button', { name: 'Remove proposal.pdf' }).click();
  await expect(page.getByText('Moved “proposal.pdf” to Trash')).toBeVisible();
  await expect(files.getByText('proposal.pdf')).toBeHidden();
});
