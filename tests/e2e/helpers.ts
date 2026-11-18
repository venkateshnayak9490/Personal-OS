import { expect, type Page } from '@playwright/test';

/** First run as a researcher, then add a research area and a course from the setup checklist. */
export async function onboard(page: Page, name = 'Venkatesh') {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel(/What should we call you/).fill(name);
  await page.getByRole('button', { name: /Researcher/ }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();

  const setup = page.getByRole('region', { name: 'Finish setting up' });
  await setup.getByLabel(/e\.g\. Physical AI/).fill('Physical AI');
  await setup.getByRole('button', { name: 'Add', exact: true }).click();
  await setup.getByLabel('e.g. SMAI').fill('SMAI');
  await setup.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(setup.getByText(/^2 of/)).toBeVisible();
}

/** A section on the Home map: its name, then its open-task count if any ("Work 3 open", "Thesis 2"). */
export const sectionLink = (title: string) =>
  new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+( open)?)?$`);

/** Open a section page by its title (desktop sidebar; on phones, the map on Home). */
export async function openSection(page: Page, title: string, isMobile: boolean) {
  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Home' })
      .click();
    await page
      .getByRole('region', { name: 'Your sections' })
      .getByRole('link', { name: sectionLink(title) })
      .click();
  } else {
    const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
    const link = sidebar.getByRole('link', { name: title, exact: true });
    if (!(await link.isVisible())) {
      // Expand parents until the link shows up.
      // Each click turns that button into "Collapse …", so always take the first one left.
      const expand = sidebar.getByRole('button', { name: /^Expand / }).first();
      while (!(await link.isVisible()) && (await expand.count())) await expand.click();
    }
    await link.click();
  }
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

/** Open a built screen in-app (no reload): sidebar on desktop, More tab on phones. */
export async function openScreen(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'More' })
      .click();
    await page.getByRole('main').getByRole('link', { name, exact: true }).click();
  } else {
    await page
      .getByRole('complementary', { name: 'Main navigation' })
      .getByRole('link', { name, exact: true })
      .click();
  }
}

/** Section page ⚙ → "Add a list here" → pick a template. */
export async function addList(page: Page, template: RegExp) {
  await page.getByRole('button', { name: 'Section options' }).click();
  await page.getByRole('menuitem', { name: 'Add a list here' }).click();
  await page.getByRole('dialog', { name: 'New list' }).getByRole('button', { name: template }).click();
}

export const VAULT_PASS = 'lamp river cactus spoon';

/** Set up the Vault through the UI; returns the recovery key shown. */
export async function setupVault(page: Page) {
  await page.goto('/vault');
  const main = page.getByRole('main');
  await main.getByLabel('Passphrase', { exact: true }).fill(VAULT_PASS);
  await main.getByLabel('Type it again').fill(VAULT_PASS);
  await main.getByRole('button', { name: 'Create Vault' }).click();
  const recovery = (await main
    .getByLabel('Recovery key', { exact: true })
    .textContent({ timeout: 15_000 }))!.trim();
  await main.getByLabel('I’ve saved my recovery key').check();
  await main.getByRole('button', { name: 'Open the Vault' }).click();
  await expect(main.getByRole('button', { name: 'New item' })).toBeVisible();
  return recovery;
}
