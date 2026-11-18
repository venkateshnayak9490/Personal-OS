/**
 * Core entity types (schema v1). See build.md §7.
 *
 * Conventions:
 * - IDs are UUIDv7 strings (time-sortable, safe to generate offline on any device).
 * - Timestamps are epoch milliseconds.
 * - Calendar dates without a time are local-date strings "YYYY-MM-DD" (e.g. a due date),
 *   so a task due "2026-11-20" stays on the 20th whatever the device timezone.
 * - "Overdue" is NEVER stored; it is derived (due date passed and not done/skipped/cancelled).
 */

/** "YYYY-MM-DD" */
export type LocalDate = string;
/** "HH:mm" (24h) */
export type LocalTime = string;
/** Fractional-index sort key; reordering only rewrites the moved row. */
export type OrderKey = string;

/** Fields every syncable record carries (build.md §7.1). */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Soft delete → Trash (purged after 30 days). */
  deletedAt?: number;
  /**
   * Records deleted together (a section with its subsections and tasks) share the id of the
   * record the user actually deleted, so Restore / Delete forever act on the whole group.
   */
  trashBatchId?: string;
  archivedAt?: number;
  /** Increments on every write; used by sync conflict resolution. */
  version: number;
  /** Device that last wrote this record. */
  deviceId: string;
}

/** A reference to any record in any table. */
export interface EntityRef {
  table: string;
  id: string;
}

// ---------- Profile & structure ----------

export type ProfileType =
  'student' | 'researcher' | 'professional' | 'exam_aspirant' | 'freelancer' | 'other';

export type ThemePref = 'dark' | 'light' | 'system';

export interface Profile extends BaseEntity {
  profileTypes: ProfileType[];
  onboardedAt?: number;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  dateFormat: string; // e.g. "dd MMM yyyy"
  settings: Record<string, unknown>;
}

/** A node in the sections tree: main section, subsection or nested category. */
export interface SectionNode extends BaseEntity {
  parentId?: string;
  title: string;
  icon?: string; // lucide icon name
  color?: string; // token name or hex
  order: OrderKey;
  hidden: boolean;
  /** Which built-in module renders this node (e.g. "thesis", "collection", "workout"). Absent = plain section. */
  moduleKey?: string;
  config: Record<string, unknown>;
}

export interface Tag extends BaseEntity {
  name: string;
  color?: string;
}

// ---------- Productivity core ----------

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type Priority = 1 | 2 | 3 | 4; // P1 highest
export type TaskKind = 'general' | 'daily' | 'deadline' | 'learning' | 'long_term';

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  nodeId?: string;
  projectId?: string;
  milestoneId?: string;
  /** Set for subtasks. */
  parentTaskId?: string;
  priority: Priority;
  status: TaskStatus;
  kind: TaskKind;
  startDate?: LocalDate;
  dueDate?: LocalDate;
  dueTime?: LocalTime;
  /** IANA timezone for the due time when it differs from the profile's (e.g. "Etc/GMT+12" for AoE deadlines). */
  timezone?: string;
  recurrenceId?: string;
  estimateMin?: number;
  completedAt?: number;
  skippedReason?: string;
  tags: string[]; // tag ids
  custom: Record<string, unknown>;
  order: OrderKey;
}

export interface Recurrence extends BaseEntity {
  /** RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR". */
  rrule: string;
  startDate: LocalDate;
  until?: LocalDate;
  /** Dates removed from the series. */
  exceptions: LocalDate[];
  taskTemplate: Partial<Task>;
}

export interface TaskOccurrence extends BaseEntity {
  recurrenceId: string;
  date: LocalDate;
  status: TaskStatus;
  completedAt?: number;
  note?: string;
}

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProgressMode = 'tasks' | 'milestones' | 'manual';

export interface Project extends BaseEntity {
  title: string;
  description?: string;
  nodeId?: string;
  goalId?: string;
  status: ProjectStatus;
  startDate?: LocalDate;
  dueDate?: LocalDate;
  color?: string;
  progressMode: ProgressMode;
  manualProgress?: number; // 0..100, only when progressMode = 'manual'
  order: OrderKey;
}

export interface Milestone extends BaseEntity {
  projectId: string;
  title: string;
  dueDate?: LocalDate;
  doneAt?: number;
  weight: number;
  order: OrderKey;
}

export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped';

export interface Goal extends BaseEntity {
  title: string;
  why?: string;
  nodeId?: string;
  targetDate?: LocalDate;
  status: GoalStatus;
  measure?: { label: string; current: number; target: number };
  order: OrderKey;
}

export type HabitTarget =
  { type: 'daily' } | { type: 'perWeek'; n: number } | { type: 'days'; days: number[] }; // 0=Sun..6=Sat

export interface Habit extends BaseEntity {
  title: string;
  nodeId?: string;
  goalId?: string;
  target: HabitTarget;
  unit?: string;
  restDaysAllowed: boolean;
  order: OrderKey;
}

export type HabitLogStatus = 'done' | 'skipped' | 'rest';

export interface HabitLog extends BaseEntity {
  habitId: string;
  date: LocalDate;
  status: HabitLogStatus;
  value?: number;
  note?: string;
}

export type InboxKind = 'idea' | 'task' | 'note' | 'link' | 'reminder' | 'project_idea' | 'info';

export interface InboxItem extends BaseEntity {
  text: string;
  kind?: InboxKind;
  url?: string;
  processedInto?: EntityRef;
}

export interface CalendarEvent extends BaseEntity {
  title: string;
  description?: string;
  start: number; // epoch ms
  end: number;
  allDay: boolean;
  rrule?: string;
  nodeId?: string;
  location?: string;
  linked?: EntityRef;
  reminderOffsetsMin: number[];
}

export interface Reminder extends BaseEntity {
  target: EntityRef;
  fireAt: number;
  channel: 'in_app' | 'push';
  sentAt?: number;
  dismissedAt?: number;
}

/** Generic many-to-many link between any two records (backlinks). */
export interface Link extends BaseEntity {
  fromTable: string;
  fromId: string;
  toTable: string;
  toId: string;
  relation: string;
}

export interface MotivationalMessage extends BaseEntity {
  text: string;
  author?: string;
  /** Where it may appear: node ids, module keys, "morning", "streak_broken", … */
  contexts: string[];
  builtIn: boolean;
  enabled: boolean;
}

/**
 * A section's Notion-style page (headings, text, lists, checklists…).
 * One per section: `id` equals the section's id, so two devices editing it merge into one record.
 */
export interface Page extends BaseEntity {
  nodeId: string;
  /** Rich-text document as editor JSON (ProseMirror/TipTap format). */
  doc: unknown;
  /** Plain text of the page, for search and previews. */
  text: string;
}

export interface Widget extends BaseEntity {
  dashboardId: string;
  type: string;
  order: OrderKey;
  visible: boolean;
  config: Record<string, unknown>;
}

// ---------- History & sync ----------

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'completed'
  | 'skipped'
  | 'reopened'
  | 'archived'
  | 'restored'
  | 'deleted'
  | 'purged';

/** Append-only. Never updated or deleted by app code. Source of truth for analytics. */
export interface ActivityLogEntry {
  id: string;
  ts: number;
  entityTable: string;
  entityId: string;
  action: ActivityAction;
  /** Denormalized for fast per-section stats. */
  nodeId?: string;
  /** For backdated completions: the day the work counts for. */
  effectiveDate?: LocalDate;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  deviceId: string;
}

/** Pending change waiting to be pushed to the server (used from M5). */
export interface OutboxEntry {
  seq?: number; // auto-increment
  table: string;
  entityId: string;
  op: 'put' | 'delete';
  changedFields: string[];
  ts: number;
}

/** Small key/value store for app-level metadata (device id, schema info, last backup time…). */
export interface MetaEntry {
  key: string;
  value: unknown;
}

// ---------- Collections (build.md §7.4): generic lists with custom fields ----------

export type FieldType =
  'text' | 'longtext' | 'number' | 'url' | 'date' | 'deadline' | 'select' | 'rating' | 'checkbox';

/** A deadline: a wall-clock date and time in a timezone ("23:59 AoE"). */
export interface DeadlineValue {
  date: LocalDate;
  time: LocalTime;
  /** IANA zone; AOE_TZ for Anywhere on Earth. Absent = the profile's zone. */
  tz?: string;
}

export interface FieldDef {
  /** Stable key into `record.custom`; never changes when the field is renamed. */
  key: string;
  name: string;
  type: FieldType;
  /** Choices for `select`. */
  options?: string[];
  /** `deadline` fields: zone new values start in (AOE_TZ for conference deadlines). */
  defaultTz?: string;
  /** `date` fields: repeats every year (birthdays, anniversaries). */
  yearly?: boolean;
}

export interface Collection extends BaseEntity {
  name: string;
  icon?: string;
  /** Section it belongs to. */
  nodeId?: string;
  /** Template it was made from ("papers", "deadlines"…). Only a starting point; everything stays editable. */
  templateKey?: string;
  /** Status column / board lanes, in order. */
  statusOptions: string[];
  /** What the status is called in this list ("Relation" for People). Default "Status". */
  statusName?: string;
  /** Statuses that close an item (it leaves the calendar and Coming up). */
  doneStatuses: string[];
  fields: FieldDef[];
  defaultView: 'table' | 'board';
  order: OrderKey;
}

/** One item in a collection. `custom` holds values keyed by FieldDef.key. */
export interface CollectionRecord extends BaseEntity {
  collectionId: string;
  /** Copied from the collection so per-section history and stats work. */
  nodeId?: string;
  title: string;
  status: string;
  custom: Record<string, unknown>;
  tags: string[];
  order: OrderKey;
}

// ---------- Meetings (build.md §7.5) ----------

/**
 * One meeting (e.g. with your adviser). Action items are ordinary tasks with
 * `custom.meetingId`; `custom.followUp` asks to bring the item up at the next meeting.
 */
export interface Meeting extends BaseEntity {
  title: string;
  nodeId?: string;
  /** When it happens (epoch ms). */
  start: number;
  /** The calendar event this is one occurrence of (a weekly meeting). */
  eventId?: string;
  attendees: string[];
  agenda?: string;
  /** Notes as editor JSON, plus plain text for search. */
  doc?: unknown;
  text?: string;
}
