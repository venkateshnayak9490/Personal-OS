import { generateKeyBetween } from 'fractional-indexing';
import { db } from '@/core/db';
import type {
  Goal,
  Habit,
  HabitLog,
  HabitLogStatus,
  LocalDate,
  Milestone,
  Project,
} from '@/core/domain/types';
import { insert, patch, purge, softDeleteBatch, type BatchItem } from './write';

/** Projects, milestones, goals and habits. Same write path: history, Trash, sync-ready. */

async function orderAtEnd(
  table: 'projects' | 'goals' | 'habits' | 'milestones',
  filter?: (r: { order: string; deletedAt?: number }) => boolean,
) {
  const rows = (await db.table(table).toArray()) as { order: string; deletedAt?: number }[];
  const last = rows
    .filter((r) => !r.deletedAt && (!filter || filter(r)))
    .map((r) => r.order)
    .sort()
    .at(-1);
  return generateKeyBetween(last ?? null, null);
}

const required = (s: string, what: string) => {
  const t = s.trim();
  if (!t) throw new Error(`A ${what} needs a name`);
  return t;
};

/* ---------- Projects ---------- */

export type NewProject = Pick<Project, 'title'> &
  Partial<
    Pick<Project, 'description' | 'nodeId' | 'goalId' | 'status' | 'startDate' | 'dueDate' | 'progressMode'>
  >;

export async function createProject(input: NewProject): Promise<Project> {
  return insert<Project>('projects', {
    status: 'active',
    progressMode: 'tasks',
    ...input,
    title: required(input.title, 'project'),
    order: await orderAtEnd('projects'),
  });
}

export type ProjectChanges = Partial<
  Pick<
    Project,
    | 'title'
    | 'description'
    | 'nodeId'
    | 'goalId'
    | 'status'
    | 'startDate'
    | 'dueDate'
    | 'progressMode'
    | 'manualProgress'
    | 'headings'
  >
>;

export async function updateProject(id: string, changes: ProjectChanges) {
  if (changes.title !== undefined) changes = { ...changes, title: required(changes.title, 'project') };
  return patch<Project>('projects', id, changes);
}

/** Moves the project and its milestones to Trash. Its tasks stay (they just lose the project link in views). */
export async function deleteProject(id: string) {
  const ms = (await db.milestones.where('projectId').equals(id).toArray()).filter((m) => !m.deletedAt);
  return softDeleteBatch([
    { tableName: 'projects', id },
    ...ms.map((m) => ({ tableName: 'milestones' as const, id: m.id })),
  ]);
}

export async function addMilestone(
  projectId: string,
  title: string,
  dueDate?: LocalDate,
): Promise<Milestone> {
  return insert<Milestone>('milestones', {
    projectId,
    title: required(title, 'milestone'),
    ...(dueDate ? { dueDate } : {}),
    weight: 1,
    order: await orderAtEnd('milestones', (r) => (r as unknown as Milestone).projectId === projectId),
  });
}

export async function toggleMilestone(m: Milestone) {
  return patch<Milestone>(
    'milestones',
    m.id,
    { doneAt: m.doneAt ? undefined : Date.now() },
    m.doneAt ? 'reopened' : 'completed',
  );
}

export async function deleteMilestone(id: string) {
  return softDeleteBatch([{ tableName: 'milestones', id }]);
}

/* ---------- Goals ---------- */

export type NewGoal = Pick<Goal, 'title'> & Partial<Pick<Goal, 'why' | 'nodeId' | 'targetDate' | 'measure'>>;

export async function createGoal(input: NewGoal): Promise<Goal> {
  return insert<Goal>('goals', {
    status: 'active',
    ...input,
    title: required(input.title, 'goal'),
    order: await orderAtEnd('goals'),
  });
}

export type GoalChanges = Partial<
  Pick<Goal, 'title' | 'why' | 'nodeId' | 'targetDate' | 'status' | 'measure'>
>;

export async function updateGoal(id: string, changes: GoalChanges) {
  if (changes.title !== undefined) changes = { ...changes, title: required(changes.title, 'goal') };
  return patch<Goal>('goals', id, changes, changes.status === 'achieved' ? 'completed' : 'updated');
}

export async function deleteGoal(id: string) {
  return softDeleteBatch([{ tableName: 'goals', id }]);
}

/* ---------- Habits ---------- */

export type NewHabit = Pick<Habit, 'title' | 'target'> &
  Partial<
    Pick<
      Habit,
      'nodeId' | 'goalId' | 'unit' | 'restDaysAllowed' | 'remindAt' | 'note' | 'remindRepeatMin' | 'source'
    >
  >;

export async function createHabit(input: NewHabit): Promise<Habit> {
  return insert<Habit>('habits', {
    restDaysAllowed: true,
    ...input,
    title: required(input.title, 'habit'),
    order: await orderAtEnd('habits'),
  });
}

export type HabitChanges = Partial<
  Pick<
    Habit,
    | 'title'
    | 'target'
    | 'nodeId'
    | 'goalId'
    | 'restDaysAllowed'
    | 'remindAt'
    | 'note'
    | 'remindRepeatMin'
    | 'source'
    | 'targetHistory'
    | 'weekDays'
  >
>;

export async function updateHabit(id: string, changes: HabitChanges) {
  if (changes.title !== undefined) changes = { ...changes, title: required(changes.title, 'habit') };
  return patch<Habit>('habits', id, changes);
}

export async function deleteHabit(id: string) {
  const logs = (await db.habitLogs.where('habitId').equals(id).toArray()).filter((l) => !l.deletedAt);
  return softDeleteBatch([
    { tableName: 'habits', id },
    ...logs.map((l) => ({ tableName: 'habitLogs' as const, id: l.id })),
  ]);
}

/** Set (or clear, with null) a habit's check-in for a day. Every change is logged. */
export async function setHabitLog(
  habitId: string,
  date: LocalDate,
  status: HabitLogStatus | null,
  note?: string,
  extra: Pick<HabitLog, 'planned' | 'workoutId'> = {},
) {
  const existing = (await db.habitLogs.where('[habitId+date]').equals([habitId, date]).toArray()).find(
    (l) => !l.deletedAt,
  );
  if (!status) {
    if (existing) await purge([{ tableName: 'habitLogs', id: existing.id } satisfies BatchItem]);
    return null;
  }
  if (existing)
    return patch<HabitLog>(
      'habitLogs',
      existing.id,
      {
        status,
        note: status === 'skipped' || status === 'missed' ? note : undefined,
        // The first time it was skipped stays (editing the reason later doesn't move it).
        skippedAt:
          status === 'skipped'
            ? existing.status === 'skipped'
              ? existing.skippedAt
              : Date.now()
            : undefined,
        ...extra,
      },
      status === 'done' ? 'completed' : status === 'skipped' ? 'skipped' : 'updated',
    );
  return insert<HabitLog>('habitLogs', {
    habitId,
    date,
    status,
    ...(status === 'skipped' ? { skippedAt: Date.now() } : {}),
    ...((status === 'skipped' || status === 'missed') && note ? { note } : {}),
    ...extra,
  });
}
