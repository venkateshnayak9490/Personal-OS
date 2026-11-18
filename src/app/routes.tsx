import type { RouteObject } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';
import { MorePage, NotFoundPage, SectionsPage } from '@/pages/ListPages';
import { NodePage } from '@/pages/NodePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StructurePage } from '@/pages/StructurePage';
import { TagsPage } from '@/pages/TagsPage';
import { TasksPage } from '@/pages/TasksPage';
import { InboxPage } from '@/pages/InboxPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { HabitsPage } from '@/pages/HabitsPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { TrashPage } from '@/pages/TrashPage';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { allNavItems } from './nav';

const BUILT: Record<string, React.ReactNode> = {
  dashboard: <DashboardPage />,
  tasks: <TasksPage />,
  inbox: <InboxPage />,
  projects: <ProjectsPage />,
  goals: <GoalsPage />,
  habits: <HabitsPage />,
  settings: <SettingsPage />,
  trash: <TrashPage />,
};

export const routes: RouteObject[] = [
  { path: '/welcome', element: <OnboardingPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        // A failing screen shows an error inside the app frame; navigation keeps working.
        errorElement: <RouteError />,
        children: [
          ...allNavItems().map((item) =>
            item.path === '/'
              ? { index: true, element: BUILT[item.key] ?? <PlaceholderPage item={item} /> }
              : { path: item.path, element: BUILT[item.key] ?? <PlaceholderPage item={item} /> },
          ),
          { path: '/s/:nodeId', element: <NodePage /> },
          { path: '/projects/:projectId', element: <ProjectPage /> },
          { path: '/settings/sections', element: <StructurePage /> },
          { path: '/settings/tags', element: <TagsPage /> },
          { path: '/sections', element: <SectionsPage /> },
          { path: '/more', element: <MorePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
