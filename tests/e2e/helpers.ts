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

/** Open a section page by its title (works on desktop sidebar and mobile Sections tab). */
export async function openSection(page: Page, title: string, isMobile: boolean) {
  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Sections' })
      .click();
    await page.getByRole('main').getByRole('link', { name: title, exact: true }).click();
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
