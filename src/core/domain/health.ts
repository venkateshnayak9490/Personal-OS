import type { DueReminder } from './reminders';
import { dueInstant } from './tasks';
import type { Checkin, HealthEvent, HealthStamp, LocalDate } from './types';

/** Your daily health plan (times are "HH:mm", local). Kept in profile settings, so it syncs. */
export interface HealthPlan {
  wake: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  bed: string;
  waterTarget: number;
  /** A water nudge every this many hours, from waking until bed. */
  waterEveryH: number;
  remind: { meals: boolean; water: boolean; bed: boolean };
  /**
   * A time can be a window instead of an exact time: wake up between 05:00 and 06:00, bed between
   * 23:00 and 00:00. The start is the plan's time above; this is the end. Inside it is on time.
   */
  windows?: Partial<Record<PlanTime, string>>;
  /** Your own plan items: "Drink water every 2 hours", "Stretch at 11:00 and 16:00", … */
  routines?: HealthRoutine[];
}

/**
 * A plan item that repeats. Either every N minutes / hours / days, from a start time (to an optional
 * end time) or at exact times of day; active from `from` (and until `until`, if set).
 */
export interface HealthRoutine {
  id: string;
  title: string;
  mode: 'interval' | 'times';
  every?: number;
  unit?: 'min' | 'h' | 'd';
  /** "HH:mm": the first occurrence of the day (interval). */
  start?: string;
  /** "HH:mm": no occurrences after this (interval, minutes or hours). Default: end of the day. */
  end?: string;
  /** "HH:mm" each (exact times). */
  times?: string[];
  /** Active period. `from` is also where "every N days" counts from. */
  from: LocalDate;
  until?: LocalDate;
  paused?: boolean;
  remind: boolean;
}

export const UNIT_LABEL = { min: 'minutes', h: 'hours', d: 'days' } as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The shortest repeat allowed, so a typo can't flood you with reminders. */
export const MIN_EVERY_MIN = 15;

/** What's wrong with a plan item, or null if it's fine. */
export function routineProblem(r: Omit<HealthRoutine, 'id'>): string | null {
  if (!r.title.trim()) return 'Give it a name';
  if (r.until && r.until < r.from) return 'The end date is before the start date';
  if (r.mode === 'times') {
    if (!r.times?.length) return 'Add at least one time';
    if (r.times.some((t) => !HHMM.test(t))) return 'Use times like 08:30';
    return null;
  }
  if (!r.every || !(r.every >= 1) || !Number.isInteger(r.every)) return 'Repeat every 1 or more';
  if (!r.unit) return 'Choose minutes, hours or days';
  if (!r.start || !HHMM.test(r.start)) return 'Choose a start time';
  if (r.unit !== 'd') {
    if (r.every * (r.unit === 'h' ? 60 : 1) < MIN_EVERY_MIN)
      return `Repeat at most every ${MIN_EVERY_MIN} minutes`;
    if (r.end && (!HHMM.test(r.end) || toMin(r.end) <= toMin(r.start)))
      return 'The end time must be after the start';
  }
  return null;
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dayNo = (d: LocalDate) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/** A plan item's occurrences on a day ("HH:mm", in order). None while paused or outside its period. */
export function routineSlots(r: HealthRoutine, date: LocalDate): string[] {
  if (r.paused || date < r.from || (r.until && date > r.until)) return [];
  if (r.mode === 'times') return [...new Set(r.times ?? [])].filter((t) => HHMM.test(t)).sort();
  if (!r.every || !r.start || !HHMM.test(r.start)) return [];
  if (r.unit === 'd') return (dayNo(date) - dayNo(r.from)) % r.every === 0 ? [r.start] : [];
  const step = r.every * (r.unit === 'h' ? 60 : 1);
  if (step < MIN_EVERY_MIN) return [];
  const end = r.end && HHMM.test(r.end) ? toMin(r.end) : 24 * 60 - 1;
  const out: string[] = [];
  for (let m = toMin(r.start); m <= end; m += step) out.push(hhmm(m));
  return out;
}

export type SlotState = 'done' | 'due' | 'upcoming' | 'missed';

/**
 * Each occurrence: done (you marked it), due (the latest one that has come), upcoming, or missed
 * (its time passed and a later one came, or the day is over). `nowMin` is null for a past day.
 */
export function slotStates(slots: string[], done: string[] = [], nowMin: number | null) {
  const came = (t: string) => nowMin === null || toMin(t) <= nowMin;
  const latest = nowMin === null ? -1 : slots.findLastIndex(came);
  return slots.map((time, i) => ({
    time,
    state: (done.includes(time)
      ? 'done'
      : !came(time)
        ? 'upcoming'
        : i === latest
          ? 'due'
          : 'missed') as SlotState,
  }));
}

/** "Every 2 hours, 08:00–20:00" / "At 08:00, 14:00" / "Every 3 days at 09:00". */
export function routineLabel(r: HealthRoutine): string {
  if (r.mode === 'times') return `At ${(r.times ?? []).slice().sort().join(', ')}`;
  const n = r.every ?? 1;
  const unit = n === 1 ? UNIT_LABEL[r.unit ?? 'h'].replace(/s$/, '') : UNIT_LABEL[r.unit ?? 'h'];
  const every = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}`;
  return r.unit === 'd'
    ? `${every} at ${r.start}`
    : `${every}, ${r.start}${r.end ? `–${r.end}` : ' onwards'}`;
}

export type PlanTime = 'wake' | 'breakfast' | 'lunch' | 'dinner' | 'bed';

export const DEFAULT_PLAN: HealthPlan = {
  wake: '07:00',
  breakfast: '08:30',
  lunch: '13:30',
  dinner: '20:30',
  bed: '23:00',
  waterTarget: 8,
  waterEveryH: 2,
  remind: { meals: true, water: true, bed: true },
};

/** Your saved plan, or null if you haven't set one up (then nothing reminds you). */
export function planOf(settings?: Record<string, unknown>): HealthPlan | null {
  const p = settings?.healthPlan as Partial<HealthPlan> | undefined;
  return p ? { ...DEFAULT_PLAN, ...p, remind: { ...DEFAULT_PLAN.remind, ...p.remind } } : null;
}

/** The device's timezone right now (follows the phone when you travel). */
export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** The moment of a tap, with the device's timezone, local date and local time. */
export function stampAt(at: number, tz: string = deviceTz()): HealthStamp {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  return { at, tz, date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The check-in day a log belongs to. Bedtime belongs to the morning after (before noon: already it). */
export function dayFor(event: HealthEvent, s: HealthStamp): LocalDate {
  if (event !== 'bed' || Number(s.time.slice(0, 2)) < 12) return s.date;
  const d = new Date(`${s.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The time to show for a stamp. */
export const shownTime = (s: HealthStamp) => s.corrected ?? s.time;

export const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** How late still counts as on time. Meals: within 45 min either way. Bed and waking: up to 30 min late. */
export const MEAL_SLACK_MIN = 45;
export const SLEEP_SLACK_MIN = 30;

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};
/** Bedtimes after midnight count as late the night before (00:30 → 24:30). */
const bedMin = (hhmm: string) => (toMin(hhmm) < 12 * 60 ? toMin(hhmm) + 24 * 60 : toMin(hhmm));

export function sleepHours(bed: string, wake: string): number {
  const mins = toMin(wake) + 24 * 60 - bedMin(bed);
  return Math.round((((mins % (24 * 60)) + 24 * 60) % (24 * 60)) / 6) / 10;
}

export type Timing = 'on_time' | 'late' | 'early';

/** With a window (`to`), inside it is on time; before is early, after is late. */
export function mealTiming(planned: string, actual: string, to?: string): Timing {
  if (to) return toMin(actual) < toMin(planned) ? 'early' : toMin(actual) <= toMin(to) ? 'on_time' : 'late';
  const d = toMin(actual) - toMin(planned);
  return Math.abs(d) <= MEAL_SLACK_MIN ? 'on_time' : d > 0 ? 'late' : 'early';
}

/** Bed: by the end of the window (or the time plus 30 min) is on time; earlier is fine too. */
export const bedTiming = (planned: string, actual: string, to?: string): Timing =>
  bedMin(actual) <= (to ? bedMin(to) : bedMin(planned) + SLEEP_SLACK_MIN) ? 'on_time' : 'late';

export const wakeTiming = (planned: string, actual: string, to?: string): Timing =>
  toMin(actual) <= (to ? toMin(to) : toMin(planned) + SLEEP_SLACK_MIN) ? 'on_time' : 'late';

/** "05:00–06:00" for a window, else the time. */
export const planTime = (plan: HealthPlan, k: PlanTime) =>
  plan.windows?.[k] ? `${plan[k]}–${plan.windows[k]}` : plan[k];

/** What's wrong with the plan's windows, or null. Bed windows may run past midnight. */
export function windowProblem(plan: HealthPlan): string | null {
  for (const [k, to] of Object.entries(plan.windows ?? {}) as [PlanTime, string | undefined][]) {
    if (!to) continue;
    const ok = k === 'bed' ? bedMin(to) > bedMin(plan.bed) : toMin(to) > toMin(plan[k]);
    if (!ok)
      return `The ${k === 'wake' ? 'wake-up' : k === 'bed' ? 'bedtime' : k} window must end after it starts`;
  }
  return null;
}

/** Water nudges: every `waterEveryH` hours after waking, before bed. */
export function waterSlots(plan: HealthPlan): string[] {
  const out: string[] = [];
  const end = bedMin(plan.bed);
  for (let m = toMin(plan.wake) + plan.waterEveryH * 60; m < end; m += plan.waterEveryH * 60)
    out.push(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
}

/**
 * Health reminders due by `now` today: each meal at its time (until logged), bedtime (until
 * tomorrow's check-in has a bedtime), and water at each slot while you're behind the day's pace.
 * Targets use table "health" with ids like "breakfast" or "water".
 */
export function healthReminders(
  plan: HealthPlan,
  today: LocalDate,
  todays: Checkin | undefined,
  tomorrows: Checkin | undefined,
  now: number,
  windowMs: number,
  tz?: string,
): DueReminder[] {
  const out: DueReminder[] = [];
  const push = (id: string, title: string, time: string) => {
    const at = dueInstant({ dueDate: today, dueTime: time }, tz)!;
    if (at <= now && at > now - windowMs)
      out.push({ target: { table: 'health', id }, title, fireAt: at, at });
  };
  if (plan.remind.meals)
    for (const m of MEALS)
      if (!todays?.meals?.[m]) push(m, `Time for ${MEAL_LABEL[m].toLowerCase()}`, plan[m]);
  if (plan.remind.bed && !tomorrows?.bedTime) push('bed', 'Time to sleep', plan.bed);
  // Your plan items: the latest occurrence that has come (each one is a new round), until done.
  for (const r of plan.routines ?? []) {
    if (!r.remind) continue;
    const slots = routineSlots(r, today);
    const done = todays?.routineDone?.[r.id] ?? [];
    const due = slots.filter((t) => dueInstant({ dueDate: today, dueTime: t }, tz)! <= now).at(-1);
    if (due && !done.includes(due)) push(`routine:${r.id}`, r.title, due);
  }
  if (plan.remind.water) {
    // Only the latest slot that has come, and only if you're behind the pace by then.
    const slots = waterSlots(plan);
    const had = todays?.waterGlasses ?? 0;
    const i = slots.findLastIndex((s) => dueInstant({ dueDate: today, dueTime: s }, tz)! <= now);
    const expected = Math.ceil((plan.waterTarget * (i + 1)) / (slots.length + 1));
    if (i >= 0 && had < expected)
      push('water', `Drink water (${had} of ${plan.waterTarget} so far)`, slots[i]!);
  }
  return out;
}

/** On-time record over some days: per item, how many logged and how many on time. */
export function onTimeStats(plan: HealthPlan, checkins: Checkin[]) {
  const stat = () => ({ logged: 0, onTime: 0 });
  const s = { breakfast: stat(), lunch: stat(), dinner: stat(), bed: stat(), wake: stat(), water: stat() };
  for (const c of checkins) {
    for (const m of MEALS) {
      const t = c.meals?.[m];
      if (!t) continue;
      s[m].logged++;
      if (mealTiming(plan[m], t, plan.windows?.[m]) === 'on_time') s[m].onTime++;
    }
    if (c.bedTime) {
      s.bed.logged++;
      if (bedTiming(plan.bed, c.bedTime, plan.windows?.bed) === 'on_time') s.bed.onTime++;
    }
    if (c.wakeTime) {
      s.wake.logged++;
      if (wakeTiming(plan.wake, c.wakeTime, plan.windows?.wake) === 'on_time') s.wake.onTime++;
    }
    if (c.waterGlasses !== undefined) {
      s.water.logged++;
      if (c.waterGlasses >= plan.waterTarget) s.water.onTime++;
    }
  }
  return s;
}
