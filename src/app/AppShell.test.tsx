import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { allNavItems, SECTIONS } from './nav';
import { routes } from './routes';
import { THEME_STORAGE_KEY, useThemeStore } from './theme';
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

// Stores are module-level singletons; reset so an open dialog doesn't leak into the next test.
afterEach(() => useUIStore.setState({ quickCaptureOpen: false }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('navigation config', () => {
  it('has unique keys and paths', () => {
    const items = allNavItems();
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
  });

  it('has the four main sections in order', () => {
    expect(SECTIONS.map((s) => s.title)).toEqual([
      'Work',
      'Self-Improvement',
      'Personal Life',
      'Miscellaneous',
    ]);
  });
});

describe('app shell', () => {
  it('renders the dashboard with the sidebar', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' });
    expect(within(sidebar).getByRole('link', { name: 'Work' })).toBeInTheDocument();
  });

  it('every nav route renders a page heading (no dead links)', async () => {
    for (const item of allNavItems()) {
      const { unmount } = render(
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [item.path] })} />,
      );
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
      unmount();
    }
  });

  it('navigates from a section to a subsection', async () => {
    const router = renderAt('/work');
    await userEvent.click(await screen.findByRole('link', { name: /Adviser Meetings.*KS Rajan/ }));
    expect(router.state.location.pathname).toBe('/work/meetings');
    expect(screen.getByRole('heading', { level: 1, name: 'Adviser Meetings' })).toBeInTheDocument();
  });

  it('opens Quick Capture from the sidebar', async () => {
    renderAt('/');
    const sidebar = await screen.findByRole('complementary', { name: 'Main navigation' });
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Quick Capture' }));
    expect(await screen.findByRole('dialog', { name: 'Quick Capture' })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('theme', () => {
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
