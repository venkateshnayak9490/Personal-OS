import type { DueReminder } from './reminders';
import { dueInstant } from './tasks';
import type { Checkin, LocalDate } from './types';

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
}

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

export function mealTiming(planned: string, actual: string): Timing {
  const d = toMin(actual) - toMin(planned);
  return Math.abs(d) <= MEAL_SLACK_MIN ? 'on_time' : d > 0 ? 'late' : 'early';
}

export const bedTiming = (planned: string, actual: string): Timing =>
  bedMin(actual) <= bedMin(planned) + SLEEP_SLACK_MIN ? 'on_time' : 'late';

export const wakeTiming = (planned: string, actual: string): Timing =>
  toMin(actual) <= toMin(planned) + SLEEP_SLACK_MIN ? 'on_time' : 'late';

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
      if (mealTiming(plan[m], t) === 'on_time') s[m].onTime++;
    }
    if (c.bedTime) {
      s.bed.logged++;
      if (bedTiming(plan.bed, c.bedTime) === 'on_time') s.bed.onTime++;
    }
    if (c.wakeTime) {
      s.wake.logged++;
      if (wakeTiming(plan.wake, c.wakeTime) === 'on_time') s.wake.onTime++;
    }
    if (c.waterGlasses !== undefined) {
      s.water.logged++;
      if (c.waterGlasses >= plan.waterTarget) s.water.onTime++;
    }
  }
  return s;
}
