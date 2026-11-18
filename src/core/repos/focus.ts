import { db } from '@/core/db';
import { endsAt, FOCUS_KEY, workedMinutes } from '@/core/domain/focus';
import type { FocusSession, RunningFocus } from '@/core/domain/types';
import { insert, softDeleteBatch } from './write';

export const runningFocus = async () => (await db.meta.get(FOCUS_KEY))?.value as RunningFocus | undefined;

export async function startFocus(input: Omit<RunningFocus, 'startedAt'>, now = Date.now()) {
  if (!(input.plannedMin >= 1 && input.plannedMin <= 240)) throw new Error('Pick between 1 and 240 minutes');
  if (await runningFocus()) throw new Error('A focus session is already running');
  const r: RunningFocus = { ...input, startedAt: now };
  await db.meta.put({ key: FOCUS_KEY, value: r });
  return r;
}

/**
 * End the running session at `now` (or at its planned end if that has passed, e.g. the app
 * was closed). Saves it if at least a minute was worked; returns the session, or null.
 */
export async function stopFocus(now = Date.now()): Promise<FocusSession | null> {
  const r = await runningFocus();
  if (!r) return null;
  await db.meta.delete(FOCUS_KEY);
  const end = Math.min(now, endsAt(r));
  const minutes = workedMinutes(r, end);
  if (minutes < 1) return null;
  return insert<FocusSession>('focusSessions', {
    start: r.startedAt,
    end,
    minutes,
    plannedMin: r.plannedMin,
    taskId: r.taskId,
    nodeId: r.nodeId,
  });
}

/** Give up the running session without saving it. */
export const discardFocus = () => db.meta.delete(FOCUS_KEY);

/** Add more time to the running session. */
export async function extendFocus(min: number) {
  const r = await runningFocus();
  if (r)
    await db.meta.put({ key: FOCUS_KEY, value: { ...r, plannedMin: Math.min(240, r.plannedMin + min) } });
}

export const deleteFocusSession = (id: string) => softDeleteBatch([{ tableName: 'focusSessions', id }]);
