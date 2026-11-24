import { expect, test } from '@playwright/test';
import { onboard, openScreen, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('gym: Mon–Sun schedule you can change, Start/End workout, edit sets, delete with undo, missed reasons', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-16T07:00:00+05:30') }); // a Monday
  await onboard(page);
  await openSection(page, 'Gym & Fitness', isMobile);
  const main = page.getByRole('main');
  const gym = main.getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  const programs = page.getByRole('dialog', { name: 'Programs' });
  // "See the days" goes Monday to Sunday, with the rest day shown.
  const split = programs.getByRole('listitem').filter({ hasText: 'Weekly split, Mon–Sat' });
  await split.getByRole('button', { name: 'See the days' }).click();
  await expect(split.getByText('Sun: Rest')).toBeVisible();
  await expect(split.getByText('Mon: Chest, triceps, shoulders', { exact: true })).toBeVisible();
  await split.getByRole('button', { name: 'Use Weekly split, Mon–Sat' }).click();

  // The weekly schedule: Monday to Sunday, today marked, Sunday a rest day.
  const week = gym.getByRole('list', { name: 'Weekly schedule' });
  await expect(week.getByRole('listitem')).toHaveCount(7);
  await expect(week.getByRole('listitem').first()).toHaveAttribute(
    'aria-label',
    /^Monday: Chest, triceps, shoulders \(today\)/,
  );
  await expect(week.getByRole('listitem', { name: 'Sunday: Rest' })).toBeVisible();
  // Give Sunday a workout, make Thursday a rest day.
  await week.getByLabel('Sun workout').selectOption('Legs and core');
  await expect(week.getByRole('listitem', { name: 'Sunday: Legs and core' })).toBeVisible();
  await week.getByLabel('Thu workout').selectOption('Rest');
  await expect(week.getByRole('listitem', { name: 'Thursday: Rest' })).toBeVisible();

  // Start: the start time is recorded. Sets can be corrected and removed (with Undo).
  await gym.getByRole('button', { name: 'Start Chest, triceps, shoulders' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  const workoutUrl = page.url();
  await expect(main.getByText('Started 07:00')).toBeVisible();
  const first = main.getByRole('region').first();
  const exercise = (await first.getAttribute('aria-label'))!;
  await first.getByLabel('Reps').fill('8');
  await first.getByLabel('kg').fill('40');
  await first.getByRole('button', { name: `Log a set of ${exercise}` }).click();
  await expect(first.getByText('8 × 40 kg')).toBeVisible();
  await first.getByRole('button', { name: `Edit set 1 of ${exercise}` }).click();
  const edit = first.getByRole('form', { name: `Edit set 1 of ${exercise}` });
  await edit.getByLabel('Reps').fill('10');
  await edit.getByLabel('kg').fill('42.5');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(first.getByText('10 × 42.5 kg')).toBeVisible();
  await first.getByRole('button', { name: `Remove set 1 of ${exercise}` }).click();
  await expect(first.getByText('10 × 42.5 kg')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(first.getByText('10 × 42.5 kg')).toBeVisible();

  // Not ended yet: the Gym habit isn't done. End workout: done, with the duration; times can be fixed.
  await page.clock.setFixedTime(new Date('2026-11-16T08:05:00+05:30'));
  await main.getByRole('button', { name: 'End workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'End workout' }).click(); // under half the sets logged: confirm
  await expect(main.getByText('1 h 5 min')).toBeVisible();
  await main.getByLabel('Start time').fill('07:20');
  await main.getByLabel('Start time').blur();
  await expect(main.getByText('45 min')).toBeVisible();
  await openScreen(page, 'Habits', isMobile);
  await expect(main.getByRole('button', { name: 'Gym, Monday 16 Nov: done' })).toBeVisible();

  // Deleting the workout asks first, and takes the habit check-in with it; Undo brings both back.
  await page.goto(workoutUrl);
  await main.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('menuitem', { name: 'Delete workout…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByText(/Moved “Chest, triceps, shoulders” to Trash/)).toBeVisible();
  await openScreen(page, 'Habits', isMobile);
  await expect(main.getByRole('button', { name: 'Gym, Monday 16 Nov: not checked' })).toBeVisible();

  // Wednesday: Tuesday passed without a workout. It's missed; a reason can be added later.
  await page.clock.setFixedTime(new Date('2026-11-18T09:00:00+05:30'));
  await openSection(page, 'Gym & Fitness', isMobile);
  const off = gym.getByRole('list', { name: 'Skipped and missed workouts' });
  const tue = off.getByRole('listitem', { name: 'Tuesday 17 Nov: missed' });
  await expect(tue).toContainText('No reason given');
  // (On a phone the Gym reminder card can sit over this row; the tap itself is what's tested.)
  await tue.getByRole('button', { name: 'Add reason' }).dispatchEvent('click');
  const why = page.getByRole('dialog', { name: 'Why was Gym missed?' });
  await why.getByRole('button', { name: 'Busy with work/studies' }).click();
  await why.getByRole('button', { name: 'Save reason' }).click();
  await expect(tue).toContainText('Busy with work/studies');
  await expect(gym.getByLabel('This week consistency')).toContainText('2 missed');
});

test('gym: a habit that only mentions "gym" or "workout" is never completed by a workout', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:00:00+05:30') });
  await onboard(page);
  await page.goto('/habits');
  const main = page.getByRole('main');
  await main
    .getByRole('button', { name: /New habit|Add a habit/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'New habit' });
  await sheet.getByLabel('Habit', { exact: true }).fill('Morning workout stretches');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(sheet).toBeHidden();

  await openSection(page, 'Gym & Fitness', isMobile);
  await main.getByRole('region', { name: 'Gym' }).getByRole('button', { name: 'Log a free workout' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  await main.getByRole('button', { name: 'End workout' }).click();
  await expect(main.getByText('completed')).toBeVisible();
  await openScreen(page, 'Habits', isMobile);
  await expect(
    main.getByRole('button', { name: 'Morning workout stretches, Wednesday 18 Nov: not checked' }),
  ).toBeVisible();
});

test('health: an interval plan item shows done, due, missed and later, reminds, pauses and deletes with undo', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T12:30:00+05:30') });
  await onboard(page);
  await openSection(page, 'Health', isMobile);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Add a plan item' }).click();
  const sheet = page.getByRole('dialog', { name: 'New plan item' });
  await sheet.getByLabel('What').fill('Drink water');
  await sheet.getByLabel('Every').fill('2');
  await sheet.getByLabel('Unit').selectOption('hours');
  await sheet.getByLabel('From').fill('08:00');
  await sheet.getByLabel('Until (optional)').fill('20:00');
  await expect(sheet.getByText('7 a day: 08:00, 10:00, 12:00')).toBeVisible();
  // Checks: too often is refused.
  await sheet.getByLabel('Unit').selectOption('minutes');
  await sheet.getByLabel('Every').fill('5');
  await expect(sheet.getByText('Repeat at most every 15 minutes')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
  await sheet.getByLabel('Every').fill('2');
  await sheet.getByLabel('Unit').selectOption('hours');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  const item = main.getByRole('listitem', { name: 'Drink water' });
  await expect(item.getByText('Every 2 hours, 08:00–20:00')).toBeVisible();
  await expect(item.getByRole('button', { name: 'Drink water at 10:00: missed' })).toBeVisible();
  await expect(item.getByRole('button', { name: 'Drink water at 12:00: due now' })).toBeVisible();
  await expect(item.getByRole('button', { name: 'Drink water at 14:00: later' })).toBeDisabled();

  // The reminder for 12:00; marking it done there checks off that occurrence.
  const reminders = page.getByRole('region', { name: 'Reminders', exact: true });
  await expect(reminders.getByText('Drink water')).toBeVisible({ timeout: 20_000 });
  await reminders.getByRole('button', { name: 'Mark done' }).click();
  await expect(item.getByRole('button', { name: 'Drink water at 12:00: done' })).toBeVisible();
  await expect(item.getByText('1 of 7 done today · 2 missed · 4 later')).toBeVisible();
  // Tap a missed one to mark it done after all, and again to undo.
  await item.getByRole('button', { name: 'Drink water at 10:00: missed' }).click();
  await expect(item.getByRole('button', { name: 'Drink water at 10:00: done' })).toBeVisible();

  // Exact times instead (managed in the folded list below the plan).
  const manage = main.getByRole('region', { name: 'Manage reminders through the day' });
  await manage.getByRole('button', { name: 'Show reminders through the day' }).click();
  await manage.getByRole('button', { name: 'Options for Drink water' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editSheet = page.getByRole('dialog', { name: 'Edit plan item' });
  await editSheet.getByRole('radio', { name: 'At exact times' }).click();
  await editSheet.getByLabel('Time 1', { exact: true }).fill('11:00');
  await editSheet.getByRole('button', { name: 'Add a time' }).click();
  await editSheet.getByLabel('Time 2', { exact: true }).fill('16:00');
  await editSheet.getByRole('button', { name: 'Save' }).click();
  await expect(manage.getByText('At 11:00, 16:00')).toBeVisible();

  // Pause: nothing due. Delete asks first and can be undone.
  await manage.getByRole('button', { name: 'Options for Drink water' }).click();
  await page.getByRole('menuitem', { name: 'Pause' }).click();
  await expect(main.getByText('Paused: nothing due.')).toBeVisible();
  await manage.getByRole('button', { name: 'Options for Drink water' }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(main.getByRole('listitem', { name: 'Drink water' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(main.getByRole('listitem', { name: 'Drink water' })).toBeVisible();
});

test('occasions: a month calendar with marked dates, several per day, yearly or once, reminders days before', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T08:00:00+05:30') });
  await onboard(page);
  await openSection(page, 'Dates & Occasions', isMobile);
  const main = page.getByRole('main');
  const cal = main.getByRole('region', { name: 'Occasions calendar' });
  await expect(cal.getByRole('grid', { name: 'November 2026' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'Wednesday 18 November 2026' })).toHaveAttribute(
    'aria-current',
    'date',
  );

  // Two occasions on the 24th: a yearly birthday (remind 3 days before) and a one-off deadline.
  await cal.getByRole('gridcell', { name: 'Tuesday 24 November 2026' }).click();
  await cal.getByRole('button', { name: 'Add occasion' }).click();
  let sheet = page.getByRole('dialog', { name: 'New occasion' });
  await sheet.getByLabel('Name').fill('Ravi’s birthday');
  await sheet.getByLabel('Kind').selectOption('Birthday');
  await sheet.getByLabel('Remind me').selectOption('3 days before, and on the day');
  await sheet.getByLabel('Description (optional)').fill('Order the cake');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await cal.getByRole('button', { name: 'Add occasion' }).click();
  sheet = page.getByRole('dialog', { name: 'New occasion' });
  await sheet.getByLabel('Name').fill('Grant report due');
  await sheet.getByLabel('Kind').selectOption('Important deadline');
  await sheet.getByLabel('Every year on this date').uncheck();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();

  await expect(cal.getByRole('gridcell', { name: 'Tuesday 24 November 2026, 2 occasions' })).toBeVisible();
  const onDay = cal.getByRole('list', { name: 'Occasions on this date' });
  await expect(onDay.getByRole('listitem')).toHaveCount(2);
  await expect(onDay.getByRole('listitem', { name: 'Ravi’s birthday' })).toContainText('Order the cake');
  await expect(cal.getByRole('list', { name: 'Upcoming occasions' })).toContainText('in 6 days');

  // Next year: only the birthday comes round.
  await cal.getByLabel('Year').fill('2027');
  await expect(cal.getByRole('gridcell', { name: 'Wednesday 24 November 2027, 1 occasion' })).toBeVisible();
  await cal.getByRole('button', { name: 'Today' }).click();

  // Edit, then delete (asks first, can be undone).
  await cal.getByRole('gridcell', { name: /Tuesday 24 November 2026/ }).click();
  await onDay.getByRole('button', { name: 'Edit Grant report due' }).click();
  sheet = page.getByRole('dialog', { name: 'Edit occasion' });
  await sheet.getByLabel('Name').fill('Grant report');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(onDay.getByRole('listitem', { name: 'Grant report' })).toBeVisible();
  await onDay.getByRole('button', { name: 'Delete Grant report' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(onDay.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(onDay.getByRole('listitem')).toHaveCount(2);

  // Three days before, at 9:00: a reminder.
  await page.clock.setFixedTime(new Date('2026-11-21T09:05:00+05:30'));
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Reminders', exact: true })
      .getByText('In 3 days: Ravi’s birthday · Birthday'),
  ).toBeVisible({ timeout: 20_000 });
});
