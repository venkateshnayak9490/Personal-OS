import { expect, test, type Page } from '@playwright/test';
import { onboard, setupVault, VAULT_PASS } from './helpers';

test.use({ timezoneId: 'Asia/Kolkata' });

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Main navigation' });

test('every working screen is in the sidebar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  for (const name of [
    'Today',
    'Calendar',
    'People',
    'Focus',
    'Reviews',
    'Analytics',
    'Notes',
    'Journal',
    'Vault',
  ])
    await expect(sidebar(page).getByRole('link', { name, exact: true })).toBeVisible();
});

test('vault: set up, encrypted item with a file, lock, unlock, recover', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  test.setTimeout(60_000); // Argon2id is slow on purpose
  await onboard(page);
  const recovery = await setupVault(page);
  expect(recovery).toMatch(/^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
  const main = page.getByRole('main');

  await main.getByRole('button', { name: 'New item' }).click();
  await main.getByLabel('Item title').fill('Passport');
  await main.getByLabel('Item text').fill('N1234567, expires 2031');
  await main.getByLabel('Item title').click(); // blur saves the text
  await main.getByLabel('Add encrypted files').setInputFiles({
    name: 'passport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF scan'),
  });
  await expect(main.getByText('passport.pdf')).toBeVisible();

  // Nothing readable in the database.
  const stored = await page.evaluate(
    () =>
      new Promise<string>((res) => {
        const r = indexedDB.open('personal-os');
        r.onsuccess = () => {
          const q = r.result.transaction('vaultItems').objectStore('vaultItems').getAll();
          q.onsuccess = () => res(JSON.stringify(q.result));
        };
      }),
  );
  expect(stored).not.toContain('N1234567');
  expect(stored).not.toContain('Passport');

  await page.getByRole('button', { name: 'Lock' }).click();
  await main.getByLabel('Vault passphrase').fill('not the passphrase');
  await main.getByRole('button', { name: 'Unlock' }).click();
  await expect(main.getByText('That passphrase didn’t work.')).toBeVisible({ timeout: 15_000 });
  await main.getByLabel('Vault passphrase').fill(VAULT_PASS);
  await main.getByRole('button', { name: 'Unlock' }).click();
  await main.getByRole('button', { name: /Passport/ }).click();
  await expect(main.getByLabel('Item text')).toHaveValue('N1234567, expires 2031');

  // A reload locks it (the key lives only in memory). Forgot the passphrase: recovery key.
  await page.reload();
  await main.getByRole('button', { name: 'Forgot the passphrase?' }).click();
  await main.getByLabel('Recovery key').fill(recovery.toLowerCase());
  await main.getByLabel('New passphrase').fill('a whole new passphrase');
  await main.getByRole('button', { name: 'Set new passphrase' }).click();
  await expect(main.getByRole('button', { name: /Passport/ })).toBeVisible({ timeout: 15_000 });
});

test('private journal entries are encrypted and locked with the Vault', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  test.setTimeout(60_000);
  await page.clock.install({ time: new Date('2026-11-18T21:00:00+05:30') });
  await onboard(page);
  await page.goto('/journal');
  const main = page.getByRole('main');

  // Without a Vault, Private explains what's needed.
  await main.getByLabel('Private').click();
  await expect(main.getByText('Private entries are encrypted with your Vault.')).toBeVisible();
  await expect(main.getByLabel('Private')).not.toBeChecked();

  await setupVault(page);
  await sidebar(page).getByRole('link', { name: 'Journal' }).click();
  await main.getByRole('textbox', { name: 'Journal entry' }).click();
  await page.keyboard.type('Thinking about switching labs.');
  await main.getByLabel('Private').click();
  await expect(main.getByLabel('Private')).toBeChecked();

  const stored = await page.evaluate(
    () =>
      new Promise<string>((res) => {
        const r = indexedDB.open('personal-os');
        r.onsuccess = () => {
          const t = r.result.transaction(['journalEntries', 'activityLog']);
          const a = t.objectStore('journalEntries').getAll();
          const b = t.objectStore('activityLog').getAll();
          t.oncomplete = () => res(JSON.stringify([a.result, b.result]));
        };
      }),
  );
  expect(stored).not.toContain('switching labs');

  await page.reload();
  await expect(main.getByText('This entry is private. Unlock the Vault to read and write it.')).toBeVisible();
  await expect(main.getByRole('textbox', { name: 'Journal entry' })).toHaveCount(0);
  await main.getByLabel('Vault passphrase').fill(VAULT_PASS);
  await main.getByRole('button', { name: 'Unlock' }).click();
  await expect(main.getByRole('textbox', { name: 'Journal entry' })).toContainText('switching labs', {
    timeout: 15_000,
  });
});

test('app PIN: asked on open, wrong PIN refused, turned off with the PIN', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop first.');
  await onboard(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Set a PIN' }).click();
  await page.getByLabel('New PIN').fill('4821');
  await page.getByLabel('PIN again').fill('4821');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByText(/PIN set/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Personal OS is locked' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByLabel('PIN').fill('1111');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Wrong PIN.')).toBeVisible();
  await page.getByLabel('PIN').fill('4821');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Turn off' }).first().click();
  await page.getByLabel('Current PIN').fill('4821');
  await page.getByRole('button', { name: 'Turn off' }).last().click();
  await expect(page.getByText('App lock turned off')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
