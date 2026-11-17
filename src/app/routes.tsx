import type { RouteObject } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';
import { MorePage, NotFoundPage, SectionsPage } from '@/pages/ListPages';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AppShell } from './AppShell';
import { allNavItems } from './nav';

const BUILT: Record<string, React.ReactNode> = {
  dashboard: <DashboardPage />,
  settings: <SettingsPage />,
};

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      ...allNavItems().map((item) =>
        item.path === '/'
          ? { index: true, element: BUILT[item.key] ?? <PlaceholderPage item={item} /> }
          : { path: item.path, element: BUILT[item.key] ?? <PlaceholderPage item={item} /> },
      ),
      { path: '/sections', element: <SectionsPage /> },
      { path: '/more', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
