import { AOE_TZ } from '@/core/domain/tasks';
import type { Collection } from '@/core/domain/types';

export type CollectionTemplate = Pick<
  Collection,
  'name' | 'icon' | 'statusOptions' | 'statusName' | 'doneStatuses' | 'fields' | 'defaultView'
> & {
  key: string;
  hint: string;
  /** Section templates (node config.templateKey) it suits; those are suggested first. */
  suits: string[];
};

/** Starting points for lists. After creation everything (fields, statuses, name) is editable. */
export const COLLECTION_TEMPLATES: CollectionTemplate[] = [
  {
    key: 'papers',
    name: 'Papers',
    icon: 'newspaper',
    hint: 'Reading pipeline: To read, Reading, Read, Summarized, Cited',
    suits: ['research', 'thesis'],
    statusOptions: ['To read', 'Reading', 'Read', 'Summarized', 'Cited'],
    doneStatuses: [],
    defaultView: 'board',
    fields: [
      { key: 'authors', name: 'Authors', type: 'text' },
      { key: 'year', name: 'Year', type: 'number' },
      { key: 'venue', name: 'Venue', type: 'text' },
      { key: 'link', name: 'Link', type: 'url' },
      { key: 'rating', name: 'Rating', type: 'rating' },
      { key: 'summary', name: 'Summary', type: 'longtext' },
    ],
  },
  {
    key: 'deadlines',
    name: 'Conference deadlines',
    icon: 'flag',
    hint: 'Deadlines in AoE, shown in your time, on the calendar and Today',
    suits: ['research', 'updates'],
    statusOptions: ['Planning', 'Writing', 'Submitted', 'Skipped'],
    doneStatuses: ['Submitted', 'Skipped'],
    defaultView: 'table',
    fields: [
      { key: 'deadline', name: 'Paper deadline', type: 'deadline', defaultTz: AOE_TZ },
      { key: 'abstract', name: 'Abstract deadline', type: 'deadline', defaultTz: AOE_TZ },
      { key: 'link', name: 'Link', type: 'url' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
  },
  {
    key: 'experiments',
    name: 'Experiments',
    icon: 'flask',
    hint: 'Hypothesis, config, result and a link to the run',
    suits: ['research', 'ideas'],
    statusOptions: ['Planned', 'Running', 'Done', 'Failed'],
    doneStatuses: ['Done', 'Failed'],
    defaultView: 'table',
    fields: [
      { key: 'date', name: 'Date', type: 'date' },
      { key: 'hypothesis', name: 'Hypothesis', type: 'longtext' },
      { key: 'config', name: 'Config', type: 'longtext' },
      { key: 'result', name: 'Result', type: 'longtext' },
      { key: 'run', name: 'Run link', type: 'url' },
    ],
  },
  {
    key: 'datasets',
    name: 'Datasets & resources',
    icon: 'folder-open',
    hint: 'Datasets, codebases and tools worth keeping',
    suits: ['research', 'learning'],
    statusOptions: ['To check', 'Using', 'Used'],
    doneStatuses: [],
    defaultView: 'table',
    fields: [
      { key: 'link', name: 'Link', type: 'url' },
      { key: 'kind', name: 'Kind', type: 'select', options: ['Dataset', 'Code', 'Tool', 'Course', 'Other'] },
      { key: 'license', name: 'License', type: 'text' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
  },
  {
    key: 'ideas',
    name: 'Ideas',
    icon: 'lightbulb',
    hint: 'Capture ideas, rate them, park or pursue them',
    suits: ['ideas', 'research'],
    statusOptions: ['New', 'Exploring', 'Parked', 'Pursuing'],
    doneStatuses: [],
    defaultView: 'board',
    fields: [
      { key: 'rating', name: 'Promise', type: 'rating' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
  },
  {
    key: 'course',
    name: 'Assessments',
    icon: 'graduation-cap',
    hint: 'Assignments, quizzes and exams with due dates, weights and scores',
    suits: ['coursework'],
    statusOptions: ['To do', 'Submitted', 'Graded'],
    doneStatuses: ['Submitted', 'Graded'],
    defaultView: 'table',
    fields: [
      {
        key: 'type',
        name: 'Type',
        type: 'select',
        options: ['Assignment', 'Quiz', 'Mid-sem', 'End-sem', 'Project', 'Other'],
      },
      { key: 'due', name: 'Due', type: 'deadline' },
      { key: 'weight', name: 'Weight %', type: 'number' },
      { key: 'score', name: 'Score', type: 'number' },
      { key: 'outOf', name: 'Out of', type: 'number' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
  },
  {
    key: 'people',
    name: 'People',
    icon: 'users',
    hint: 'Family, friends, your adviser and lab',
    suits: [],
    statusName: 'Relation',
    statusOptions: ['Family', 'Partner', 'Friends', 'Adviser & lab', 'Colleagues', 'Others'],
    doneStatuses: [],
    defaultView: 'table',
    fields: [
      { key: 'birthday', name: 'Birthday', type: 'date', yearly: true },
      { key: 'anniversary', name: 'Anniversary', type: 'date', yearly: true },
      { key: 'phone', name: 'Phone', type: 'text' },
      { key: 'email', name: 'Email', type: 'text' },
      { key: 'gifts', name: 'Gift ideas', type: 'longtext' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
  },
  {
    key: 'blank',
    name: 'New list',
    icon: 'clipboard',
    hint: 'Start empty and add your own fields',
    suits: [],
    statusOptions: ['To do', 'Doing', 'Done'],
    doneStatuses: ['Done'],
    defaultView: 'table',
    fields: [],
  },
];

export const templateFor = (key: string) => COLLECTION_TEMPLATES.find((t) => t.key === key);
