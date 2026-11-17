import type { ProfileType } from './types';

/**
 * Starter structures per profile (build.md §6.2 rule 2: profiles are just starter templates).
 * Nothing in the app checks which profile was picked; after onboarding everything is editable.
 */

export interface NodeSeed {
  /** Stable key used to merge templates (two profiles both wanting "Projects" get one). */
  key: string;
  title: string;
  icon: string;
  color?: string;
  moduleKey?: string;
  children?: NodeSeed[];
}

export const PROFILE_OPTIONS: { value: ProfileType; label: string; hint: string }[] = [
  { value: 'researcher', label: 'Researcher', hint: 'MS by Research, PhD, research staff' },
  { value: 'student', label: 'Student', hint: 'Undergraduate or postgraduate coursework' },
  { value: 'professional', label: 'Working professional', hint: 'Projects, meetings, deliverables' },
  { value: 'exam_aspirant', label: 'Exam aspirant', hint: 'Competitive exam preparation' },
  { value: 'freelancer', label: 'Freelancer / entrepreneur', hint: 'Clients, proposals, invoices' },
  { value: 'other', label: 'Other', hint: 'Start simple and shape it yourself' },
];

const WORK_BY_PROFILE: Record<ProfileType, NodeSeed[]> = {
  researcher: [
    { key: 'research', title: 'Research', icon: 'flask', moduleKey: 'research' },
    { key: 'thesis', title: 'Thesis', icon: 'book-open', moduleKey: 'thesis' },
    { key: 'coursework', title: 'Coursework', icon: 'graduation-cap', moduleKey: 'coursework' },
    { key: 'meetings', title: 'Adviser Meetings', icon: 'users', moduleKey: 'meetings' },
    { key: 'updates', title: 'Updates', icon: 'megaphone', moduleKey: 'updates' },
    { key: 'ideas', title: 'Ideas & Projects', icon: 'lightbulb', moduleKey: 'ideas' },
  ],
  student: [
    { key: 'coursework', title: 'Coursework', icon: 'graduation-cap', moduleKey: 'coursework' },
    { key: 'assignments', title: 'Assignments', icon: 'clipboard', moduleKey: 'assignments' },
    { key: 'exams', title: 'Exams & Quizzes', icon: 'pen', moduleKey: 'exams' },
    { key: 'projects', title: 'Projects', icon: 'folder', moduleKey: 'projects' },
  ],
  professional: [
    { key: 'projects', title: 'Projects', icon: 'folder', moduleKey: 'projects' },
    { key: 'work-meetings', title: 'Meetings', icon: 'users', moduleKey: 'meetings' },
    { key: 'reports', title: 'Reports & Reviews', icon: 'file', moduleKey: 'reports' },
    { key: 'admin', title: 'Admin', icon: 'briefcase' },
  ],
  exam_aspirant: [
    { key: 'subjects', title: 'Subjects', icon: 'book-open', moduleKey: 'subjects' },
    { key: 'mock-tests', title: 'Mock Tests', icon: 'clipboard', moduleKey: 'mock_tests' },
    { key: 'revision', title: 'Revision', icon: 'repeat' },
    { key: 'current-affairs', title: 'Current Affairs', icon: 'newspaper' },
  ],
  freelancer: [
    { key: 'clients', title: 'Clients', icon: 'users', moduleKey: 'clients' },
    { key: 'projects', title: 'Projects', icon: 'folder', moduleKey: 'projects' },
    { key: 'proposals', title: 'Proposals', icon: 'send' },
    { key: 'invoices', title: 'Invoices', icon: 'wallet', moduleKey: 'invoices' },
  ],
  other: [{ key: 'projects', title: 'Projects', icon: 'folder', moduleKey: 'projects' }],
};

const SELF: NodeSeed = {
  key: 'self',
  title: 'Self-Improvement',
  icon: 'sparkles',
  color: 'emerald',
  children: [
    { key: 'fitness', title: 'Gym & Fitness', icon: 'dumbbell', moduleKey: 'fitness' },
    { key: 'health', title: 'Health', icon: 'heart-pulse', moduleKey: 'health' },
    { key: 'learning', title: 'Learning & Skills', icon: 'brain', moduleKey: 'learning' },
  ],
};

const PERSONAL: NodeSeed = {
  key: 'personal',
  title: 'Personal Life',
  icon: 'heart',
  color: 'rose',
  children: [
    { key: 'entertainment', title: 'Movies & Series', icon: 'film', moduleKey: 'entertainment' },
    { key: 'places', title: 'Places', icon: 'map-pin', moduleKey: 'places' },
    { key: 'trips', title: 'Trips', icon: 'plane', moduleKey: 'trips' },
    { key: 'dates', title: 'Dates & Occasions', icon: 'gift', moduleKey: 'dates' },
  ],
};

const MISC: NodeSeed = {
  key: 'misc',
  title: 'Miscellaneous',
  icon: 'shapes',
  color: 'amber',
  children: [
    { key: 'shopping', title: 'Shopping', icon: 'cart', moduleKey: 'shopping' },
    { key: 'household', title: 'Household', icon: 'house' },
    { key: 'finance', title: 'Expenses', icon: 'wallet', moduleKey: 'finance' },
    { key: 'documents', title: 'Documents', icon: 'file', moduleKey: 'documents' },
  ],
};

export interface Personalization {
  /** Research topics → sub-categories of Research. */
  researchTopics?: string[];
  /** Courses → sub-categories of Coursework. */
  courses?: string[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function withChildren(seed: NodeSeed, titles: string[] | undefined, icon: string): NodeSeed {
  const clean = (titles ?? []).map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return seed;
  return {
    ...seed,
    children: [
      ...(seed.children ?? []),
      ...clean.map((t) => ({ key: `${seed.key}-${slug(t)}`, title: t, icon })),
    ],
  };
}

/** The full starter tree for the chosen profiles. */
export function buildStarterTree(profiles: ProfileType[], p: Personalization = {}): NodeSeed[] {
  const chosen = profiles.length ? profiles : (['other'] as ProfileType[]);
  const seen = new Set<string>();
  const workChildren: NodeSeed[] = [];
  for (const prof of chosen) {
    for (const seed of WORK_BY_PROFILE[prof]) {
      if (seen.has(seed.key)) continue;
      seen.add(seed.key);
      workChildren.push(seed);
    }
  }
  workChildren.push({ key: 'work-misc', title: 'Work Misc', icon: 'folder-open' });

  const personalized = workChildren.map((s) =>
    s.key === 'research'
      ? withChildren(s, p.researchTopics, 'atom')
      : s.key === 'coursework'
        ? withChildren(s, p.courses, 'book')
        : s,
  );

  return [
    { key: 'work', title: 'Work', icon: 'briefcase', color: 'indigo', children: personalized },
    SELF,
    PERSONAL,
    MISC,
  ];
}

/** Split "SMAI, Robotics; NLP" into ["SMAI","Robotics","NLP"]. */
export function splitList(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
