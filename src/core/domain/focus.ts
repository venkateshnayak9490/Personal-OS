import type { FocusSession, RunningFocus } from './types';

export const FOCUS_KEY = 'focus.running';

/** When the timer should end. */
export const endsAt = (r: RunningFocus) => r.startedAt + r.plannedMin * 60_000;

/** Whole minutes worked from `startedAt` to `until` (never more than planned). */
export const workedMinutes = (r: RunningFocus, until: number) =>
  Math.min(r.plannedMin, Math.floor((until - r.startedAt) / 60_000));

/** Minutes of focus inside [from, to): a session that crosses midnight counts in both days. */
export function focusMinutes(sessions: FocusSession[], from: number, to: number): number {
  let ms = 0;
  for (const s of sessions)
    if (!s.deletedAt) ms += Math.max(0, Math.min(s.end, to) - Math.max(s.start, from));
  return Math.round(ms / 60_000);
}

/** "1h 25m", "45m". */
export const hm = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`;
