import { describe, expect, it } from 'vitest';
import {
  bedTiming,
  DEFAULT_PLAN,
  healthReminders,
  mealTiming,
  onTimeStats,
  planOf,
  sleepHours,
  waterSlots,
} from './health';
import type { Checkin } from './types';

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
});
