import type { BaseEntity } from '@/core/domain/types';

/**
 * Per-field last-write-wins (build.md §9.2). Each field carries the time it last changed
 * (`_ft`, defaulting to `createdAt`), so an edit to the title on the phone and to the due date on
 * the laptop both survive.
 */

const META = new Set(['_ft', 'version', 'updatedAt', 'deviceId', 'id', 'createdAt']);

/** Long text: when both sides changed it, the losing version is kept as a conflict copy. */
export const LONG_TEXT = new Set(['doc', 'text', 'description', 'agenda']);

type Rec = BaseEntity & Record<string, unknown>;

const fieldTime = (r: Rec, k: string) => r._ft?.[k] ?? r.createdAt;

export interface MergeResult<T> {
  merged: T;
  /** Fields where the remote value won. */
  remoteWon: string[];
  /** Fields where the local value won over a different remote one. */
  localWon: string[];
}

export function mergeRecord<T extends BaseEntity>(localIn: T, remoteIn: T): MergeResult<T> {
  const local = localIn as unknown as Rec;
  const remote = remoteIn as unknown as Rec;
  const out: Rec = { ...local };
  const ft: Record<string, number> = { ...local._ft };
  const remoteWon: string[] = [];
  const localWon: string[] = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    if (META.has(k)) continue;
    const same = JSON.stringify(local[k]) === JSON.stringify(remote[k]);
    const tl = fieldTime(local, k);
    const tr = fieldTime(remote, k);
    // Ties (same millisecond) go to the larger device id, so every device picks the same winner.
    const remoteWins = tr > tl || (tr === tl && remote.deviceId > local.deviceId);
    if (remoteWins) {
      if (!same) {
        if (k in remote) out[k] = remote[k];
        else delete out[k];
        remoteWon.push(k);
      }
      ft[k] = tr;
    } else if (!same) localWon.push(k);
  }
  out._ft = ft;
  out.createdAt = Math.min(local.createdAt, remote.createdAt);
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
  out.version = Math.max(local.version, remote.version);
  out.deviceId = remote.updatedAt > local.updatedAt ? remote.deviceId : local.deviceId;
  return { merged: out as unknown as T, remoteWon, localWon };
}
