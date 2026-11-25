import { describe, expect, it } from 'vitest';
import {
  bedTiming,
  dayFor,
  stampAt,
  DEFAULT_PLAN,
  healthReminders,
  mealTiming,
  onTimeStats,
  planOf,
  planTime,
  wakeTiming,
  windowProblem,
  routineProblem,
  routineSlots,
  slotStates,
  sleepHours,
  sleepProblem,
  waterSlots,
  type HealthRoutine,
} from './health';
import type { Checkin } from './types';

describe('sleep target and minimum', () => {
  it('defaults to 7 and 6 hours, also for plans saved before they existed', () => {
    expect(planOf({ healthPlan: { wake: '06:00' } })).toMatchObject({ sleepTargetH: 7, sleepMinH: 6 });
  });
  it('names a bad value instead of saving it', () => {
    expect(sleepProblem({ sleepTargetH: 7.5, sleepMinH: 6 })).toBeNull();
    expect(sleepProblem({ sleepTargetH: NaN, sleepMinH: 6 })).toMatch(/target/);
    expect(sleepProblem({ sleepTargetH: 7, sleepMinH: 2 })).toMatch(/Least/);
    expect(sleepProblem({ sleepTargetH: 6, sleepMinH: 7 })).toMatch(/more than the target/);
  });
});

const at = (s: string) => new Date(s).getTime();
const HOUR = 3_600_000;

describe('health plan', () => {
  it('only exists once you set it up', () => {
    expect(planOf({})).toBeNull();
    expect(planOf({ healthPlan: { bed: '22:30' } })).toMatchObject({ bed: '22:30', lunch: '13:30' });
  });

  it('judges meals within 45 minutes as on time', () => {
    expect(mealTiming('13:30', '14:10')).toBe('on_time');
    expect(mealTiming('13:30', '14:30')).toBe('late');
    expect(mealTiming('13:30', '12:20')).toBe('early');
  });

  it('bedtime after midnight is late, not early', () => {
    expect(bedTiming('23:00', '23:25')).toBe('on_time');
    expect(bedTiming('23:00', '00:40')).toBe('late');
    expect(bedTiming('00:30', '23:50')).toBe('on_time');
  });

  it('works out hours slept across midnight', () => {
    expect(sleepHours('23:00', '07:00')).toBe(8);
    expect(sleepHours('00:30', '07:00')).toBe(6.5);
    expect(sleepHours('22:15', '05:45')).toBe(7.5);
  });

  it('spreads water nudges between waking and bed', () => {
    expect(waterSlots(DEFAULT_PLAN)).toEqual(['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);
  });

  it('reminds at meal time until you log it, and about water only when behind', () => {
    const day = '2026-11-18';
    const now = at('2026-11-18T13:35');
    const due = (c?: Checkin) =>
      healthReminders(DEFAULT_PLAN, day, c, undefined, now, 6 * HOUR).map((r) => r.target.id);
    expect(due()).toEqual(['breakfast', 'lunch', 'water']); // one water nudge, the latest
    const fed = { date: day, meals: { breakfast: '08:40', lunch: '13:32' }, waterGlasses: 4 } as Checkin;
    expect(due(fed)).toEqual([]);
    // Bedtime: until tomorrow's check-in has a bedtime.
    const night = at('2026-11-18T23:05');
    const bed = (next?: Checkin) =>
      healthReminders(
        { ...DEFAULT_PLAN, remind: { meals: false, water: false, bed: true } },
        day,
        undefined,
        next,
        night,
        6 * HOUR,
      );
    expect(bed().map((r) => r.title)).toEqual(['Time to sleep']);
    expect(bed({ date: '2026-11-19', bedTime: '23:02' } as Checkin)).toEqual([]);
  });

  it('counts the on-time record', () => {
    const s = onTimeStats(DEFAULT_PLAN, [
      { date: '2026-11-17', meals: { lunch: '13:40' }, bedTime: '23:10', waterGlasses: 8 } as Checkin,
      { date: '2026-11-18', meals: { lunch: '15:00' }, bedTime: '01:00', waterGlasses: 5 } as Checkin,
    ]);
    expect(s.lunch).toEqual({ logged: 2, onTime: 1 });
    expect(s.bed).toEqual({ logged: 2, onTime: 1 });
    expect(s.water).toEqual({ logged: 2, onTime: 1 });
  });

  it('stamps a tap with the device timezone, local date and time', () => {
    const at = Date.UTC(2026, 10, 18, 2, 12); // 07:42 in India
    expect(stampAt(at, 'Asia/Kolkata')).toEqual({
      at,
      tz: 'Asia/Kolkata',
      date: '2026-11-18',
      time: '07:42',
    });
    // Same instant somewhere else: its own local day and time.
    expect(stampAt(at, 'America/Los_Angeles')).toMatchObject({ date: '2026-11-17', time: '18:12' });
    // Across a DST change (US, 1 Nov 2026): local time follows the zone's rules.
    expect(stampAt(Date.UTC(2026, 10, 1, 15, 0), 'America/New_York').time).toBe('10:00');
  });

  it('bedtime belongs to the morning after; after midnight that is already today', () => {
    expect(dayFor('bed', { at: 0, tz: 'x', date: '2026-11-18', time: '23:10' })).toBe('2026-11-19');
    expect(dayFor('bed', { at: 0, tz: 'x', date: '2026-11-19', time: '00:40' })).toBe('2026-11-19');
    expect(dayFor('wake', { at: 0, tz: 'x', date: '2026-11-19', time: '07:00' })).toBe('2026-11-19');
  });
});

describe('repeating plan items', () => {
  const base: HealthRoutine = {
    id: 'w',
    title: 'Drink water',
    mode: 'interval',
    every: 2,
    unit: 'h',
    start: '08:00',
    end: '20:00',
    from: '2026-11-01',
    remind: true,
  };

  it('occurrences: every N minutes, hours or days, or at exact times, inside the active period', () => {
    expect(routineSlots(base, '2026-11-18')).toEqual([
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
      '20:00',
    ]);
    expect(routineSlots({ ...base, every: 90, unit: 'min', end: '12:00' }, '2026-11-18')).toEqual([
      '08:00',
      '09:30',
      '11:00',
    ]);
    // No end time: until the end of the day.
    expect(routineSlots({ ...base, every: 6, end: undefined }, '2026-11-18')).toEqual([
      '08:00',
      '14:00',
      '20:00',
    ]);
    const every3d = { ...base, every: 3, unit: 'd' as const, start: '09:00' };
    expect(['2026-11-01', '2026-11-02', '2026-11-04'].map((d) => routineSlots(every3d, d))).toEqual([
      ['09:00'],
      [],
      ['09:00'],
    ]);
    const exact = { ...base, mode: 'times' as const, times: ['14:00', '09:00', '09:00'] };
    expect(routineSlots(exact, '2026-11-18')).toEqual(['09:00', '14:00']); // sorted, no duplicates
    expect(routineSlots({ ...base, paused: true }, '2026-11-18')).toEqual([]);
    expect(routineSlots(base, '2026-10-31')).toEqual([]); // before it starts
    expect(routineSlots({ ...base, until: '2026-11-10' }, '2026-11-18')).toEqual([]); // after it ends
  });

  it('checks: name, period, at least 15 minutes apart, end after start, times given', () => {
    expect(routineProblem(base)).toBeNull();
    expect(routineProblem({ ...base, title: ' ' })).toMatch(/name/);
    expect(routineProblem({ ...base, every: 5, unit: 'min' })).toMatch(/15 minutes/);
    expect(routineProblem({ ...base, end: '07:00' })).toMatch(/after the start/);
    expect(routineProblem({ ...base, until: '2026-10-01' })).toMatch(/before the start date/);
    expect(routineProblem({ ...base, mode: 'times', times: [] })).toMatch(/at least one time/);
    expect(routineProblem({ ...base, every: 0 })).toMatch(/1 or more/);
  });

  it('done, due (the latest one that has come), missed and later', () => {
    const slots = ['08:00', '10:00', '12:00', '14:00'];
    expect(slotStates(slots, ['08:00'], 12 * 60 + 30).map((s) => s.state)).toEqual([
      'done',
      'missed',
      'due',
      'upcoming',
    ]);
    // A past day: anything not done was missed.
    expect(slotStates(slots, ['10:00'], null).map((s) => s.state)).toEqual([
      'missed',
      'done',
      'missed',
      'missed',
    ]);
  });

  it('reminds for the latest occurrence that has come, until it is marked done', () => {
    const plan = { ...DEFAULT_PLAN, remind: { meals: false, water: false, bed: false }, routines: [base] };
    const now = at('2026-11-18T12:30:00+05:30');
    const due = healthReminders(plan, '2026-11-18', undefined, undefined, now, 6 * HOUR, 'Asia/Kolkata');
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ target: { table: 'health', id: 'routine:w' }, title: 'Drink water' });
    expect(due[0]!.fireAt).toBe(at('2026-11-18T12:00:00+05:30'));
    const done = { routineDone: { w: ['12:00'] } } as unknown as Checkin;
    expect(healthReminders(plan, '2026-11-18', done, undefined, now, 6 * HOUR, 'Asia/Kolkata')).toEqual([]);
    const paused = { ...plan, routines: [{ ...base, paused: true }] };
    expect(
      healthReminders(paused, '2026-11-18', undefined, undefined, now, 6 * HOUR, 'Asia/Kolkata'),
    ).toEqual([]);
  });
});

describe('time windows in the daily plan', () => {
  const plan = {
    ...DEFAULT_PLAN,
    wake: '05:00',
    bed: '23:00',
    lunch: '13:00',
    windows: { wake: '06:00', bed: '00:00', lunch: '14:00' },
  };
  it('inside the window is on time; after it is late; meals before it are early', () => {
    expect(wakeTiming(plan.wake, '05:50', plan.windows.wake)).toBe('on_time');
    expect(wakeTiming(plan.wake, '06:10', plan.windows.wake)).toBe('late');
    expect(bedTiming(plan.bed, '23:40', plan.windows.bed)).toBe('on_time');
    expect(bedTiming(plan.bed, '00:20', plan.windows.bed)).toBe('late');
    expect(mealTiming(plan.lunch, '13:55', plan.windows.lunch)).toBe('on_time');
    expect(mealTiming(plan.lunch, '12:30', plan.windows.lunch)).toBe('early');
    expect(planTime(plan, 'wake')).toBe('05:00–06:00');
    expect(planTime(plan, 'dinner')).toBe(DEFAULT_PLAN.dinner);
    expect(onTimeStats(plan, [{ wakeTime: '05:55' } as Checkin]).wake).toEqual({ logged: 1, onTime: 1 });
  });
  it('a window must end after it starts (bed may run past midnight)', () => {
    expect(windowProblem(plan)).toBeNull();
    expect(windowProblem({ ...plan, windows: { wake: '04:00' } })).toMatch(/wake-up window/);
    expect(windowProblem({ ...plan, windows: { bed: '22:00' } })).toMatch(/bedtime window/);
  });
});
