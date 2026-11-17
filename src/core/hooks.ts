import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { ActivityLogEntry, Profile, SectionNode, Tag, Task } from '@/core/domain/types';
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
