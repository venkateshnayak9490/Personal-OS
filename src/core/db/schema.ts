import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  ActivityLogEntry,
  CalendarEvent,
  Goal,
  Habit,
  HabitLog,
  InboxItem,
  Link,
  MetaEntry,
  Milestone,
  MotivationalMessage,
  OutboxEntry,
  Profile,
  Project,
  Recurrence,
  Reminder,
  SectionNode,
  Tag,
  Task,
  TaskOccurrence,
  Widget,
} from '@/core/domain/types';

export const DB_NAME = 'personal-os';

/**
 * Local database (IndexedDB via Dexie). build.md §7.
 *
 * Schema strings list ONLY indexed fields; every other property is still stored.
 * To change the schema: add a new `this.version(n + 1).stores({...})` block (never edit an old one)
 * plus an `.upgrade()` if existing rows must be transformed. Add a migration test.
 */
export class PersonalOSDB extends Dexie {
  meta!: EntityTable<MetaEntry, 'key'>;
  profile!: EntityTable<Profile, 'id'>;
  nodes!: EntityTable<SectionNode, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  recurrences!: EntityTable<Recurrence, 'id'>;
  taskOccurrences!: EntityTable<TaskOccurrence, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  inbox!: EntityTable<InboxItem, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  links!: EntityTable<Link, 'id'>;
  messages!: EntityTable<MotivationalMessage, 'id'>;
  widgets!: EntityTable<Widget, 'id'>;
  activityLog!: EntityTable<ActivityLogEntry, 'id'>;
  outbox!: Table<OutboxEntry, number>;

  constructor(name = DB_NAME) {
    super(name);

    this.version(1).stores({
      meta: 'key',
      profile: 'id',
      nodes: 'id, parentId, order, moduleKey, updatedAt',
      tags: 'id, name, updatedAt',
      tasks:
        'id, nodeId, projectId, parentTaskId, status, dueDate, startDate, recurrenceId, updatedAt, *tags',
      recurrences: 'id, updatedAt',
      taskOccurrences: 'id, recurrenceId, date, [recurrenceId+date], updatedAt',
      projects: 'id, nodeId, goalId, status, updatedAt',
      milestones: 'id, projectId, updatedAt',
      goals: 'id, nodeId, status, updatedAt',
      habits: 'id, nodeId, goalId, updatedAt',
      habitLogs: 'id, habitId, date, [habitId+date], updatedAt',
      inbox: 'id, createdAt, updatedAt',
      events: 'id, start, nodeId, updatedAt',
      reminders: 'id, fireAt, updatedAt',
      links: 'id, [fromTable+fromId], [toTable+toId], updatedAt',
      messages: 'id, updatedAt',
      widgets: 'id, dashboardId, order, updatedAt',
      activityLog: 'id, ts, [entityTable+entityId], nodeId, action',
      outbox: '++seq, table, entityId',
    });
  }
}

/** Names of tables holding syncable BaseEntity records (excludes meta, activityLog, outbox). */
export const ENTITY_TABLES = [
  'profile',
  'nodes',
  'tags',
  'tasks',
  'recurrences',
  'taskOccurrences',
  'projects',
  'milestones',
  'goals',
  'habits',
  'habitLogs',
  'inbox',
  'events',
  'reminders',
  'links',
  'messages',
  'widgets',
] as const;

export type EntityTableName = (typeof ENTITY_TABLES)[number];
