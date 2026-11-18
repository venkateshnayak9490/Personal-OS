import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { completeOnboarding } from '@/core/repos/profile';
import { resetDb } from '@/test/db-reset';
import { allNavItems } from './nav';
import { routes } from './routes';
import { THEME_STORAGE_KEY, useThemeStore } from './theme';
import { useToasts } from './toast';
import { useUIStore } from './ui-store';

beforeAll(() => {
  // jsdom lacks matchMedia; default to a wide (desktop) screen.
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList;
  window.scrollTo = () => {};
});

beforeEach(resetDb);

// Stores are module-level singletons; reset so state doesn't leak between tests.
afterEach(() => {
  useUIStore.setState({
    composerOpen: false,
    composerContext: {},
    nodeDialog: null,
    editingTaskId: null,
    expandedSections: [],
  });
  useToasts.setState({ toasts: [] });
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const onboard = () =>
  completeOnboarding({
    profileTypes: ['researcher'],
    displayName: 'Venkatesh',
    personalization: { researchTopics: ['Physical AI'], courses: ['SMAI'] },
    timezone: 'Asia/Kolkata',
  });

describe('first run', () => {
  it('asks two optional questions, then suggests the rest on Today', async () => {
    const router = renderAt('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/What should we call you/), 'Venkatesh');
    await user.click(screen.getByRole('button', { name: /Researcher/ }));
    await user.click(screen.getByRole('button', { name: 'Get started' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { level: 1, name: /Venkatesh/ })).toBeInTheDocument();
    const titles = (await db.nodes.toArray()).map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Work', 'Research', 'Coursework', 'Self-Improvement']));

    // The setup checklist adds research areas as sub-sections of Research.
    const checklist = await screen.findByRole('region', { name: 'Finish setting up' });
    await user.type(
      within(checklist).getByLabelText(/e\.g\. Physical AI/),
      'Physical AI, Robot learning{Enter}',
    );
    await waitFor(async () => {
      const nodes = await db.nodes.toArray();
      const research = nodes.find((n) => n.title === 'Research')!;
      expect(nodes.filter((n) => n.parentId === research.id).map((n) => n.title)).toEqual([
        'Physical AI',
        'Robot learning',
      ]);
    });
  });

  it('works with no answers at all', async () => {
    const router = renderAt('/welcome');
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect((await db.profile.toArray())[0]?.profileTypes).toEqual(['other']);
  });
});

describe('app shell (after onboarding)', () => {
  beforeEach(async () => {
    await onboard();
  });

  it('shows the sections from the database in the sidebar', async () => {
    renderAt('/');
    const sidebar = await screen.findByRole('complementary', { name: 'Main navigation' });
    for (const name of ['Work', 'Self-Improvement', 'Personal Life', 'Miscellaneous'])
      expect(await within(sidebar).findByRole('link', { name })).toBeInTheDocument();
  });

  it('every fixed page renders a heading (no dead links)', async () => {
    for (const item of allNavItems()) {
      const { unmount } = render(
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [item.path] })} />,
      );
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });

  it('adds a task in a section, completes it with undo, and logs history', async () => {
    const research = (await db.nodes.toArray()).find((n) => n.moduleKey === 'research')!;
    renderAt(`/s/${research.id}`);
    const user = userEvent.setup();
    // A section's tasks are an outline: type a line and press Enter.
    const line = (await screen.findAllByLabelText('New line')).at(-1)!;
    await user.type(line, 'Read RT-2 paper{Enter}');
    const check = await screen.findByRole('checkbox', { name: 'Complete Read RT-2 paper' });
    await user.click(check);
    await waitFor(async () => expect((await db.tasks.toArray())[0]?.status).toBe('completed'));
    // Undo the most recent toast ("Marked complete").
    const undos = await screen.findAllByRole('button', { name: /Undo/ });
    await user.click(undos.at(-1)!);
    await waitFor(async () => expect((await db.tasks.toArray())[0]?.status).toBe('not_started'));
    const actions = (await db.activityLog.where('entityTable').equals('tasks').toArray()).map(
      (l) => l.action,
    );
    expect(actions).toEqual(['created', 'completed', 'reopened']);
  });

  it('creates a new section from the sidebar', async () => {
    renderAt('/');
    const user = userEvent.setup();
    const sidebar = await screen.findByRole('complementary', { name: 'Main navigation' });
    await user.click(within(sidebar).getByRole('button', { name: 'New section' }));
    await user.type(await screen.findByLabelText('Name'), 'Robotics Lab');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await within(sidebar).findByRole('link', { name: 'Robotics Lab' })).toBeInTheDocument();
  });

  it('adds a task from the New task sheet into the section you are on', async () => {
    const research = (await db.nodes.toArray()).find((n) => n.title === 'Research')!;
    renderAt(`/s/${research.id}`);
    const user = userEvent.setup();
    const sidebar = await screen.findByRole('complementary', { name: 'Main navigation' });
    await screen.findByRole('heading', { level: 1, name: 'Research' });
    await user.click(within(sidebar).getByRole('button', { name: 'New task' }));
    const sheet = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(sheet).getByLabelText('New task title'), 'Draft lit review{Enter}');
    await waitFor(async () => expect((await db.tasks.toArray())[0]?.nodeId).toBe(research.id));
    expect(await within(sheet).findByText(/Added to Research/)).toBeInTheDocument();
  });

  it('All Tasks: a new task goes to the filtered section and stays visible', async () => {
    const research = (await db.nodes.toArray()).find((n) => n.title === 'Research')!;
    renderAt('/tasks');
    const user = userEvent.setup();
    const filter = await screen.findByLabelText('Filter by section');
    await within(filter).findByRole('option', { name: /Research/ });
    await user.selectOptions(filter, research.id);
    await user.type(screen.getByLabelText('New task title'), 'Filtered task{Enter}');
    const main = screen.getByRole('main');
    expect(await within(main).findByText('Filtered task')).toBeInTheDocument();
    expect((await db.tasks.toArray())[0]?.nodeId).toBe(research.id);
  });

  it('N opens the New task sheet on desktop', async () => {
    renderAt('/');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.keyboard('n');
    expect(await screen.findByRole('dialog', { name: 'New task' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('switches theme from Settings and remembers it', async () => {
    renderAt('/settings');
    await userEvent.click(await screen.findByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
