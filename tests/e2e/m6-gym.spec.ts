import { expect, test } from '@playwright/test';
import { onboard, openScreen, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test("gym: pick a program for your level, follow today's workout, log lifts and cardio", async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') });
  await onboard(page);
  // A gym habit, so the workout checks it in.
  await page.goto('/habits');
  await page.getByRole('main').getByRole('button', { name: 'Add Gym' }).click();
  await page.getByRole('dialog', { name: 'New habit' }).getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog', { name: 'New habit' })).toBeHidden();

  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = page.getByRole('main').getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  const programs = page.getByRole('dialog', { name: 'Programs' });
  await programs.getByRole('radio', { name: /Intermediate/ }).click();
  const ul = programs.getByRole('listitem').filter({ hasText: 'Upper / Lower, 4 days' });
  await expect(ul.getByText('Recommended for you')).toBeVisible();
  await ul.getByRole('button', { name: 'Use Upper / Lower, 4 days' }).click();

  await expect(gym.getByRole('heading', { name: 'Upper A' })).toBeVisible();
  await gym.getByRole('button', { name: 'Start Upper A' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  const main = page.getByRole('main');
  const bench = main.getByRole('region', { name: 'Bench press' });
  await expect(bench.getByText('0/4 × 6-8')).toBeVisible();
  await bench.getByLabel('Reps').fill('8');
  await bench.getByLabel('kg').fill('60');
  await bench.getByRole('button', { name: 'Log a set of Bench press' }).click();
  await expect(bench.getByText('1/4 × 6-8')).toBeVisible();
  await bench.getByRole('button', { name: 'Log a set of Bench press' }).click(); // same numbers again
  await expect(bench.getByText('2/4 × 6-8')).toBeVisible();

  await main.getByLabel('Activity').fill('Running');
  await main.getByLabel('Minutes').fill('20');
  await main.getByLabel('km (optional)').last().fill('3.5');
  await main.getByRole('button', { name: 'Log cardio' }).click();
  await expect(main.getByText('20 min · 3.5 km')).toBeVisible();
  // Ending the workout completes it (and the Gym habit).
  await expect(main.getByText('Started 07:30')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-18T08:20:00+05:30'));
  await main.getByRole('button', { name: 'End workout' }).click();
  await expect(main.getByText('50 min')).toBeVisible();

  // Back on the section: today is trained, the next day is up, cardio counted.
  await openSection(page, 'Gym & Fitness', isMobile);
  await expect(gym.getByText('Done today. Next up')).toBeVisible();
  await expect(gym.getByRole('heading', { name: 'Lower A' })).toBeVisible();
  await expect(gym.getByRole('listitem', { name: 'Wednesday: trained' })).toBeVisible();
  await expect(gym.getByText('Cardio 20 min · 3.5 km')).toBeVisible();
  await expect(gym.getByText('1 of 4 workouts')).toBeVisible();

  // And the gym habit is checked in for today.
  await page.goto('/habits');
  await expect(
    page.getByRole('main').getByRole('button', { name: 'Gym, Wednesday 18 Nov: done' }),
  ).toBeVisible();
});

test('gym: build your own routine with a cardio day', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = page.getByRole('main').getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Create' }).click();
  const sheet = page.getByRole('dialog', { name: 'New routine' });
  await sheet.getByLabel('Routine').fill('Home and runs');
  await sheet.getByLabel('Day 1 name').fill('Strength');
  await sheet.getByRole('button', { name: 'Exercise' }).click();
  await sheet.getByLabel('Day 1 exercise 1', { exact: true }).fill('Push-ups');
  await sheet.getByRole('button', { name: 'Add a day' }).click();
  await sheet.getByLabel('Day 2 name').fill('Run');
  await sheet.getByRole('button', { name: 'Cardio' }).last().click();
  await sheet.getByLabel('Day 2 exercise 1', { exact: true }).fill('Running');
  await sheet.getByLabel('Day 2 exercise 1 minutes').fill('30');
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(gym.getByRole('heading', { name: 'Strength' })).toBeVisible();
  await expect(gym.getByText('Home and runs')).toHaveCount(2); // hero line and the list
  await gym.getByLabel('Do a different day').selectOption('Run');
  await expect(gym.getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(gym.getByText('Running 30 min')).toBeVisible();
});

test('gym: a weekly split is a habit on those weekdays; skipping needs an honest reason', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') }); // a Wednesday
  await onboard(page);
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = page.getByRole('main').getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  await page
    .getByRole('dialog', { name: 'Programs' })
    .getByRole('button', { name: 'Use Weekly split, Mon–Sat' })
    .click();

  // Wednesday is legs.
  await expect(gym.getByRole('heading', { name: 'Legs and core' })).toBeVisible();
  await expect(gym.getByText(/Weekly split, Mon–Sat · Wed/)).toBeVisible();

  // Skipping asks why.
  await gym.getByRole('button', { name: 'Skip today' }).click();
  const why = page.getByRole('dialog', { name: 'Skip Gym?' });
  // The reason is optional; quick picks are there.
  await expect(why.getByRole('button', { name: 'Skip without a reason' })).toBeEnabled();
  await expect(why.getByRole('button', { name: 'Busy with work/studies' })).toBeVisible();
  await why.getByLabel('Reason (optional)', { exact: true }).fill('Slept 4 hours after the deadline');
  await why.getByRole('button', { name: 'Skip with this reason' }).click();
  await expect(gym.getByText('Skipped today: Slept 4 hours after the deadline')).toBeVisible();

  // The Gym habit follows the split: due Mon–Sat, not Sunday; the reason is in its history.
  await page.goto('/habits');
  const main = page.getByRole('main');
  await expect(main.getByText('Mon, Tue, Wed, Thu, Fri, Sat')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Gym, Wednesday 18 Nov: skipped' })).toBeVisible();
  await main.getByRole('button', { name: 'Options for Gym' }).click();
  await page.getByRole('menuitem', { name: 'History' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Gym' }).getByText('Slept 4 hours after the deadline'),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // Sunday is a rest day.
  await page.clock.setFixedTime(new Date('2026-11-22T09:00:00+05:30'));
  await openSection(page, 'Gym & Fitness', isMobile);
  await expect(gym.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await expect(gym.getByText(/next: Mon, Chest, triceps, shoulders/)).toBeVisible();
});

test('gym week builder: muscles, rest days, copy a day; Habits shows today with Start and Skip', async ({
  page,
  isMobile,
}) => {
  await page.clock.install({ time: new Date('2026-11-16T07:30:00+05:30') }); // a Monday
  await onboard(page);
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = page.getByRole('main').getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Create' }).click();
  const sheet = page.getByRole('dialog', { name: 'New routine' });
  await sheet.getByLabel('Routine').fill('My split');
  await sheet.getByLabel(/Fixed weekdays/).check();
  // The one starting day becomes Monday; the rest of the week shows as rest days.
  const week = sheet.getByRole('list', { name: 'Week' });
  await expect(week.getByText('Rest day')).toHaveCount(6);
  await sheet.getByLabel('Mon workout name').fill('Chest, triceps, shoulders');
  for (const m of ['Chest', 'Triceps', 'Shoulders'])
    await sheet.getByRole('group', { name: 'Mon muscle groups' }).getByRole('button', { name: m }).click();
  await sheet.getByRole('button', { name: 'Add an exercise on Mon' }).click();
  await sheet.getByLabel('Mon exercise 1', { exact: true }).fill('Bench press');
  await sheet.getByLabel('Mon exercise 1 target kg').fill('60');
  await sheet.getByRole('button', { name: 'Add a workout on Sat' }).click();
  await sheet.getByLabel('Sat workout name').fill('Cardio');
  await sheet.getByLabel('Copy Mon to').selectOption({ label: 'Fri' });
  await expect(week.getByText('Rest day')).toHaveCount(4); // Tue, Wed, Thu, Sun
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden(); // saved (the sheet closes once the routine and habit are stored)

  // Habits: the Gym habit follows the plan and shows today's workout.
  await page.goto('/habits');
  const main = page.getByRole('main');
  await expect(main.getByText('Mon, Fri, Sat')).toBeVisible();
  await expect(main.getByText('Mon: Chest, triceps, shoulders')).toBeVisible();
  await expect(main.getByText('Triceps', { exact: true })).toBeVisible();
  await main.getByRole('button', { name: 'Start Chest, triceps, shoulders' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  const bench = page.getByRole('main').getByRole('region', { name: 'Bench press' });
  await expect(bench.getByText('0/3 × 8-12 @ 60 kg')).toBeVisible();
  await expect(bench.getByLabel('kg')).toHaveValue('60'); // target weight pre-filled
  await bench.getByLabel('Reps').fill('8');
  await bench.getByRole('button', { name: 'Log a set of Bench press' }).click();
  await expect(bench.getByText(/^1\/3/)).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'End workout' }).click();
  await expect(page.getByRole('main').getByText('completed')).toBeVisible();
  await openScreen(page, 'Habits', isMobile); // in-app, as you would
  await expect(main.getByRole('button', { name: 'Gym, Monday 16 Nov: done' })).toBeVisible();
  await expect(main.getByText('Done', { exact: true })).toBeVisible();

  // Consistency on the Gym page; pausing stops anything being due.
  await openSection(page, 'Gym & Fitness', isMobile);
  await expect(gym.getByLabel('This week consistency')).toContainText('1 of 1 planned done');
  await gym.getByRole('button', { name: 'Options for My split' }).click();
  await page.getByRole('menuitem', { name: 'Pause' }).click();
  await expect(gym.getByRole('heading', { name: 'Routine paused' })).toBeVisible();
});
