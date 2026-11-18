import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

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
