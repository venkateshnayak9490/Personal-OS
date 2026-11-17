import { addDays, addMonths, addYears, format, getDay, parseISO, startOfWeek } from 'date-fns';
import type { LocalDate } from './types';

/**
 * Repeating tasks use a small, readable subset of RFC 5545 RRULE:
 * FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL=n, BYDAY=MO,TU,… (weekly only).
 * Each occurrence is its own task, created when the previous one is closed, so history stays honest.
 */

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Rule {
  freq: Freq;
  interval: number;
  byDay?: Weekday[];
}

export function parseRRule(rrule: string): Rule {
  const parts = Object.fromEntries(
    rrule.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k?.toUpperCase(), v ?? ''];
    }),
  );
  const freq = (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).find((f) => f === parts.FREQ) ?? 'DAILY';
  const interval = Math.max(1, Number(parts.INTERVAL) || 1);
  const byDay = parts.BYDAY
    ? (parts.BYDAY.split(',').filter((d: string) => (WEEKDAYS as readonly string[]).includes(d)) as Weekday[])
    : undefined;
  return { freq, interval, byDay: byDay?.length ? byDay : undefined };
}

export function formatRRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'WEEKLY' && rule.byDay?.length) parts.push(`BYDAY=${sortDays(rule.byDay).join(',')}`);
  return parts.join(';');
}

const sortDays = (days: Weekday[]) =>
  [...new Set(days)].sort((a, b) => ((WEEKDAYS.indexOf(a) + 6) % 7) - ((WEEKDAYS.indexOf(b) + 6) % 7));

const DAY_NAME: Record<Weekday, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

/** "Every day", "Every weekday", "Every 2 weeks on Mon, Thu", "Every month". */
export function describeRule(rule: Rule): string {
  const n = rule.interval;
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[rule.freq];
  const every = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  if (rule.freq === 'WEEKLY' && rule.byDay?.length) {
    const days = sortDays(rule.byDay);
    if (n === 1 && days.join() === 'MO,TU,WE,TH,FR') return 'Every weekday';
    if (n === 1 && days.length === 7) return 'Every day';
    return `${every} on ${days.map((d) => DAY_NAME[d]).join(', ')}`;
  }
  return every;
}

export const weekdayOf = (date: LocalDate): Weekday => WEEKDAYS[getDay(parseISO(date))]!;

/** The next occurrence strictly after `from`. */
export function nextDate(rule: Rule, from: LocalDate): LocalDate {
  const d = parseISO(from);
  const n = rule.interval;
  switch (rule.freq) {
    case 'DAILY':
      return format(addDays(d, n), 'yyyy-MM-dd');
    case 'MONTHLY':
      return format(addMonths(d, n), 'yyyy-MM-dd');
    case 'YEARLY':
      return format(addYears(d, n), 'yyyy-MM-dd');
    case 'WEEKLY': {
      if (!rule.byDay?.length) return format(addDays(d, 7 * n), 'yyyy-MM-dd');
      const days = new Set(rule.byDay);
      // Later this week?
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      for (let i = 1; i < 7; i++) {
        const c = addDays(d, i);
        if (startOfWeek(c, { weekStartsOn: 1 }).getTime() !== weekStart.getTime()) break;
        if (days.has(WEEKDAYS[getDay(c)]!)) return format(c, 'yyyy-MM-dd');
      }
      // Otherwise the first matching day of the week `n` weeks later.
      const target = addDays(weekStart, 7 * n);
      for (let i = 0; i < 7; i++) {
        const c = addDays(target, i);
        if (days.has(WEEKDAYS[getDay(c)]!)) return format(c, 'yyyy-MM-dd');
      }
      return format(addDays(d, 7 * n), 'yyyy-MM-dd');
    }
  }
}

/** Presets offered in the task editor. */
export type RepeatPreset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export function presetRule(preset: RepeatPreset, due: LocalDate): Rule | null {
  switch (preset) {
    case 'none':
      return null;
    case 'daily':
      return { freq: 'DAILY', interval: 1 };
    case 'weekdays':
      return { freq: 'WEEKLY', interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] };
    case 'weekly':
      return { freq: 'WEEKLY', interval: 1, byDay: [weekdayOf(due)] };
    case 'biweekly':
      return { freq: 'WEEKLY', interval: 2, byDay: [weekdayOf(due)] };
    case 'monthly':
      return { freq: 'MONTHLY', interval: 1 };
    case 'yearly':
      return { freq: 'YEARLY', interval: 1 };
  }
}

/** Best preset for a rule (for the editor's select); 'custom' if none matches. */
export function presetOf(rule: Rule | null): RepeatPreset | 'custom' {
  if (!rule) return 'none';
  if (rule.freq === 'DAILY' && rule.interval === 1) return 'daily';
  if (rule.freq === 'MONTHLY' && rule.interval === 1) return 'monthly';
  if (rule.freq === 'YEARLY' && rule.interval === 1) return 'yearly';
  if (rule.freq === 'WEEKLY') {
    const days = sortDays(rule.byDay ?? []).join();
    if (rule.interval === 1 && days === 'MO,TU,WE,TH,FR') return 'weekdays';
    if ((rule.byDay?.length ?? 0) <= 1)
      return rule.interval === 1 ? 'weekly' : rule.interval === 2 ? 'biweekly' : 'custom';
  }
  return 'custom';
}
