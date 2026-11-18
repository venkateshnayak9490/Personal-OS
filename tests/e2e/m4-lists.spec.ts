import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { onboard, openSection } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

test('papers: import by arXiv link or DOI, then export BibTeX', async ({ page, isMobile }) => {
  // The lookup services are mocked: tests never depend on the internet.
  await page.route('https://api.datacite.org/**', (r) =>
    r.fulfill({
      json: {
        data: {
          attributes: {
            doi: '10.48550/arXiv.2303.04137',
            titles: [{ title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion' }],
            creators: [{ name: 'Chi, Cheng', givenName: 'Cheng', familyName: 'Chi' }],
            publicationYear: 2023,
            publisher: 'arXiv',
            url: 'https://arxiv.org/abs/2303.04137',
            descriptions: [
              { description: 'This paper introduces Diffusion Policy.', descriptionType: 'Abstract' },
            ],
          },
        },
      },
    }),
  );
  await page.route('https://api.crossref.org/**', (r) =>
    r.request().url().includes('10.9999')
      ? r.fulfill({ status: 404, body: '' })
      : r.fulfill({
          json: {
            message: {
              DOI: '10.1145/3292500.3330701',
              title: ['Optuna'],
              author: [{ given: 'Takuya', family: 'Akiba' }],
              'container-title': ['KDD'],
              issued: { 'date-parts': [[2019, 7, 25]] },
            },
          },
        }),
  );
  await onboard(page);
  await openSection(page, 'Research', isMobile);
  const main = page.getByRole('main');
  const box = main.getByLabel('New paper');
  // The first paper (pasted as a link) starts Research's Papers list.
  await box.fill('https://arxiv.org/abs/2303.04137v2');
  await main.getByRole('button', { name: 'Import' }).click();
  await main.getByRole('tab', { name: 'Table' }).click();
  await expect(main.getByRole('row', { name: /Diffusion Policy.*Cheng Chi.*2023.*arXiv/ })).toBeVisible();

  await box.fill('10.1145/3292500.3330701');
  await page.keyboard.press('Enter');
  await expect(main.getByRole('row', { name: /Optuna.*Takuya Akiba.*2019.*KDD/ })).toBeVisible();

  // Same paper again, and a DOI that doesn't exist.
  await box.fill('arXiv:2303.04137');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/is already in Papers/)).toBeVisible();
  await box.fill('10.9999/nope');
  await page.keyboard.press('Enter');
  await expect(page.getByText('No paper with that DOI.')).toBeVisible();

  // A plain title is still just added.
  await box.fill('RT-2');
  await expect(main.getByRole('button', { name: 'Add', exact: true })).toBeVisible();

  await main.getByRole('button', { name: 'List options' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export BibTeX' }).click();
  const file = await (await dl).path();
  const bib = await readFile(file!, 'utf-8');
  expect(bib).toContain('@article{Chi2023diffusion,');
  expect(bib).toContain('doi = {10.1145/3292500.3330701}');
});

test('life lists: templates for personal sections, expenses add up', async ({ page, isMobile }) => {
  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });
  await onboard(page);
  await openSection(page, 'Expenses', isMobile);
  // Expenses has its list right on the page, and no task box.
  const main = page.getByRole('main');
  await expect(main.getByLabel('New task title')).toHaveCount(0);
  for (const [what, amount, cat] of [
    ['Groceries', '850', 'Food'],
    ['Metro card', '300', 'Transport'],
    ['Lunch', '150', 'Food'],
  ]) {
    await main.getByLabel('New expense').fill(what!);
    await page.keyboard.press('Enter');
    await main.getByRole('button', { name: what! }).click();
    const sheet = page.getByRole('dialog', { name: what! });
    await sheet.getByLabel('Amount').fill(amount!);
    await sheet.getByLabel('Category').selectOption(cat!);
    await sheet.getByRole('button', { name: 'Date' }).click();
    await page.getByRole('button', { name: /^Today/ }).click();
    await sheet.getByRole('button', { name: 'Done' }).click();
  }
  await expect(main.getByText('This month: 1,300 · Food 1,000 · Transport 300')).toBeVisible();
});

test('calendar file: .ics with events, tasks and reminders', async ({ page }) => {
  await onboard(page);
  await page.goto('/tasks');
  const main = page.getByRole('main');
  await main.getByLabel('New task title').fill('Submit SMAI assignment fri 5pm');
  await page.keyboard.press('Enter');
  await expect(main.getByText('Submit SMAI assignment')).toBeVisible(); // saved before leaving
  await page.goto('/settings');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .ics' }).click();
  const d = await dl;
  expect(d.suggestedFilename()).toBe('personal-os.ics');
  const ics = await readFile((await d.path())!, 'utf-8');
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(ics).toContain('SUMMARY:☐ Submit SMAI assignment');
  expect(ics).toContain('TRIGGER:-PT0M');
});
