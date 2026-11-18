import type { WorkoutSession, WorkoutSet } from './types';

/** Estimated one-rep max (Epley). Reps above 12 make it unreliable, so they don't count. */
export const e1rm = (s: Pick<WorkoutSet, 'reps' | 'weight'>) =>
  s.reps >= 1 && s.reps <= 12 && s.weight > 0 ? s.weight * (1 + s.reps / 30) : 0;

/** Same exercise whatever the spacing or capitals. */
export const exerciseKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface PR {
  heaviest: number;
  e1rm: number;
}

/**
 * Personal records reached by each set, judged against everything logged before it
 * (earlier days, or earlier in the same workout). Returns the set ids that set a record.
 */
export function prSets(sessions: WorkoutSession[], sets: WorkoutSet[]): Set<string> {
  const when = new Map(sessions.map((s) => [s.id, `${s.date}|${String(s.createdAt).padStart(15, '0')}`]));
  const ordered = sets
    .filter((s) => when.has(s.sessionId) && !s.deletedAt)
    .sort(
      (a, b) => when.get(a.sessionId)!.localeCompare(when.get(b.sessionId)!) || (a.order < b.order ? -1 : 1),
    );
  const best = new Map<string, PR>();
  const out = new Set<string>();
  for (const s of ordered) {
    const k = exerciseKey(s.exercise);
    const prev = best.get(k);
    const est = e1rm(s);
    if (prev && (s.weight > prev.heaviest || est > prev.e1rm + 0.01)) out.add(s.id);
    best.set(k, { heaviest: Math.max(prev?.heaviest ?? 0, s.weight), e1rm: Math.max(prev?.e1rm ?? 0, est) });
  }
  return out;
}

/** Best so far per exercise (for the exercise list). */
export function bests(sets: WorkoutSet[]): Map<string, { name: string } & PR> {
  const m = new Map<string, { name: string } & PR>();
  for (const s of sets) {
    if (s.deletedAt) continue;
    const k = exerciseKey(s.exercise);
    const cur = m.get(k);
    m.set(k, {
      name: cur?.name ?? s.exercise.trim(),
      heaviest: Math.max(cur?.heaviest ?? 0, s.weight),
      e1rm: Math.max(cur?.e1rm ?? 0, e1rm(s)),
    });
  }
  return m;
}
