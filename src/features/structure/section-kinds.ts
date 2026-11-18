import type { SectionNode } from '@/core/domain/types';

/**
 * What a section page offers, by the kind of section it is (its moduleKey, or its parent's for
 * sections made inside Coursework). `list`: the list template shown right on the page, whose add box
 * replaces "Add a task". `tasks`: main = the task box as usual; more = a small "Add a task here";
 * off = only when the section already has tasks.
 */
export interface SectionKind {
  list?: string;
  tasks: 'main' | 'more' | 'off';
}

const KINDS: Record<string, SectionKind> = {
  research: { list: 'papers', tasks: 'main' }, // research work is mostly tasks too
  ideas: { list: 'ideas', tasks: 'more' },
  learning: { list: 'learning', tasks: 'more' },
  entertainment: { list: 'movies', tasks: 'off' },
  places: { list: 'places', tasks: 'off' },
  trips: { list: 'trips', tasks: 'more' },
  dates: { list: 'occasions', tasks: 'off' },
  shopping: { list: 'shopping', tasks: 'off' },
  finance: { list: 'expenses', tasks: 'off' },
  invoices: { list: 'expenses', tasks: 'more' },
  meetings: { tasks: 'more' },
  fitness: { tasks: 'off' },
  health: { tasks: 'off' },
};

export function sectionKind(node: SectionNode, parent?: SectionNode): SectionKind {
  if (node.moduleKey && KINDS[node.moduleKey]) return KINDS[node.moduleKey]!;
  // A course made inside Coursework: its assessments (assignments, quizzes, exams) with grades.
  if (!node.moduleKey && parent?.moduleKey === 'coursework') return { list: 'course', tasks: 'more' };
  return { tasks: 'main' };
}
