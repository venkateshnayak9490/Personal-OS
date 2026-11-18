import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  ActivityLogEntry,
  Attachment,
  CalendarEvent,
  Checkin,
  Collection,
  CollectionRecord,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  InboxItem,
  JournalEntry,
  Link,
  Meeting,
  MetaEntry,
  Milestone,
  MotivationalMessage,
  Note,
  OutboxEntry,
  Page,
  Profile,
  Project,
  Recurrence,
  Reminder,
  Review,
  SectionNode,
  StoredFile,
  Tag,
  Task,
  ThesisChapter,
  TaskOccurrence,
  VaultItem,
  VaultMeta,
  Widget,
  WorkoutSession,
  WorkoutSet,
  Routine,
  WritingLog,
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
  pages!: EntityTable<Page, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  records!: EntityTable<CollectionRecord, 'id'>;
  meetings!: EntityTable<Meeting, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  files!: EntityTable<StoredFile, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  journalEntries!: EntityTable<JournalEntry, 'id'>;
  thesisChapters!: EntityTable<ThesisChapter, 'id'>;
  writingLogs!: EntityTable<WritingLog, 'id'>;
  workoutSessions!: EntityTable<WorkoutSession, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  checkins!: EntityTable<Checkin, 'id'>;
  vaultMeta!: EntityTable<VaultMeta, 'id'>;
  vaultItems!: EntityTable<VaultItem, 'id'>;
  /** Sync bookkeeping (this device only): field times of the server copy last merged. */
  syncSeen!: Table<{ key: string; ft: Record<string, number> }, string>;
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

    // v2 (M2): Notion-style pages, one per section.
    this.version(2).stores({
      pages: 'id, nodeId, updatedAt',
    });

    // v3 (M3): collections (Papers, Deadlines, your own lists) and their items.
    this.version(3).stores({
      collections: 'id, nodeId, updatedAt',
      records: 'id, collectionId, nodeId, status, updatedAt',
    });

    // v4 (M3): meetings with notes; action items are tasks.
    this.version(4).stores({
      meetings: 'id, nodeId, eventId, start, updatedAt',
    });

    // v5 (M3): attachments (metadata, synced and backed up) and their bytes (this device only);
    // focus sessions.
    this.version(5).stores({
      attachments: 'id, targetId, updatedAt',
      files: 'id',
      focusSessions: 'id, start, taskId, nodeId, updatedAt',
    });

    // v6 (M4): reviews.
    this.version(6).stores({
      reviews: 'id, period, periodStart, updatedAt',
    });

    // v7 (M4): notes and journal.
    this.version(7).stores({
      notes: 'id, nodeId, updatedAt',
      journalEntries: 'id, date, updatedAt',
    });

    // v8 (M4): thesis writing, workouts, daily check-ins.
    this.version(8).stores({
      thesisChapters: 'id, order, updatedAt',
      writingLogs: 'id, date, chapterId, updatedAt',
      workoutSessions: 'id, date, updatedAt',
      workoutSets: 'id, sessionId, exercise, updatedAt',
      checkins: 'id, date, updatedAt',
    });

    // v9 (M5): the encrypted Vault.
    this.version(9).stores({
      vaultMeta: 'id, updatedAt',
      vaultItems: 'id, updatedAt',
    });

    // v10 (M5): sync bookkeeping, this device only.
    this.version(10).stores({
      syncSeen: 'key',
    });

    // v11 (M6): gym routines.
    this.version(11).stores({
      routines: 'id, updatedAt',
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
  'pages',
  'collections',
  'records',
  'meetings',
  'attachments',
  'focusSessions',
  'reviews',
  'notes',
  'journalEntries',
  'thesisChapters',
  'writingLogs',
  'workoutSessions',
  'workoutSets',
  'routines',
  'checkins',
  'vaultMeta',
  'vaultItems',
] as const;

export type EntityTableName = (typeof ENTITY_TABLES)[number];
