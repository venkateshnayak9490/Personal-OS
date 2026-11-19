import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { Loading } from '@/components/ui';
import { DashboardPage } from '@/pages/DashboardPage';
import { HomePage } from '@/pages/HomePage';
import { MorePage, NotFoundPage } from '@/pages/ListPages';
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
import { SharePage } from '@/features/share/SharePage';
import { CollectionPage } from '@/pages/CollectionPage';
import { MeetingPage } from '@/pages/MeetingPage';
import { PeoplePage } from '@/pages/PeoplePage';
import { FocusPage } from '@/pages/FocusPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { NotesPage } from '@/pages/NotesPage';
import { JournalPage } from '@/pages/JournalPage';
import { VaultPage } from '@/pages/VaultPage';
import { WorkoutPage } from '@/features/life/Workouts';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';
import { allNavItems } from './nav';

// The calendar library is large; load it only when the calendar opens.
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));

const BUILT: Record<string, React.ReactNode> = {
  home: <HomePage />,
  dashboard: <DashboardPage />,
  tasks: <TasksPage />,
  inbox: <InboxPage />,
  projects: <ProjectsPage />,
  goals: <GoalsPage />,
  habits: <HabitsPage />,
  calendar: (
    <Suspense fallback={<Loading />}>
      <CalendarPage />
    </Suspense>
  ),
  people: <PeoplePage />,
  focus: <FocusPage />,
  analytics: <AnalyticsPage />,
  reviews: <ReviewsPage />,
  notes: <NotesPage />,
  journal: <JournalPage />,
  vault: <VaultPage />,
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
          { path: '/settings/:part', element: <SettingsPage /> },
          { path: '/share', element: <SharePage /> },
          { path: '/lists/:collectionId', element: <CollectionPage /> },
          { path: '/meetings/:meetingId', element: <MeetingPage /> },
          { path: '/notes/:noteId', element: <NotesPage /> },
          { path: '/workouts/:workoutId', element: <WorkoutPage /> },
          // The old Sections list: the map on Home replaces it (kept so saved links still work).
          { path: '/sections', element: <Navigate to="/home" replace /> },
          { path: '/more', element: <MorePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
