import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('thesis: chapters with word goals, writing logged by word count', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Thesis', isMobile);
  const main = page.getByRole('main');
  const thesis = main.getByRole('region', { name: 'Thesis' });
  for (const c of ['Introduction', 'Related work']) {
    await thesis.getByLabel('New chapter').fill(c);
    await page.keyboard.press('Enter');
  }
  await thesis.getByLabel('Word goal for Introduction').fill('4000');
  await thesis.getByLabel('Word goal for Introduction').blur();
  await expect(thesis.getByText(/0 of 9,000 words/)).toBeVisible();

  await thesis.getByLabel('Chapter to log').selectOption({ label: 'Introduction' });
  await thesis.getByLabel('Word count now').fill('1200');
  await thesis.getByRole('button', { name: 'Log writing' }).click();
  await expect(page.getByText('+1,200 words in Introduction')).toBeVisible();
  await thesis.getByLabel('Word count now').fill('1150');
  await thesis.getByRole('button', { name: 'Log writing' }).click();
  await expect(page.getByText('-50 words in Introduction')).toBeVisible();
  await expect(thesis.getByText(/1,150 of 9,000 words \(13%\) · This week \+1,150/)).toBeVisible();
  await expect(thesis.getByLabel('Status of Introduction')).toHaveValue('drafting');
});

test('workouts: sets, reps and weights, personal records spotted', async ({ page, isMobile }) => {
  await onboard(page);
  await openSection(page, 'Gym & Fitness', isMobile);
  await page.getByRole('button', { name: 'Log a free workout' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  const main = page.getByRole('main');
  await main.getByLabel('Exercise').fill('Bench press');
  for (const [reps, kg] of [
    ['5', '60'],
    ['5', '60'],
    ['3', '65'],
  ]) {
    await main.getByLabel('Reps').fill(reps);
    await main.getByLabel('Weight (kg)').fill(kg);
    await main.getByRole('button', { name: 'Add set' }).click();
  }
  await expect(page.getByText('New personal record: Bench press, 3 × 65 kg')).toBeVisible();
  const bench = main.getByRole('region', { name: 'Bench press' });
  await expect(bench.getByRole('listitem')).toHaveCount(3);
  await expect(bench.getByText('PR', { exact: true })).toHaveCount(1); // the first set ever only sets the baseline

  await openSection(page, 'Gym & Fitness', isMobile);
  const section = main.getByRole('region', { name: 'Gym' });
  await expect(section.getByText('Bench press', { exact: false }).first()).toBeVisible();
  await expect(section.getByText('65 kg')).toBeVisible(); // best lift
});

test('check-in: mood, energy, sleep and water from Home, history on Health', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T09:00:00+05:30') });
  await onboard(page);
  await page.goto('/home');
  const card = page.getByRole('region', { name: 'Check-in' });
  await card.getByRole('radio', { name: 'Good' }).first().click(); // mood
  await card.getByRole('radiogroup', { name: 'Energy' }).getByRole('radio', { name: 'Okay' }).click();
  await card.getByLabel('Sleep last night (hours)').fill('7.5');
  await card.getByLabel('Sleep last night (hours)').blur();
  await card.getByRole('button', { name: 'One more glass' }).click();
  await card.getByRole('button', { name: 'One more glass' }).click();
  await expect(card.getByLabel('Glasses of water')).toHaveText('2');

  // Mood is the journal's mood for the day.
  await page.goto('/journal');
  await expect(page.getByRole('main').getByRole('radio', { name: 'Good' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await openSection(page, 'Health', isMobile);
  // The week's grid: one row per measure, one column per day.
  const week = page.getByRole('region', { name: 'Check-ins by week' });
  await expect(week.getByRole('row', { name: /^Mood/ })).toContainText('Good');
  await expect(week.getByRole('row', { name: /^Energy/ })).toContainText('Okay');
  await expect(week.getByRole('row', { name: /^Sleep/ })).toContainText('7.5h');
  await expect(week.getByText(/Week average: sleep 7\.5 h, energy 3\.0 \/ 5, mood 4\.0 \/ 5/)).toBeVisible();
});
