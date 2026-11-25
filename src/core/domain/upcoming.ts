import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { datedItems } from './collections';
import { healthReminders, type HealthPlan } from './health';
import {
  dueReminders,
  occasionReminders,
  REMINDER_WINDOW_MS,
  reminderKey,
  type DueReminder,
  type Repeat,
} from './reminders';
import { toLocalDate } from './tasks';
import type { CalendarEvent, Checkin, Collection, CollectionRecord, Habit, LocalDate, Task } from './types';

/** Notification categories you can switch off (Settings → Reminders). */
export const NOTIFY_CATEGORIES = [
  { key: 'tasks', label: 'Tasks and deadlines' },
  { key: 'events', label: 'Events and meetings' },
  { key: 'habits', label: 'Habits' },
  { key: 'gym', label: 'Gym' },
  { key: 'health', label: 'Health plan (meals, water, bedtime, plan items)' },
  { key: 'occasions', label: 'Birthdays and occasions' },
] as const;
export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number]['key'];

/** Categories switched off for device notifications (in-app reminder cards are unaffected). */
export const notifyOff = (settings?: Record<string, unknown>): NotifyCategory[] =>
  Array.isArray((settings?.notify as { off?: unknown })?.off)
    ? (settings!.notify as { off: NotifyCategory[] }).off
    : [];

export interface ReminderInputs {
  events: CalendarEvent[];
  tasks: Task[];
  habits: Habit[];
  /** Habits that shouldn't nag today: checked in already, or the week's target is met. */
  quietToday: Set<string>;
  /** Habits whose target for this week is already met (quiet for the rest of the week). */
  weekMet: Set<string>;
  weekStartsOn: 0 | 1;
  repeat: Repeat;
  plan: HealthPlan | null;
  checkins: Checkin[];
  lists: Collection[];
  records: CollectionRecord[];
  tz?: string;
}

/** Everything due at time `t`, exactly as the in-app reminders work it out (Reminders.tsx). */
export function remindersAt(i: ReminderInputs, t: number, today: LocalDate): DueReminder[] {
  const date = toLocalDate(t, i.tz);
  const sameWeek =
    startOfWeek(parseISO(date), { weekStartsOn: i.weekStartsOn }).getTime() ===
    startOfWeek(parseISO(today), { weekStartsOn: i.weekStartsOn }).getTime();
  const quiet = date === today ? i.quietToday : sameWeek ? i.weekMet : new Set<string>();
  const out = dueReminders(i.events, i.tasks, t, i.tz, i.habits, quiet, i.repeat);
  if (i.plan) {
    const next = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
    out.push(
      ...healthReminders(
        i.plan,
        date,
        i.checkins.find((c) => c.date === date),
        i.checkins.find((c) => c.date === next),
        t,
        REMINDER_WINDOW_MS,
        i.tz,
      ),
    );
  }
  const start = parseISO(date).getTime();
  const items = datedItems(i.lists, i.records, start, start + 8 * 86_400_000, i.tz);
  out.push(...occasionReminders(items, date, t, i.tz));
  return out;
}

export interface Upcoming extends DueReminder {
  key: string;
  category: NotifyCategory;
}

/**
 * Reminders that will fire after `now` and within `hours`, for the push queue. It asks the same
 * question as the in-app reminders ("what's due at t?") every `stepMin` minutes and keeps each
 * reminder once, so device notifications follow exactly the same rules.
 * shortcut: sampling (576 runs for 48 h); fine for a personal data set, replace with a direct
 * "fire times in a range" pass if it ever shows up in a profile.
 */
export function upcomingReminders(i: ReminderInputs, now: number, hours = 48, stepMin = 5): Upcoming[] {
  const today = toLocalDate(now, i.tz);
  const seen = new Map<string, Upcoming>();
  const step = stepMin * 60_000;
  // Start at the next step boundary after now; every fire time in (now, end] is ≤ some sample.
  for (let t = Math.floor(now / step) * step + step; t <= now + hours * 3_600_000 + step; t += step)
    for (const r of remindersAt(i, t, today)) {
      if (r.fireAt <= now || r.fireAt > now + hours * 3_600_000) continue;
      const key = reminderKey(r);
      if (!seen.has(key)) seen.set(key, { ...r, key, category: categoryOf(r, i.habits) });
    }
  return [...seen.values()].sort((a, b) => a.fireAt - b.fireAt);
}

function categoryOf(r: DueReminder, habits: Habit[]): NotifyCategory {
  switch (r.target.table) {
    case 'events':
      return 'events';
    case 'habits':
      return habits.find((h) => h.id === r.target.id)?.source === 'gym' ? 'gym' : 'habits';
    case 'health':
      return 'health';
    case 'records':
      return 'occasions';
    default:
      return 'tasks';
  }
}
