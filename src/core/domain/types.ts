import type { Sealed, VaultKeys } from '@/core/crypto/vault';
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
  /**
   * When each field last changed (epoch ms), for per-field merging during sync.
   * A field missing here last changed at `createdAt`.
   */
  _ft?: Record<string, number>;
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
  /** Extra reminders this many minutes before the deadline (e.g. [60, 1440]). */
  remindBeforeMin?: number[];
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
  /** Headings in the project's task outline; they share one order with its top-level tasks. */
  headings?: ProjectHeading[];
}

export interface ProjectHeading {
  id: string;
  title: string;
  /** 1 = heading, 2 = subheading */
  level: 1 | 2;
  order: OrderKey;
  createdAt: number;
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
  /** fromHabits: `current` is the number of check-ins of the habits linked to this goal. */
  measure?: { label: string; current: number; target: number; fromHabits?: boolean };
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
  /** Daily reminder time, "HH:mm" (local). Fires on scheduled days until checked in. */
  remindAt?: string;
  /** Remind again every N minutes until checked in (0 = just once); unset = the app default. */
  remindRepeatMin?: number;
  /** "gym": its days come from your active weekday workout routine (the routine is the source). */
  source?: 'gym';
  /**
   * Weeks whose days differ from the usual plan (Gym: a week changed on its own), keyed by that
   * week's Monday: the weekdays (0 = Sun) due that week. Earlier weeks are kept as they were.
   */
  weekDays?: Record<LocalDate, number[]>;
  /**
   * Earlier schedules, so changing the plan never rewrites the past: before `until`, the habit was
   * due on `target` (oldest first). The current `target` applies from the last `until` on.
   */
  targetHistory?: { until: LocalDate; target: HabitTarget }[];
  /** What counts, e.g. which book, or "videos, blogs, mock interviews". */
  note?: string;
  order: OrderKey;
}

/** "missed" only ever comes from you explaining a missed day; an empty past day is missed too. */
export type HabitLogStatus = 'done' | 'skipped' | 'rest' | 'missed';

export interface HabitLog extends BaseEntity {
  habitId: string;
  date: LocalDate;
  status: HabitLogStatus;
  value?: number;
  /** For a skip or a missed day: the reason you gave (optional). */
  note?: string;
  /** When it was first skipped (epoch ms). */
  skippedAt?: number;
  /** Gym: the workout planned that day, e.g. "Chest, triceps, shoulders". */
  planned?: string;
  /** Gym: the workout session that completed it. */
  workoutId?: string;
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
  /** A doctor's (or other health) appointment: listed on Health. */
  kind?: 'appointment';
  /** Repeating: occurrences taken out of the series (their start, epoch ms), deleted or edited on their own. */
  exdates?: number[];
  /** Repeating: the series stops before this moment (epoch ms): "this and following" was changed. */
  until?: number;
}

export interface Reminder extends BaseEntity {
  target: EntityRef;
  fireAt: number;
  channel: 'in_app' | 'push';
  sentAt?: number;
  dismissedAt?: number;
  /** Snoozed: hidden (and no new rounds for the same thing) until then. */
  snoozedUntil?: number;
  /** When a snoozed reminder came back (so it notifies once, in one tab). */
  resurfacedAt?: number;
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

// ---------- Attachments ----------

/** A file attached to a task, list item or meeting. The bytes live in the local `files` table. */
export interface Attachment extends BaseEntity {
  targetTable: string;
  targetId: string;
  nodeId?: string;
  name: string;
  /** MIME type, e.g. "application/pdf". */
  type: string;
  size: number;
  fileId: string;
}

/** File bytes, kept on this device only (not in JSON backups, not synced yet). */
export interface StoredFile {
  id: string;
  /** Plain attachments. */
  blob?: Blob;
  /** Vault files: the bytes encrypted with the Vault key. */
  sealed?: Sealed;
}

// ---------- Focus (build.md F5) ----------

/** A finished block of focused work. Counts toward "deep work" time. */
export interface FocusSession extends BaseEntity {
  start: number;
  end: number;
  minutes: number;
  plannedMin: number;
  taskId?: string;
  nodeId?: string;
}

/** The timer that is running on this device (kept in `meta`, not synced). */
export interface RunningFocus {
  startedAt: number;
  plannedMin: number;
  taskId?: string;
  nodeId?: string;
}

// ---------- Reviews (build.md §7.5) ----------

/** Numbers frozen when the review was written, so later edits don't rewrite the past. */
export interface ReviewSummary {
  completed: number;
  skipped: number;
  missed: number;
  rate: number | null;
  focusMin: number;
  habitsDone: number;
  habitsTarget: number;
  /** Titles of tasks completed in the period (first few). */
  wins: string[];
  sections: { title: string; completed: number }[];
}

/** One review per period; the id is "<kind>:<first day>" so devices can't make two. */
export interface Review extends BaseEntity {
  period: 'day' | 'week' | 'month' | 'year';
  periodStart: LocalDate;
  periodEnd: LocalDate;
  answers: Record<string, string>;
  summary: ReviewSummary;
}

// ---------- Notes & journal (build.md §7.5) ----------

export interface Note extends BaseEntity {
  title: string;
  /** Editor JSON, plus plain text for search and previews. */
  doc?: unknown;
  text: string;
  nodeId?: string;
  pinned: boolean;
}

/** 1 = rough … 5 = great */
export type Mood = 1 | 2 | 3 | 4 | 5;

/** One entry per day; the id is "j:<date>" so two devices can't make two. */
export interface JournalEntry extends BaseEntity {
  date: LocalDate;
  doc?: unknown;
  text: string;
  mood?: Mood;
  /** Kept out of search, reviews and previews; encrypted with the Vault key. */
  isPrivate: boolean;
  /** Private entries: { doc, text } encrypted. `doc` and `text` are then empty. */
  cipher?: Sealed;
}

// ---------- Thesis, workouts, health (build.md §7.5) ----------

export type ChapterStatus = 'outline' | 'drafting' | 'revising' | 'done';

export interface ThesisChapter extends BaseEntity {
  title: string;
  order: OrderKey;
  targetWords: number;
  currentWords: number;
  status: ChapterStatus;
}

/** One writing session: the chapter's word count after it, and how much it changed. */
export interface WritingLog extends BaseEntity {
  date: LocalDate;
  chapterId: string;
  words: number;
  delta: number;
  minutes?: number;
}

export interface WorkoutSession extends BaseEntity {
  date: LocalDate;
  title: string;
  nodeId?: string;
  notes?: string;
  /** Started from a routine: which one and which of its days. */
  routineId?: string;
  dayIndex?: number;
  /** Start workout / End workout (epoch ms). A session counts for the Gym habit once it has ended. */
  startedAt?: number;
  endedAt?: number;
}

/**
 * One set. Exercises are named by plain text ("Bench press"); same name = same exercise.
 * Cardio entries are sets with kind "cardio": minutes (and maybe km) instead of reps and weight.
 */
export interface WorkoutSet extends BaseEntity {
  sessionId: string;
  exercise: string;
  reps: number;
  /** kg; 0 for bodyweight */
  weight: number;
  order: OrderKey;
  kind?: 'cardio';
  minutes?: number;
  distanceKm?: number;
}

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete';

export interface RoutineExercise {
  name: string;
  sets: number;
  /** Target, e.g. "8-12" or "30 s". */
  reps: string;
  /** Cardio: minutes instead of sets × reps. */
  cardio?: boolean;
  minutes?: number;
  /** Target weight in kg (optional). */
  weight?: number;
}

/** A training plan: named days done in order (Push, Pull, Legs, …). */
/** One weekday's workout in a week-only change: a day of some routine. */
export interface WeekSlot {
  routineId: string;
  dayIndex: number;
}

export interface Routine extends BaseEntity {
  title: string;
  level?: FitnessLevel;
  /** Days a week it's meant for. */
  perWeek: number;
  /** With `byWeekday`, each day has its weekday (0 = Sunday … 6 = Saturday); other weekdays are rest. */
  days: { name: string; exercises: RoutineExercise[]; weekday?: number; muscles?: string[] }[];
  byWeekday?: boolean;
  /** Paused: no workouts due (and no reminders) until resumed. */
  paused?: boolean;
  /** The routine "Today's workout" follows. One at a time. */
  active?: boolean;
  /** Copied from a built-in program (its key). */
  programKey?: string;
  /**
   * Changes for one week only (the routine itself stays as it is), keyed by that week's Monday,
   * then weekday ("0" = Sun … "6" = Sat): the workout that day (any routine's day) or null for rest.
   */
  weeks?: Record<LocalDate, Record<string, WeekSlot | null>>;
}

/** Daily check-in. Mood lives in the journal entry for the day, so there's one mood per day. */
export interface Checkin extends BaseEntity {
  date: LocalDate;
  sleepH?: number;
  /** 1 = drained … 5 = full of energy */
  energy?: number;
  waterGlasses?: number;
  weightKg?: number;
  /** When you actually ate ("HH:mm"). */
  meals?: { breakfast?: string; lunch?: string; dinner?: string };
  /** Last night: when you went to bed and woke up ("HH:mm"). Sleep hours follow from them. */
  bedTime?: string;
  wakeTime?: string;
  /** Exactly when each one-tap log happened (the HH:mm fields above stay the shown value). */
  stamps?: Partial<Record<HealthEvent, HealthStamp>>;
  /** Health plan items done that day: routine id → the occurrences ("HH:mm") you marked done. */
  routineDone?: Record<string, string[]>;
  /** When each glass of water was logged (epoch ms). */
  waterAt?: number[];
}

export type HealthEvent = 'wake' | 'bed' | 'breakfast' | 'lunch' | 'dinner';

/**
 * A health action as it happened: the device clock at the tap (`at`, epoch ms), the device's IANA
 * timezone then, and the local date and time there. A later correction is kept apart.
 */
export interface HealthStamp {
  at: number;
  tz: string;
  date: LocalDate;
  /** Local time at capture, "HH:mm". */
  time: string;
  /** Corrected time ("HH:mm") if you fixed it; the original stays in `time`. */
  corrected?: string;
  correctedAt?: number;
}

// ---------- Vault (build.md §10.2) ----------

/** The single row ("vault") that lets a passphrase or the recovery key unlock the data key. */
export interface VaultMeta extends BaseEntity, VaultKeys {}

/**
 * One vault item. Everything readable is inside `cipher`; `fileIds` are random ids of encrypted
 * file bytes in `files` (kept outside so cleanup never deletes them while the vault is locked).
 */
export interface VaultItem extends BaseEntity {
  cipher: Sealed;
  fileIds: string[];
}

/** What's inside a vault item's cipher. */
export interface VaultContent {
  title: string;
  text: string;
  files: { fileId: string; name: string; type: string; size: number }[];
}
