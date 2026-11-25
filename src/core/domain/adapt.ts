/**
 * The adaptive day (docs/proposals/ADAPTIVE_DAY_AND_PUSH.md §3): given the planned day, when you woke
 * and what's fixed, work out where the movable things go. Pure and deterministic: no clock, no I/O.
 *
 * Times are minutes from the start of the day you woke into, so 01:00 after a late night is 1500,
 * not 60 (the same rule Health uses to file sleep).
 */
import type { Priority } from './types';

export interface AdaptSettings {
  /** Off: never adjust. Suggest: show the changes to accept. Automatic: apply, with Undo. */
  mode: 'off' | 'suggest' | 'auto';
  /** Only propose when something moves at least this much. */
  thresholdMin: number;
  /** Free time kept after each item. */
  bufferMin: number;
  /** Durations used when an item has none of its own. */
  defaults: { task: number; habit: number; gym: number; meal: number };
}

export const DEFAULT_ADAPT: AdaptSettings = {
  mode: 'suggest',
  thresholdMin: 20,
  bufferMin: 10,
  defaults: { task: 30, habit: 30, gym: 60, meal: 30 },
};

export function adaptOf(settings?: Record<string, unknown>): AdaptSettings {
  const a = settings?.adapt as Partial<AdaptSettings> | undefined;
  return { ...DEFAULT_ADAPT, ...a, defaults: { ...DEFAULT_ADAPT.defaults, ...a?.defaults } };
}

/** Placement order: 1 P1 tasks, 2 habits due today, 3 P2/P3 tasks and plan items, 4 optional and P4. */
export type Tier = 1 | 2 | 3 | 4;

export function tierOf(i: {
  type: 'task' | 'habit' | 'plan';
  priority?: Priority;
  optional?: boolean;
}): Tier {
  if (i.optional || (i.type === 'task' && i.priority === 4)) return 4;
  if (i.type === 'task' && i.priority === 1) return 1;
  return i.type === 'habit' ? 2 : 3;
}

export interface DayItem {
  /** "tasks:<id>", "habits:<id>", "health:lunch", … */
  ref: string;
  title: string;
  /** Planned start (day minutes) and length. */
  start: number;
  min: number;
  /**
   * fixed: never moved (events, deadlines, things you marked Fixed time).
   * done: done or in progress; it keeps its time and is never touched.
   * flexible: may move, keeping its length and order.
   */
  kind: 'fixed' | 'done' | 'flexible';
  tier: Tier;
  /** Moves with your wake-up time (meals): its planned time shifts by how late you woke. */
  anchored?: boolean;
  /** Must start after this item ends ("do after …"). */
  after?: string;
  /** A time you set yourself on an earlier adjustment; a re-plan keeps it. */
  manual?: number;
}

export interface DayInput {
  plannedWake: number;
  /** Actual wake-up, or the projected one. */
  wake: number;
  /** The planned bedtime tonight. A late night yesterday doesn't pull it earlier. */
  bed: number;
  now: number;
  items: DayItem[];
  bufferMin: number;
  thresholdMin: number;
}

export interface Placement {
  ref: string;
  title: string;
  plannedStart: number;
  start: number;
  /** Why it isn't at its planned time (empty when it is). */
  reason: string;
}

export interface PlanResult {
  /** Every flexible item placed today, in time order. */
  placed: Placement[];
  /** Didn't fit before bedtime: offered for another day, never dropped. */
  deferred: Placement[];
  /** Something moved by at least the threshold, or had to be deferred: worth proposing. */
  propose: boolean;
}

export const clock = (m: number) => {
  const d = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};
const span = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;

interface Busy {
  from: number;
  to: number;
  title: string;
}

/**
 * Greedy placement in priority order into the free time between waking and bed. Each flexible item
 * goes into the first gap, at or after the earliest it may start, that it fits whole: never split,
 * never squeezed. The earliest start is the latest of its planned time (meals: shifted by a late
 * wake-up), now, waking, the end of what it comes after, and the end of the previous item of its tier.
 * Items ahead of you that nothing pushes keep their planned time, so a late morning only moves what
 * it actually runs into.
 */
export function planDay(d: DayInput): PlanResult {
  const late = Math.max(0, d.wake - d.plannedWake);
  const busy: Busy[] = [];
  const ends = new Map<string, number>();
  const take = (from: number, to: number, title: string, ref: string) => {
    busy.push({ from, to, title });
    ends.set(ref, to);
  };
  for (const i of d.items)
    if (i.kind !== 'flexible') take(i.start, i.start + i.min, i.title, i.ref);
    else if (i.manual !== undefined) take(i.manual, i.manual + i.min, i.title, i.ref);

  const placed: Placement[] = d.items
    .filter((i) => i.kind === 'flexible' && i.manual !== undefined)
    .map((i) => ({
      ref: i.ref,
      title: i.title,
      plannedStart: i.start,
      start: i.manual!,
      reason: 'Your time',
    }));
  const deferred: Placement[] = [];
  const todo = d.items
    .filter((i) => i.kind === 'flexible' && i.manual === undefined)
    .sort((a, b) => a.tier - b.tier || a.start - b.start);
  const prevInTier = new Map<Tier, DayItem>();

  for (const i of todo) {
    // [earliest start, why, is it the end of another item (then the buffer applies)]
    const floors: [number, string, boolean][] = [
      [i.anchored ? i.start + late : i.start, i.anchored && late ? `You woke ${span(late)} late` : '', false],
      [d.wake, `You woke at ${clock(d.wake)}`, false],
      [d.now, 'Its time has passed', false],
    ];
    const after = i.after ? d.items.find((x) => x.ref === i.after) : undefined;
    if (after && ends.has(after.ref)) floors.push([ends.get(after.ref)!, `After ${after.title}`, true]);
    const prev = prevInTier.get(i.tier);
    if (prev && ends.has(prev.ref)) floors.push([ends.get(prev.ref)!, `After ${prev.title}`, true]);
    const floor = floors.reduce((a, b) => (b[0] > a[0] ? b : a));
    let [at, why] = floor;
    const fromEnd = floor[2];
    // Untouched when nothing pushes it; the buffer only shapes where moved things land.
    if (at !== i.start || clash(busy, at, at + i.min, 0)) {
      if (fromEnd) at += d.bufferMin;
      // Step past anything in the way until it fits whole.
      for (
        let hit = clash(busy, at, at + i.min, d.bufferMin);
        hit;
        hit = clash(busy, at, at + i.min, d.bufferMin)
      ) {
        at = hit.to + d.bufferMin;
        why = `${hit.title} is at ${clock(hit.from)}`;
      }
    }
    const p = {
      ref: i.ref,
      title: i.title,
      plannedStart: i.start,
      start: at,
      reason: at === i.start ? '' : why,
    };
    if (at + i.min > d.bed) {
      deferred.push({ ...p, start: i.start, reason: 'Doesn’t fit before bedtime' });
      continue;
    }
    placed.push(p);
    take(at, at + i.min, i.title, i.ref);
    prevInTier.set(i.tier, i);
  }
  placed.sort((a, b) => a.start - b.start);
  return {
    placed,
    deferred,
    propose: deferred.length > 0 || placed.some((p) => Math.abs(p.start - p.plannedStart) >= d.thresholdMin),
  };
}

/** What overlaps [from, to), keeping `buffer` free after each busy item and before it (latest-ending first). */
function clash(busy: Busy[], from: number, to: number, buffer: number): Busy | undefined {
  return busy.filter((b) => b.from < to + buffer && from < b.to + buffer).sort((a, b) => b.to - a.to)[0];
}

/** After "Going to bed": when you'll wake, never earlier than planned, and never on less than target sleep. */
export const projectedWake = (bedAt: number, plannedWake: number, targetH: number) =>
  Math.max(plannedWake + 1440, bedAt + targetH * 60) - 1440;

export interface SleepNote {
  level: 'note' | 'warn';
  text: string;
}

/**
 * Sleep is never shortened silently: if something fixed tomorrow starts before you'd have had your
 * target sleep, say so; below your minimum, it's a warning. `bedAt` in tonight's day minutes,
 * `fixedTomorrow` in tomorrow's.
 */
export function sleepCheck(
  bedAt: number,
  fixedTomorrow: Pick<DayItem, 'title' | 'start'>[],
  targetH: number,
  minH: number,
): SleepNote | null {
  const first = fixedTomorrow
    .filter((i) => i.start + 1440 < bedAt + targetH * 60)
    .sort((a, b) => a.start - b.start)[0];
  if (!first) return null;
  const left = Math.max(0, first.start + 1440 - bedAt);
  const h = Math.floor(left / 6) / 10;
  return {
    level: left < minH * 60 ? 'warn' : 'note',
    text: `Your ${clock(first.start)} ${first.title} leaves ${h} h sleep`,
  };
}
