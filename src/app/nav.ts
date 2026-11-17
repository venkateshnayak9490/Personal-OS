import {
  BookHeart,
  BookOpenText,
  Brain,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  Dumbbell,
  FileText,
  Film,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Megaphone,
  NotebookPen,
  Plane,
  Settings,
  Shapes,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Static navigation for M0.
 * From M1 the four sections and their subsections come from the database (`nodes` table)
 * so they can be renamed, reordered, hidden and nested. This file then only seeds defaults.
 */

export type SectionColor = 'work' | 'self' | 'personal' | 'misc' | 'neutral';

export interface NavItem {
  key: string;
  title: string;
  path: string;
  icon: LucideIcon;
  color: SectionColor;
  /** Milestone where this screen becomes functional (build.md §14). */
  milestone: string;
  /** One line describing what will live here. */
  summary: string;
  children?: NavItem[];
}

const sub = (
  parent: { key: string; color: SectionColor },
  key: string,
  title: string,
  icon: LucideIcon,
  milestone: string,
  summary: string,
): NavItem => ({ key, title, path: `/${parent.key}/${key}`, icon, color: parent.color, milestone, summary });

const work = { key: 'work', color: 'work' as const };
const self = { key: 'self', color: 'self' as const };
const personal = { key: 'personal', color: 'personal' as const };
const misc = { key: 'misc', color: 'misc' as const };

export const PRIMARY_NAV: NavItem[] = [
  {
    key: 'dashboard',
    title: 'Today',
    path: '/',
    icon: LayoutDashboard,
    color: 'neutral',
    milestone: 'M2',
    summary: "Today's tasks, habits, deadlines, events and progress in one place.",
  },
  {
    key: 'inbox',
    title: 'Inbox',
    path: '/inbox',
    icon: Inbox,
    color: 'neutral',
    milestone: 'M2',
    summary: 'Everything you quick-capture lands here until you sort it.',
  },
  {
    key: 'calendar',
    title: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
    color: 'neutral',
    milestone: 'M2',
    summary: 'Tasks, deadlines, meetings, exams and occasions on one calendar.',
  },
];

export const SECTIONS: NavItem[] = [
  {
    key: 'work',
    title: 'Work',
    path: '/work',
    icon: Briefcase,
    color: 'work',
    milestone: 'M1',
    summary: 'Research, thesis, coursework, adviser meetings and academic updates.',
    children: [
      sub(
        work,
        'research',
        'Research',
        FlaskConical,
        'M3',
        'Physical AI — papers, experiments, datasets, notes and milestones.',
      ),
      sub(
        work,
        'thesis',
        'Thesis',
        BookOpenText,
        'M4',
        'Chapter plan, writing progress, revisions and deadlines.',
      ),
      sub(
        work,
        'coursework',
        'Coursework',
        GraduationCap,
        'M3',
        'SMAI — assignments, quizzes, exams and lecture notes.',
      ),
      sub(
        work,
        'meetings',
        'Adviser Meetings',
        Users,
        'M3',
        'Meetings with Prof. KS Rajan — notes, decisions and action items.',
      ),
      sub(
        work,
        'updates',
        'Updates',
        Megaphone,
        'M3',
        'Conference deadlines (AoE), seminars, lab announcements.',
      ),
      sub(
        work,
        'ideas',
        'Ideas & Projects',
        Lightbulb,
        'M3',
        'Capture research ideas and turn them into projects.',
      ),
      sub(work, 'work-misc', 'Work Misc', FolderOpen, 'M1', 'Your own space for anything else work-related.'),
    ],
  },
  {
    key: 'self',
    title: 'Self-Improvement',
    path: '/self',
    icon: Sparkles,
    color: 'self',
    milestone: 'M1',
    summary: 'Health, fitness, and learning new skills.',
    children: [
      sub(
        self,
        'fitness',
        'Gym & Fitness',
        Dumbbell,
        'M4',
        'Workout plans, sets/reps/weights, cardio and personal records.',
      ),
      sub(
        self,
        'health',
        'Health',
        HeartPulse,
        'M4',
        'Yoga, meditation, appointments, medicines and check-ins.',
      ),
      sub(
        self,
        'learning',
        'Learning & Skills',
        Brain,
        'M4',
        'Skills, resources and the projects that need them.',
      ),
    ],
  },
  {
    key: 'personal',
    title: 'Personal Life',
    path: '/personal',
    icon: Heart,
    color: 'personal',
    milestone: 'M1',
    summary: 'Entertainment, places, trips, relationships and memories.',
    children: [
      sub(personal, 'entertainment', 'Movies & Series', Film, 'M4', 'Watchlists, ratings and reviews.'),
      sub(personal, 'places', 'Places', MapPin, 'M4', 'Restaurants, cafes and spots to visit — with a map.'),
      sub(personal, 'trips', 'Trips', Plane, 'M4', 'Destinations, itineraries, stays and expenses.'),
      sub(
        personal,
        'dates',
        'Dates & Occasions',
        Heart,
        'M4',
        'Date ideas, plans, anniversaries, birthdays and gifts.',
      ),
    ],
  },
  {
    key: 'misc',
    title: 'Miscellaneous',
    path: '/misc',
    icon: Shapes,
    color: 'misc',
    milestone: 'M1',
    summary: 'Everything that does not fit elsewhere.',
    children: [
      sub(misc, 'shopping', 'Shopping', ShoppingCart, 'M3', 'Shopping lists.'),
      sub(misc, 'household', 'Household', House, 'M1', 'Chores and home responsibilities.'),
      sub(misc, 'finance', 'Expenses', Wallet, 'M4', 'Simple expense tracking by category.'),
      sub(misc, 'documents', 'Documents', FileText, 'M3', 'Important references and files.'),
    ],
  },
];

export const TOOLS_NAV: NavItem[] = [
  {
    key: 'reviews',
    title: 'Reviews',
    path: '/reviews',
    icon: ClipboardCheck,
    color: 'neutral',
    milestone: 'M4',
    summary: 'Daily, weekly, monthly and yearly reviews.',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    path: '/analytics',
    icon: ChartColumn,
    color: 'neutral',
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
    color: 'neutral',
    milestone: 'M4',
    summary: 'Ordinary notes, searchable everywhere.',
  },
  {
    key: 'journal',
    title: 'Journal',
    path: '/journal',
    icon: BookHeart,
    color: 'neutral',
    milestone: 'M4',
    summary: 'A quiet place to write. Private entries are encrypted (M5).',
  },
  {
    key: 'vault',
    title: 'Vault',
    path: '/vault',
    icon: LockKeyhole,
    color: 'neutral',
    milestone: 'M5',
    summary: 'End-to-end encrypted documents and private notes.',
  },
];

export const SETTINGS_NAV: NavItem = {
  key: 'settings',
  title: 'Settings',
  path: '/settings',
  icon: Settings,
  color: 'neutral',
  milestone: 'M0',
  summary: 'Theme, storage, backups and customization.',
};

/** Every routable item (sections and their children flattened). */
export function allNavItems(): NavItem[] {
  return [
    ...PRIMARY_NAV,
    ...SECTIONS.flatMap((s) => [s, ...(s.children ?? [])]),
    ...TOOLS_NAV,
    ...PRIVATE_NAV,
    SETTINGS_NAV,
  ];
}

/** Literal class names so Tailwind can see them. */
export const COLOR_CLASSES: Record<SectionColor, { text: string; bg: string; soft: string }> = {
  work: { text: 'text-sec-work', bg: 'bg-sec-work', soft: 'bg-sec-work/12' },
  self: { text: 'text-sec-self', bg: 'bg-sec-self', soft: 'bg-sec-self/12' },
  personal: { text: 'text-sec-personal', bg: 'bg-sec-personal', soft: 'bg-sec-personal/12' },
  misc: { text: 'text-sec-misc', bg: 'bg-sec-misc', soft: 'bg-sec-misc/12' },
  neutral: { text: 'text-fg', bg: 'bg-fg', soft: 'bg-surface-2' },
};
