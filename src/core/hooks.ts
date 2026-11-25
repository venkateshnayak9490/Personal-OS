import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type {
  ActivityLogEntry,
  CalendarEvent,
  Checkin,
  DayPlan,
  Collection,
  CollectionRecord,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  JournalEntry,
  Meeting,
  Milestone,
  MotivationalMessage,
  Note,
  Profile,
  Project,
  Reminder,
  SectionNode,
  Tag,
  Task,
  ThesisChapter,
  WorkoutSession,
  WorkoutSet,
  Routine,
  WritingLog,
} from '@/core/domain/types';
import { PROFILE_ID } from '@/core/repos/profile';

/** Live (auto-updating) reads. `undefined` = still loading. */

export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get(PROFILE_ID)) ?? null, []);
}

/** All non-deleted sections, including hidden ones. */
export function useNodes(): SectionNode[] | undefined {
  return useLiveQuery(async () => (await db.nodes.toArray()).filter((n) => !n.deletedAt), []);
}

export function useTags(): Tag[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.tags.toArray()).filter((t) => !t.deletedAt).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
}

/** All non-deleted tasks (filtering happens in memory; fine for tens of thousands of rows). */
export function useAllTasks(): Task[] | undefined {
  return useLiveQuery(async () => (await db.tasks.toArray()).filter((t) => !t.deletedAt), []);
}

/**
 * One task by id. `undefined` while loading, `null` if it doesn't exist.
 * (useLiveQuery briefly returns the previous query's result after `id` changes, so the
 * result carries the id it belongs to and stale results are treated as "loading".)
 */
export function useTask(id: string | undefined): Task | null | undefined {
  const res = useLiveQuery(async () => ({ id, task: id ? ((await db.tasks.get(id)) ?? null) : null }), [id]);
  if (!res || res.id !== id) return undefined;
  return res.task;
}

export function useHistory(
  entityTable: string,
  entityId: string | undefined,
): ActivityLogEntry[] | undefined {
  return useLiveQuery(
    async () =>
      entityId
        ? (
            await db.activityLog.where('[entityTable+entityId]').equals([entityTable, entityId]).sortBy('ts')
          ).reverse()
        : [],
    [entityTable, entityId],
  );
}

export function useMeta<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.meta.get(key))?.value as T | undefined, [key]);
}

const live = <T extends { deletedAt?: number }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
const byOrder = <T extends { order: string }>(a: T, b: T) =>
  a.order < b.order ? -1 : a.order > b.order ? 1 : 0;

export function useProjects(): Project[] | undefined {
  return useLiveQuery(async () => live(await db.projects.toArray()).sort(byOrder), []);
}

export function useMilestones(): Milestone[] | undefined {
  return useLiveQuery(async () => live(await db.milestones.toArray()).sort(byOrder), []);
}

export function useGoals(): Goal[] | undefined {
  return useLiveQuery(async () => live(await db.goals.toArray()).sort(byOrder), []);
}

export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => live(await db.habits.toArray()).sort(byOrder), []);
}

/** Habit check-ins from `since` (yyyy-MM-dd) onwards. */
export function useHabitLogs(since: string): HabitLog[] | undefined {
  return useLiveQuery(
    async () => live(await db.habitLogs.where('date').aboveOrEqual(since).toArray()),
    [since],
  );
}

export function useEvents(): CalendarEvent[] | undefined {
  return useLiveQuery(async () => live(await db.events.toArray()), []);
}

/** Reminders that fired at or after `since` (epoch ms). */
export function useReminders(since: number): Reminder[] | undefined {
  return useLiveQuery(
    async () => live(await db.reminders.where('fireAt').aboveOrEqual(since).toArray()),
    [since],
  );
}

export function useMessages(): MotivationalMessage[] | undefined {
  return useLiveQuery(
    async () => live(await db.messages.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );
}

export function useCollections(): Collection[] | undefined {
  return useLiveQuery(
    async () => live(await db.collections.toArray()).sort((a, b) => (a.order < b.order ? -1 : 1)),
    [],
  );
}

/** Items of one list, or of every list when no id is given (calendar, Today). */
export function useRecords(collectionId?: string): CollectionRecord[] | undefined {
  return useLiveQuery(
    async () =>
      live(
        await (collectionId
          ? db.records.where('collectionId').equals(collectionId).toArray()
          : db.records.toArray()),
      ).sort((a, b) => (a.order < b.order ? -1 : 1)),
    [collectionId],
  );
}

export function useMeetings(): Meeting[] | undefined {
  return useLiveQuery(async () => live(await db.meetings.toArray()).sort((a, b) => b.start - a.start), []);
}

/** Focus sessions that started at or after `since`, newest first. */
export function useFocusSessions(since: number): FocusSession[] | undefined {
  return useLiveQuery(
    async () =>
      live(await db.focusSessions.where('start').aboveOrEqual(since).toArray()).sort(
        (a, b) => b.start - a.start,
      ),
    [since],
  );
}

/** Pinned first, then most recently edited. */
export function useNotes(): Note[] | undefined {
  return useLiveQuery(
    async () =>
      live(await db.notes.toArray()).sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
      ),
    [],
  );
}

/** Newest day first. */
export function useJournal(): JournalEntry[] | undefined {
  return useLiveQuery(
    async () => live(await db.journalEntries.toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [],
  );
}

export function useChapters(): ThesisChapter[] | undefined {
  return useLiveQuery(async () => live(await db.thesisChapters.toArray()).sort(byOrder), []);
}

export function useWritingLogs(): WritingLog[] | undefined {
  return useLiveQuery(
    async () => live(await db.writingLogs.toArray()).sort((a, b) => b.createdAt - a.createdAt),
    [],
  );
}

/** Newest first. */
export function useWorkouts(): WorkoutSession[] | undefined {
  return useLiveQuery(
    async () =>
      live(await db.workoutSessions.toArray()).sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
      ),
    [],
  );
}

export function useRoutines(): Routine[] | undefined {
  return useLiveQuery(
    async () => live(await db.routines.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );
}

export function useWorkoutSets(): WorkoutSet[] | undefined {
  return useLiveQuery(async () => live(await db.workoutSets.toArray()).sort(byOrder), []);
}

export function useCheckins(since: string): Checkin[] | undefined {
  return useLiveQuery(
    async () => live(await db.checkins.where('date').aboveOrEqual(since).toArray()),
    [since],
  );
}

/** The adaptive day's adjustments from `since` (yyyy-MM-dd) onwards. */
export function useDayPlans(since: string): DayPlan[] | undefined {
  return useLiveQuery(
    async () => live(await db.dayPlans.where('date').aboveOrEqual(since).toArray()),
    [since],
  );
}
