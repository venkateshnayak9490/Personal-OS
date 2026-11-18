// Captures real screenshots of the running app for the UI/UX handover.
// Sample data is entered through the UI (no direct database writes). Any step that fails is
// recorded in uiux-screenshots/<viewport>-missing.json instead of stopping the run.
import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { onboard, sectionLink } from '../../tests/e2e/helpers';

const ROOT = new URL('../uiux-screenshots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

test('capture', async ({ page, isMobile }) => {
  const vp = isMobile ? 'mobile' : 'desktop';
  const missing: string[] = [];
  const dir = (sub: string) => {
    const d = `${ROOT}${sub}`;
    mkdirSync(d, { recursive: true });
    return d;
  };
  const settle = () => page.waitForTimeout(700);
  const shot = async (sub: string, name: string, full = true) => {
    await settle();
    await page.screenshot({ path: `${dir(sub)}/${name}.png`, fullPage: full });
  };
  const soft = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      missing.push(`${label}: ${String(e).split('\n')[0]}`);
      await page.keyboard.press('Escape').catch(() => {});
    }
  };
  const main = page.getByRole('main');
  const sectionUrls = new Map<string, string>();
  const openSection = async (title: string) => {
    if (!sectionUrls.has(title)) {
      await page.goto('/home');
      await page
        .getByRole('region', { name: 'Your sections' })
        .getByRole('link', { name: sectionLink(title) })
        .click();
      await page.getByRole('heading', { level: 1, name: title }).waitFor();
      sectionUrls.set(title, page.url());
    } else await page.goto(sectionUrls.get(title)!);
    await page.getByRole('heading', { level: 1, name: title }).waitFor();
  };
  const sheetDone = async () => {
    const d = page.getByRole('dialog').last();
    if (await d.isVisible()) await page.keyboard.press('Escape');
  };

  await page.clock.install({ time: new Date('2026-11-18T10:00:00+05:30') });

  /* ---------- First run ---------- */
  await page.goto('/');
  await page.waitForURL(/welcome/);
  await shot(`${vp}/onboarding`, 'welcome');
  await onboard(page);
  await shot(`${vp}/dashboard`, 'today-first-run-setup-checklist');

  /* ---------- Sample data (through the UI) ---------- */
  await soft('seed tasks', async () => {
    await page.goto('/tasks');
    for (const t of [
      'Email Prof. Rajan about the draft today !high',
      'Read RT-2 paper tomorrow',
      'SMAI assignment 2 friday 5pm',
      'Renew library card next week',
      'Prepare lab meeting slides today',
    ]) {
      await main.getByLabel('New task title').fill(t);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
    }
  });
  await soft('seed habits', async () => {
    await page.goto('/habits');
    for (const h of ['Gym', 'DSA practice', 'Read a research paper']) {
      await main.getByRole('button', { name: `Add ${h}` }).click();
      await page.getByRole('dialog', { name: 'New habit' }).getByRole('button', { name: 'Create' }).click();
      await page.waitForTimeout(300);
    }
    for (const label of [
      'DSA practice, Monday 16 Nov',
      'DSA practice, Tuesday 17 Nov',
      'Gym, Monday 16 Nov',
      'Read a research paper, Wednesday 18 Nov',
    ])
      await main.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  });
  await soft('seed goal', async () => {
    await page.goto('/goals');
    await main.getByRole('button', { name: 'Add goal 150 days of DSA practice' }).click();
    await page.getByRole('dialog', { name: 'New goal' }).getByRole('button', { name: 'Create' }).click();
  });
  await soft('seed papers', async () => {
    await openSection('Research');
    for (const t of ['RT-2: Vision-Language-Action Models', 'Diffusion Policy']) {
      await main.getByLabel('New paper').fill(t);
      await page.keyboard.press('Enter');
      await main.getByRole('button', { name: t }).first().waitFor();
    }
  });
  await soft('seed meeting', async () => {
    await openSection('Adviser Meetings');
    await page.getByRole('button', { name: 'New meeting' }).click();
    await main.getByLabel('Meeting title').fill('Weekly sync with Prof. Rajan');
    await main.getByLabel('New action item').fill('Run the grasping baseline');
    await page.keyboard.press('Enter');
    await settle();
    sectionUrls.set('meeting-page', page.url());
  });
  await soft('seed gym', async () => {
    await openSection('Gym & Fitness');
    const gym = main.getByRole('region', { name: 'Gym' });
    await gym.getByRole('button', { name: 'Choose a routine' }).click();
    const p = page.getByRole('dialog', { name: 'Programs' });
    await p.getByRole('radio', { name: /Intermediate/ }).click();
    await p.getByRole('button', { name: 'Use Upper / Lower, 4 days' }).click();
    await gym.getByRole('button', { name: 'Start Upper A' }).click();
    const bench = main.getByRole('region', { name: 'Bench press' });
    await bench.getByLabel('Reps').fill('8');
    await bench.getByLabel('kg').fill('60');
    await bench.getByRole('button', { name: 'Log a set of Bench press' }).click();
    await settle();
    sectionUrls.set('workout-page', page.url());
  });
  await soft('seed health', async () => {
    await openSection('Health');
    const h = main.getByRole('region', { name: 'Health' });
    await h.getByRole('button', { name: 'Set my plan' }).click();
    await page
      .getByRole('dialog', { name: 'Your daily plan' })
      .getByRole('button', { name: 'Save plan' })
      .click();
    const today = h.getByRole('list', { name: 'Today’s plan' });
    await today.getByLabel('Woke up at').fill('07:10');
    await today.getByLabel('Went to bed at').fill('23:30');
    await today.getByRole('button', { name: 'Ate breakfast' }).click();
    await today.getByRole('button', { name: 'Had a glass of water' }).click();
    await today.getByRole('button', { name: 'Had a glass of water' }).click();
  });
  await soft('seed movies', async () => {
    await openSection('Movies & Series');
    for (const t of ['Interstellar', 'Dune: Part Two', 'Shogun']) {
      await main.getByLabel('New title').fill(t);
      await page.keyboard.press('Enter');
      await main.getByRole('button', { name: t }).waitFor();
    }
  });
  await soft('seed occasion', async () => {
    await openSection('Dates & Occasions');
    await main.getByLabel('New occasion').fill('Amma’s birthday');
    await page.keyboard.press('Enter');
    await main.getByRole('button', { name: 'Amma’s birthday' }).click();
    const s = page.getByRole('dialog', { name: 'Amma’s birthday' });
    await s.getByLabel('Date', { exact: true }).fill('1968-11-24');
    await s.getByRole('button', { name: 'Done' }).click();
  });
  await soft('seed expenses', async () => {
    await openSection('Expenses');
    await main.getByLabel('New expense').fill('Groceries');
    await page.keyboard.press('Enter');
    await main.getByRole('button', { name: 'Groceries' }).click();
    const s = page.getByRole('dialog', { name: 'Groceries' });
    await s.getByLabel('Amount').fill('850');
    await s.getByLabel('Category').selectOption('Food');
    await s.getByRole('button', { name: 'Done' }).click();
  });
  await soft('seed journal', async () => {
    await page.goto('/journal');
    await main.getByRole('radio', { name: 'Good' }).click();
    await main.getByRole('textbox', { name: 'Journal entry' }).click();
    await page.keyboard.type('Good progress on the baseline today. Need to sleep earlier.');
    await settle();
  });
  await soft('seed checkin', async () => {
    await page.goto('/home');
    const c = page.getByRole('region', { name: 'Check-in' });
    await c.getByRole('radio', { name: 'Good' }).first().click();
    await c.getByRole('radiogroup', { name: 'Energy' }).getByRole('radio', { name: 'Okay' }).click();
  });

  /* ---------- Main screens ---------- */
  const pages: [string, string, string][] = [
    ['dashboard', 'home-section-map', '/home'],
    ['dashboard', 'today', '/'],
    ['tasks', 'all-tasks', '/tasks'],
    ['tasks', 'inbox', '/inbox'],
    ['planning', 'projects', '/projects'],
    ['planning', 'goals', '/goals'],
    ['planning', 'habits', '/habits'],
    ['tools', 'focus', '/focus'],
    ['calendar', 'calendar', '/calendar'],
    ['people', 'people', '/people'],
    ['tools', 'reviews', '/reviews'],
    ['tools', 'analytics', '/analytics'],
    ['private', 'notes', '/notes'],
    ['private', 'journal', '/journal'],
    ['private', 'vault-setup', '/vault'],
    ['settings', 'settings', '/settings'],
    ['settings', 'section-editor', '/settings/sections'],
    ['settings', 'tags', '/settings/tags'],
    ['settings', 'trash', '/trash'],
    ['navigation', 'more', '/more'],
    ['navigation', 'sections-list', '/sections'],
    ['navigation', 'not-found', '/this-page-does-not-exist'],
  ];
  for (const [folder, name, path] of pages)
    await soft(`page ${name}`, async () => {
      await page.goto(path);
      await shot(`${vp}/${folder}`, name);
    });
  await soft('tasks views', async () => {
    await page.goto('/tasks');
    for (const v of ['This week', 'Upcoming']) {
      await main.getByRole('tab', { name: v }).click();
      await shot(`${vp}/tasks`, `all-tasks-${v.toLowerCase().replace(' ', '-')}`);
    }
  });
  await soft('calendar month', async () => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Month' }).click();
    await shot(`${vp}/calendar`, 'calendar-month');
  });

  /* ---------- Sections ---------- */
  for (const s of [
    'Work',
    'Research',
    'Physical AI',
    'Thesis',
    'Coursework',
    'SMAI',
    'Adviser Meetings',
    'Updates',
    'Self-Improvement',
    'Gym & Fitness',
    'Health',
    'Learning & Skills',
    'Personal Life',
    'Movies & Series',
    'Places',
    'Trips',
    'Dates & Occasions',
    'Miscellaneous',
    'Shopping',
    'Household',
    'Expenses',
    'Documents',
  ])
    await soft(`section ${s}`, async () => {
      await openSection(s);
      await shot(
        `${vp}/sections`,
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-$/, ''),
      );
    });
  await soft('workout page', async () => {
    await page.goto(sectionUrls.get('workout-page')!);
    await shot(`${vp}/sections`, 'gym-workout-in-progress');
  });
  await soft('meeting page', async () => {
    await page.goto(sectionUrls.get('meeting-page')!);
    await shot(`${vp}/sections`, 'adviser-meeting-page');
  });
  await soft('list full page', async () => {
    await openSection('Research');
    await page.getByRole('main').getByRole('button', { name: 'List options' }).click();
    await page.keyboard.press('Escape');
    await page.goto('/home');
  });

  /* ---------- Interactions ---------- */
  const ix = `${vp}/interactions`;
  await soft('new task sheet', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New task' }).first().click();
    await page
      .getByRole('dialog', { name: 'New task' })
      .getByLabel('New task title')
      .fill('Review SMAI notes tomorrow #study');
    await shot(ix, 'quick-add-new-task-sheet', false);
    await page.keyboard.press('Escape');
  });
  await soft('task editor', async () => {
    await page.goto('/tasks');
    await main.getByText('Read RT-2 paper').click();
    await shot(ix, 'task-editor', false);
    await page.keyboard.press('Escape');
  });
  await soft('task row menu', async () => {
    await page.goto('/tasks');
    await main.getByRole('button', { name: /^More actions for Read RT-2 paper/ }).click();
    await shot(ix, 'task-row-menu', false);
    await page.keyboard.press('Escape');
  });
  if (!isMobile)
    await soft('command palette', async () => {
      await page.goto('/');
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox').fill('RT-2');
      await shot(ix, 'command-palette-search', false);
      await page.keyboard.press('Escape');
    });
  await soft('customize today', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customize Today' }).click();
    await shot(ix, 'customize-today', false);
    await page.keyboard.press('Escape');
  });
  await soft('section options menu', async () => {
    await openSection('Research');
    await page.getByRole('button', { name: 'Section options' }).click();
    await shot(ix, 'section-options-menu', false);
    await page.getByRole('menuitem', { name: 'Add a list here' }).click();
    await shot(ix, 'add-a-list-template-picker', false);
    await page.keyboard.press('Escape');
  });
  await soft('new section dialog', async () => {
    await page.goto('/settings/sections');
    await page.getByRole('button', { name: 'New section' }).first().click();
    await shot(ix, 'new-section-dialog', false);
    await page.keyboard.press('Escape');
  });
  await soft('record sheet', async () => {
    await openSection('Movies & Series');
    await main.getByRole('button', { name: 'Interstellar' }).click();
    await shot(ix, 'list-item-sheet', false);
    await page.keyboard.press('Escape');
    await main.getByRole('button', { name: /Fields & statuses/ }).click();
    await shot(ix, 'list-fields-and-statuses', false);
    await page.keyboard.press('Escape');
  });
  await soft('habit sheets', async () => {
    await page.goto('/habits');
    await main.getByRole('button', { name: 'New habit' }).first().click();
    await shot(ix, 'habit-new-sheet', false);
    await page.keyboard.press('Escape');
    await main.getByRole('button', { name: 'Options for DSA practice' }).click();
    await page.getByRole('menuitem', { name: 'History' }).click();
    await shot(ix, 'habit-history-sheet', false);
    await page.keyboard.press('Escape');
  });
  await soft('goal sheet', async () => {
    await page.goto('/goals');
    await main.getByRole('button', { name: 'New goal' }).first().click();
    await shot(ix, 'goal-new-sheet', false);
    await page.keyboard.press('Escape');
  });
  await soft('gym sheets', async () => {
    await openSection('Gym & Fitness');
    const gym = main.getByRole('region', { name: 'Gym' });
    await gym.getByRole('button', { name: 'Programs' }).click();
    await shot(ix, 'gym-programs-by-level', false);
    await page.keyboard.press('Escape');
    await gym.getByRole('button', { name: 'Create' }).click();
    await shot(ix, 'gym-routine-editor', false);
    await page.keyboard.press('Escape');
  });
  await soft('health sheets', async () => {
    await openSection('Health');
    const h = main.getByRole('region', { name: 'Health' });
    await h.getByRole('button', { name: 'Edit plan' }).click();
    await shot(ix, 'health-daily-plan', false);
    await page.keyboard.press('Escape');
    await h.getByRole('button', { name: 'New appointment' }).click();
    await shot(ix, 'health-new-appointment', false);
    await page.keyboard.press('Escape');
  });
  await soft('event sheet', async () => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'New event' }).click();
    await shot(ix, 'calendar-new-event', false);
    await page.keyboard.press('Escape');
  });
  await soft('reminder toast', async () => {
    // 18:00 DSA practice reminder (habit reminder time), shown in-app.
    await page.goto('/');
    await page.clock.runFor(8 * 3_600_000 + 60_000);
    await page.getByRole('region', { name: 'Reminders' }).waitFor({ timeout: 20_000 });
    await shot(ix, 'in-app-reminder', false);
  });
  await soft('vault setup filled', async () => {
    await page.goto('/vault');
    await main.getByLabel('Passphrase', { exact: true }).fill('lamp river');
    await shot(ix, 'vault-setup-form', false);
  });
  await soft('pin dialog', async () => {
    await page.goto('/settings');
    await main.getByRole('button', { name: 'Set a PIN' }).click();
    await shot(ix, 'app-lock-set-pin', false);
    await page.keyboard.press('Escape');
  });
  if (isMobile)
    await soft('bottom tab settings', async () => {
      await page.goto('/settings');
      await page.getByLabel('Bottom bar tab 1').scrollIntoViewIfNeeded();
      await shot(ix, 'phone-bottom-bar-setting', false);
    });
  if (!isMobile)
    await soft('collapsed sidebar', async () => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await shot(ix, 'sidebar-collapsed', false);
      await page
        .getByRole('button', { name: /Expand sidebar/ })
        .first()
        .click();
    });

  /* ---------- Light theme ---------- */
  await page.evaluate(() => localStorage.setItem('pos-theme', 'light'));
  for (const [name, path] of [
    ['home-section-map', '/home'],
    ['today', '/'],
    ['all-tasks', '/tasks'],
    ['habits', '/habits'],
    ['calendar', '/calendar'],
    ['analytics', '/analytics'],
    ['journal', '/journal'],
    ['settings', '/settings'],
  ])
    await soft(`light ${name}`, async () => {
      await page.goto(path!);
      await shot(`${vp}/light-theme`, name!);
    });
  for (const s of ['Gym & Fitness', 'Health', 'Movies & Series'])
    await soft(`light section ${s}`, async () => {
      await openSection(s);
      await shot(`${vp}/light-theme`, s.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    });

  writeFileSync(`${ROOT}${vp}-missing.json`, JSON.stringify(missing, null, 2));
  void sheetDone;
});
