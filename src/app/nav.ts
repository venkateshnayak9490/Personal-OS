import {
  BookHeart,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  NotebookPen,
  Repeat,
  Settings,
  Target,
  Trash,
  type LucideIcon,
} from 'lucide-react';

/**
 * Fixed app pages. The user's own sections (Work, Self-Improvement, …) are NOT here:
 * they live in the database (`nodes`) and are rendered at /s/:nodeId.
 */
export interface NavItem {
  key: string;
  title: string;
  path: string;
  icon: LucideIcon;
  /** Milestone where this screen becomes functional (build.md §14). */
  milestone: string;
  summary: string;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    key: 'dashboard',
    title: 'Today',
    path: '/',
    icon: LayoutDashboard,
    milestone: 'M2',
    summary: "Today's tasks, habits, deadlines, events and progress in one place.",
  },
  {
    key: 'tasks',
    title: 'All Tasks',
    path: '/tasks',
    icon: ListTodo,
    milestone: 'M1',
    summary: 'Every task from every section.',
  },
  {
    key: 'inbox',
    title: 'Inbox',
    path: '/inbox',
    icon: Inbox,
    milestone: 'M2',
    summary: 'Everything you quick-capture lands here until you sort it.',
  },
  {
    key: 'projects',
    title: 'Projects',
    path: '/projects',
    icon: FolderKanban,
    milestone: 'M2',
    summary: 'Projects with milestones and honest progress.',
  },
  {
    key: 'goals',
    title: 'Goals',
    path: '/goals',
    icon: Target,
    milestone: 'M2',
    summary: 'What you are working toward.',
  },
  {
    key: 'habits',
    title: 'Habits',
    path: '/habits',
    icon: Repeat,
    milestone: 'M2',
    summary: 'Daily and weekly habits with gentle streaks.',
  },
  {
    key: 'calendar',
    title: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
    milestone: 'M2',
    summary: 'Tasks, deadlines, meetings, exams and occasions on one calendar.',
  },
];

export const TOOLS_NAV: NavItem[] = [
  {
    key: 'reviews',
    title: 'Reviews',
    path: '/reviews',
    icon: ClipboardCheck,
    milestone: 'M4',
    summary: 'Daily, weekly, monthly and yearly reviews.',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    path: '/analytics',
    icon: ChartColumn,
    milestone: 'M4',
    summary: 'Heatmaps, streaks, trends and section-wise progress.',
  },
];

export const PRIVATE_NAV: NavItem[] = [
  {
    key: 'notes',
    title: 'Notes',
    path: '/notes',
    icon: NotebookPen,
    milestone: 'M4',
    summary: 'Ordinary notes, searchable everywhere.',
  },
  {
    key: 'journal',
    title: 'Journal',
    path: '/journal',
    icon: BookHeart,
    milestone: 'M4',
    summary: 'A quiet place to write. Private entries are encrypted (M5).',
  },
  {
    key: 'vault',
    title: 'Vault',
    path: '/vault',
    icon: LockKeyhole,
    milestone: 'M5',
    summary: 'End-to-end encrypted documents and private notes.',
  },
];

export const SETTINGS_NAV: NavItem = {
  key: 'settings',
  title: 'Settings',
  path: '/settings',
  icon: Settings,
  milestone: 'M0',
  summary: 'Theme, sections, tags, backups.',
};

export const TRASH_NAV: NavItem = {
  key: 'trash',
  title: 'Trash',
  path: '/trash',
  icon: Trash,
  milestone: 'M1',
  summary: 'Deleted items stay here for 30 days.',
};

export function allNavItems(): NavItem[] {
  return [...PRIMARY_NAV, ...TOOLS_NAV, ...PRIVATE_NAV, SETTINGS_NAV, TRASH_NAV];
}

/** Screens that work today. The rest are placeholders, tucked under "Coming soon" in navigation. */
const BUILT_KEYS = new Set([
  'dashboard',
  'tasks',
  'inbox',
  'projects',
  'goals',
  'habits',
  'calendar',
  'settings',
  'trash',
]);
export const isBuilt = (item: NavItem) => BUILT_KEYS.has(item.key);
export const comingSoon = (): NavItem[] =>
  [...PRIMARY_NAV, ...TOOLS_NAV, ...PRIVATE_NAV].filter((i) => !isBuilt(i));

export const nodePath = (id: string) => `/s/${id}`;

/**
 * What each built-in module will add to a section, and when (build.md §14).
 * Every section already supports tasks; these are the specialised tools that come later.
 */
export const MODULES: Record<string, { milestone: string; summary: string }> = {
  research: { milestone: 'M3', summary: 'Paper pipeline (to read → summarized), experiments log, datasets.' },
  thesis: { milestone: 'M4', summary: 'Chapter plan with word-count goals and a writing log.' },
  coursework: { milestone: 'M3', summary: 'Courses, assignments, quizzes and exams.' },
  meetings: { milestone: 'M3', summary: 'Meeting notes, decisions, and action items that become tasks.' },
  updates: { milestone: 'M3', summary: 'Conference deadlines (AoE), seminars and announcements.' },
  ideas: { milestone: 'M3', summary: 'Capture ideas and turn them into projects.' },
  fitness: { milestone: 'M4', summary: 'Workout plans, sets/reps/weights, cardio and personal records.' },
  health: { milestone: 'M4', summary: 'Yoga, meditation, appointments, medicines and daily check-ins.' },
  learning: { milestone: 'M4', summary: 'Skills, resources and the projects that need them.' },
  entertainment: { milestone: 'M4', summary: 'Watchlists, ratings and reviews.' },
  places: { milestone: 'M4', summary: 'Places to visit, with a map.' },
  trips: { milestone: 'M4', summary: 'Trips, itineraries, stays and expenses.' },
  dates: { milestone: 'M4', summary: 'Date ideas, plans, anniversaries, birthdays and gift ideas.' },
  shopping: { milestone: 'M3', summary: 'Shopping lists.' },
  finance: { milestone: 'M4', summary: 'Simple expense tracking by category.' },
  documents: { milestone: 'M3', summary: 'Important references and files.' },
  projects: { milestone: 'M2', summary: 'Projects with milestones and progress.' },
};
