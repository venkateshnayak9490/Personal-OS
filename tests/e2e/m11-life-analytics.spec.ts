import { expect, test } from '@playwright/test';
import { onboard, openScreen, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('Analytics shows Gym and Health for the period, with links to them', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T07:30:00+05:30') }); // a Wednesday
  await onboard(page);
  const main = page.getByRole('main');

  // A workout: started 07:30, ended 08:20.
  await openSection(page, 'Gym & Fitness', isMobile);
  const gym = main.getByRole('region', { name: 'Gym' });
  await gym.getByRole('button', { name: 'Choose a routine' }).click();
  await page
    .getByRole('dialog', { name: 'Programs' })
    .getByRole('button', { name: 'Use Weekly split, Mon–Sat' })
    .click();
  await gym.getByRole('button', { name: 'Start Legs and core' }).click();
  await expect(page).toHaveURL(/\/workouts\//);
  await page.clock.setFixedTime(new Date('2026-11-18T08:20:00+05:30'));
  await main.getByRole('button', { name: 'End workout' }).click();
  await expect(main.getByText('50 min')).toBeVisible();

  // Health: a plan, and up at 08:20 (late against 07:00).
  await openSection(page, 'Health', isMobile);
  await main.getByRole('button', { name: 'Set my plan' }).click();
  await page
    .getByRole('dialog', { name: 'Your daily plan' })
    .getByRole('button', { name: 'Save plan' })
    .click();
  await main.getByRole('button', { name: 'I’m up' }).click();
  await expect(main.getByLabel('Woke up at')).toHaveValue('08:20');

  await openScreen(page, 'Analytics', isMobile);
  const g = main.getByRole('region', { name: 'Gym analytics' });
  await expect(g.getByText('Workouts', { exact: true })).toBeVisible();
  await expect(g).toContainText('Workouts1');
  // Mon and Tue came before the routine and habit existed: not missed.
  await expect(g).toContainText('Planned days done100%');
  await expect(g).toContainText('1 of 1 · 0 skipped · 0 missed');
  await expect(g.getByRole('img')).toHaveAttribute('aria-label', /Wed 18 Nov: 1/);
  const h = main.getByRole('region', { name: 'Health analytics' });
  await expect(h).toContainText('Up on time0%');
  await expect(h).toContainText('1 logged');
  // Nothing written yet: no Thesis card.
  await expect(main.getByRole('region', { name: 'Thesis analytics' })).toHaveCount(0);
  await g.getByRole('link', { name: 'Open Gym' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gym & Fitness' })).toBeVisible();
});
