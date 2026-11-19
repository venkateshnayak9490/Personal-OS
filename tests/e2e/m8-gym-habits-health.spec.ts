import { expect, test } from '@playwright/test';
import { onboard, openScreen, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('Gym habit added in Habits follows the routine; Start and End from Habits survive a reload', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') }); // a Wednesday
  await onboard(page);
  const main = page.getByRole('main');

  // Add Gym in Habits: it follows Gym & Fitness instead of its own weekly count.
  await page.goto('/habits');
  await main.getByRole('button', { name: 'Add Gym' }).click();
  const sheet = page.getByRole('dialog', { name: 'New habit' });
  await expect(sheet.getByLabel(/Follow my Gym & Fitness routine/)).toBeChecked();
  await expect(sheet.getByLabel('How often')).toHaveCount(0);
  await expect(sheet.getByText(/No routine yet/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(sheet).toBeHidden();

  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = main.getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  await page
    .getByRole('dialog', { name: 'Programs' })
    .getByRole('button', { name: 'Use Weekly split, Mon–Sat' })
    .click();
  await expect(gym.getByText('0 of 6 workouts')).toBeVisible();

  // Habits: the days come from the routine; one Gym habit, not two.
  await openScreen(page, 'Habits', isMobile);
  await expect(main.getByText('Mon, Tue, Wed, Thu, Fri, Sat')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Options for Gym' })).toHaveCount(1);

  // Start from Habits: in progress (not done), and still in progress after a reload.
  await main.getByRole('button', { name: 'Start workout: Legs and core' }).click();
  await expect(main.getByText('In progress since 07:30')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Gym, Wednesday 18 Nov: not checked' })).toBeVisible();
  await page.reload();
  await expect(main.getByText('In progress since 07:30')).toBeVisible();

  // End from Habits: done, with the times and duration.
  await page.clock.setFixedTime(new Date('2026-11-18T08:20:00+05:30'));
  await main.getByRole('button', { name: 'End workout' }).click();
  await expect(main.getByRole('link', { name: '07:30–08:20 · 50 min' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Gym, Wednesday 18 Nov: done' })).toBeVisible();

  // Gym & Fitness keeps the history.
  await openSection(page, 'Gym & Fitness', isMobile);
  await expect(gym.getByText('1 of 6 workouts')).toBeVisible();
  await expect(gym.getByRole('link', { name: /Legs and core · 50 min/ })).toBeVisible();

  // Delete it from Recent workouts (asks first): the habit check-in goes too; Undo brings both back.
  await gym.getByRole('button', { name: 'Delete Legs and core, Wed 18 Nov' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(gym.getByText('0 of 6 workouts')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await expect(gym.getByText('1 of 6 workouts')).toBeVisible();
  await gym.getByRole('button', { name: 'Delete Legs and core, Wed 18 Nov' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(gym.getByRole('link', { name: /Legs and core · 50 min/ })).toHaveCount(0);
  await openScreen(page, 'Habits', isMobile);
  await expect(main.getByRole('button', { name: 'Gym, Wednesday 18 Nov: not checked' })).toBeVisible();
});

test('change one week only: the routine stays; Habits and the weekly target follow that week', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') }); // a Wednesday
  await onboard(page);
  const main = page.getByRole('main');
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = main.getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  await page
    .getByRole('dialog', { name: 'Programs' })
    .getByRole('button', { name: 'Use Weekly split, Mon–Sat' })
    .click();

  const week = gym.getByRole('list', { name: 'Weekly schedule' });
  await expect(gym.getByRole('radio', { name: 'One week only' })).toBeChecked();
  // Days already gone can't be changed.
  await expect(week.getByLabel('Mon workout')).toBeDisabled();
  // This week: Friday off.
  await week.getByLabel('Fri workout').selectOption('Rest');
  await expect(week.getByRole('listitem', { name: /Friday: Rest \(changed this week\)/ })).toBeVisible();
  await expect(gym.getByText('0 of 5 workouts')).toBeVisible();

  // The routine and next week are unchanged.
  await gym.getByLabel('Week', { exact: true }).selectOption('Next week');
  await expect(week.getByRole('listitem', { name: 'Friday: Back and biceps (B)' })).toBeVisible();
  await gym.getByRole('radio', { name: 'Every week' }).click();
  await expect(week.getByRole('listitem', { name: 'Friday: Back and biceps (B)' })).toBeVisible();

  // Habits: the card shows this week's actual days and target; Friday isn't due (never missed).
  await openScreen(page, 'Habits', isMobile);
  await expect(main.getByText('Mon, Tue, Wed, Thu, Sat (this week)')).toBeVisible();
  await expect(main.getByText('0/5 this week').first()).toBeAttached(); // the week's target
  await page.clock.setFixedTime(new Date('2026-11-20T09:00:00+05:30'));
  await page.reload();
  await expect(main.getByText('Rest day', { exact: true })).toBeVisible();
  await expect(main.getByText('No workout due')).toBeVisible();

  // Back to the routine for this week.
  await openSection(page, 'Gym & Fitness', isMobile);
  await gym.getByRole('button', { name: 'Back to “Weekly split, Mon–Sat”' }).click();
  await expect(gym.getByText('of 6 workouts')).toBeVisible();
});

test('skip from Habits asks for a reason (editable); routines delete only after confirming', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') });
  await onboard(page);
  const main = page.getByRole('main');
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = main.getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  await page
    .getByRole('dialog', { name: 'Programs' })
    .getByRole('button', { name: 'Use Weekly split, Mon–Sat' })
    .click();
  await expect(gym.getByRole('list', { name: 'Weekly schedule' })).toBeVisible();

  await openScreen(page, 'Habits', isMobile);
  await main.getByRole('button', { name: 'Skip', exact: true }).click();
  let why = page.getByRole('dialog', { name: 'Skip Gym?' });
  await why.getByRole('button', { name: 'Not feeling well' }).click();
  await why.getByRole('button', { name: 'Skip with this reason' }).click();
  await expect(main.getByText('Skipped: Not feeling well')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Gym, Wednesday 18 Nov: skipped' })).toBeVisible();
  await main.getByRole('button', { name: 'Edit reason' }).click();
  why = page.getByRole('dialog', { name: 'Edit reason: Gym' });
  await why.getByLabel('Reason (optional)', { exact: true }).fill('Fever since last night');
  await why.getByRole('button', { name: 'Save reason' }).click();
  await expect(main.getByText('Skipped: Fever since last night')).toBeVisible();

  // Deleting the active routine asks first.
  await openSection(page, 'Gym & Fitness', isMobile);
  await gym.getByRole('button', { name: 'Options for Weekly split, Mon–Sat' }).click();
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('active routine');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(gym.getByRole('list', { name: 'Weekly schedule' })).toBeVisible();
});

test('health: Undo an accidental "I’m up"; a wake-up window counts on time inside it', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T05:40:00+05:30') });
  await onboard(page);
  const main = page.getByRole('main');
  await openSection(page, 'Health', isMobile);

  await main.getByRole('button', { name: 'I’m up' }).click();
  await expect(page.getByText('Woke up at 05:40')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(main.getByRole('button', { name: 'I’m up' })).toBeVisible();
  await expect(main.getByLabel('Woke up at')).toHaveCount(0);

  // A window: wake up between 05:00 and 06:00.
  await main.getByRole('button', { name: 'Set my plan' }).click();
  const plan = page.getByRole('dialog', { name: 'Your daily plan' });
  await plan.getByLabel('Wake up', { exact: true }).fill('05:00');
  await plan.getByLabel('Wake up: until (optional)').fill('04:30');
  await expect(plan.getByText('The wake-up window must end after it starts')).toBeVisible();
  await expect(plan.getByRole('button', { name: 'Save plan' })).toBeDisabled();
  await plan.getByLabel('Wake up: until (optional)').fill('06:00');
  await plan.getByRole('button', { name: 'Save plan' }).click();
  await expect(plan).toBeHidden();
  await expect(main.getByText('Plan 05:00–06:00')).toBeVisible();

  // Tap again (once): logged, on time inside the window, no duplicate check-in.
  await main.getByRole('button', { name: 'I’m up' }).click();
  await expect(main.getByLabel('Woke up at')).toHaveValue('05:40');
  await expect(main.getByText('on time').first()).toBeVisible();
});

test('health: Reset works long after the tap, and on an earlier day', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T07:10:00+05:30') });
  await onboard(page);
  const main = page.getByRole('main');
  await openSection(page, 'Health', isMobile);
  await main.getByRole('button', { name: 'I’m up' }).click();
  await main.getByRole('button', { name: 'Ate breakfast' }).click();
  await expect(main.getByLabel('Woke up at')).toHaveValue('07:10');

  // Hours later (the Undo toast is long gone): Reset, then Undo the reset.
  await page.clock.setFixedTime(new Date('2026-11-18T15:00:00+05:30'));
  await page.reload();
  await main.getByRole('button', { name: 'Reset woke up' }).click();
  await expect(main.getByRole('button', { name: 'I’m up' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(main.getByLabel('Woke up at')).toHaveValue('07:10');
  await main.getByRole('button', { name: 'Reset woke up' }).click();
  await expect(main.getByRole('button', { name: 'I’m up' })).toBeVisible();

  // The next day: pick yesterday and reset its breakfast; today is untouched.
  await page.clock.setFixedTime(new Date('2026-11-19T09:00:00+05:30'));
  await page.reload();
  await main.getByLabel('Day', { exact: true }).fill('2026-11-18');
  await expect(main.getByRole('heading', { name: 'Wednesday 18 Nov' })).toBeVisible();
  await expect(main.getByLabel('Breakfast at')).toHaveValue(/\d\d:\d\d/);
  await main.getByRole('button', { name: 'Reset breakfast' }).click();
  await expect(main.getByLabel('Breakfast at')).toHaveValue('');
  await expect(main.getByRole('button', { name: 'Ate breakfast' })).toHaveCount(0); // past day: a time, not a tap
  await main.getByRole('button', { name: 'Back to today' }).click();
  await expect(main.getByRole('button', { name: 'I’m up' })).toBeVisible();
});
