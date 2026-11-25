/**
 * Between your data and the adaptive-day engine (adapt.ts): today's planned items as engine input,
 * and accepted adjustments laid over tasks and habits wherever times are used (Today, reminders,
 * device notifications). Planned times are never rewritten.
 */
import { addDays, format, parseISO } from 'date-fns';
import { tierOf, type AdaptSettings, type DayItem } from './adapt';
import { occurrences } from './events';
import { MEALS, MEAL_LABEL, toMin, type HealthPlan } from './health';
import { isScheduled } from './progress';
import type { CalendarEvent, Checkin, DayPlan, Habit, LocalDate, Task } from './types';

export interface DaySource {
  date: LocalDate;
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  /** Habits checked in for this date, or done for the week: not planned again. */
  quiet: Set<string>;
  plan: HealthPlan | null;
  checkin?: Checkin;
  /** The day's earlier adjustments: times you set yourself are kept. */
  existing?: DayPlan;
  adapt: AdaptSettings;
}

/** Midnight of `date` on this device. shortcut: device time zone, like the Today strip; travel mid-day isn't handled. */
const dayStart = (date: LocalDate) => parseISO(date).getTime();

/** The day's planned items, as the engine reads them. */
export function dayItems(s: DaySource): DayItem[] {
  const manual = new Map(
    (s.existing?.items ?? [])
      .filter((i) => i.source === 'manual' && i.state === 'accepted')
      .map((i) => [i.ref, i.adjustedStart]),
  );
  const out: DayItem[] = [];
  const from = dayStart(s.date);
  const to = dayStart(format(addDays(parseISO(s.date), 1), 'yyyy-MM-dd'));
  for (const e of s.events)
    for (const o of occurrences(e, from, to))
      if (!o.event.allDay)
        out.push({
          ref: `events:${e.id}@${o.start}`,
          title: e.title,
          start: Math.round((Math.max(o.start, from) - from) / 60_000),
          min: Math.round((Math.min(o.end, to) - Math.max(o.start, from)) / 60_000),
          kind: 'fixed',
          tier: 3,
        });
  for (const t of s.tasks) {
    if (t.deletedAt || t.parentTaskId || t.dueDate !== s.date || !t.dueTime) continue;
    if (t.status === 'completed' || t.status === 'cancelled' || t.status === 'skipped') continue;
    out.push({
      ref: `tasks:${t.id}`,
      title: t.title,
      start: toMin(t.dueTime),
      min: t.estimateMin || s.adapt.defaults.task,
      kind: t.status === 'in_progress' ? 'done' : t.fixed || t.kind === 'deadline' ? 'fixed' : 'flexible',
      tier: tierOf({ type: 'task', priority: t.priority, optional: t.optional }),
      after: t.afterId ? `tasks:${t.afterId}` : undefined,
    });
  }
  for (const h of s.habits) {
    if (h.deletedAt || !h.remindAt || s.quiet.has(h.id) || !isScheduled(h, s.date)) continue;
    out.push({
      ref: `habits:${h.id}`,
      title: h.title,
      start: toMin(h.remindAt),
      min: h.durationMin || (h.source === 'gym' ? s.adapt.defaults.gym : s.adapt.defaults.habit),
      kind: h.fixed ? 'fixed' : 'flexible',
      tier: tierOf({ type: 'habit', optional: h.optional }),
    });
  }
  if (s.plan)
    for (const meal of MEALS) {
      if (s.checkin?.meals?.[meal] || s.checkin?.stamps?.[meal]) continue; // eaten already
      out.push({
        ref: `health:${meal}`,
        title: MEAL_LABEL[meal],
        start: toMin(s.plan[meal]),
        min: s.adapt.defaults.meal,
        kind: 'flexible',
        tier: 3,
        anchored: true,
      });
    }
  return out.map((i) => (manual.has(i.ref) ? { ...i, manual: manual.get(i.ref) } : i));
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

/** Accepted adjusted starts by ref. */
export const adjustedOf = (dp?: DayPlan) =>
  new Map((dp?.items ?? []).filter((i) => i.state === 'accepted').map((i) => [i.ref, i.adjustedStart]));

/**
 * Tasks and habits with the day's accepted times in place of the planned ones: tasks due that day
 * get the new due time, habits the new reminder time (pass the result only for that day's use).
 */
export function withAdjusted(dp: DayPlan | undefined, tasks: Task[], habits: Habit[]) {
  const at = adjustedOf(dp);
  if (!dp || !at.size) return { tasks, habits };
  return {
    tasks: tasks.map((t) =>
      t.dueDate === dp.date && at.has(`tasks:${t.id}`)
        ? { ...t, dueTime: hhmm(at.get(`tasks:${t.id}`)!) }
        : t,
    ),
    habits: habits.map((h) =>
      at.has(`habits:${h.id}`) ? { ...h, remindAt: hhmm(at.get(`habits:${h.id}`)!) } : h,
    ),
  };
}
