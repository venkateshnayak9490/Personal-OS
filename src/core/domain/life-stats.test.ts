import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN } from './health';
import { gymStats, healthStats, thesisStats } from './life-stats';
import type {
  Checkin,
  Habit,
  HabitLog,
  ThesisChapter,
  WorkoutSession,
  WorkoutSet,
  WritingLog,
} from './types';

const base = { createdAt: 0, updatedAt: 0, version: 1, deviceId: 'd' };
const w = (id: string, date: string, extra: Partial<WorkoutSession> = {}) =>
  ({ ...base, id, date, title: 'W', ...extra }) as WorkoutSession;

describe('life analytics', () => {
  it('gym: only ended workouts count; time, cardio and the plan for the period', () => {
    const sessions = [
      w('a', '2026-11-16', { startedAt: 1, endedAt: 50 * 60_000 }),
      w('b', '2026-11-17', { startedAt: 1 }), // still in progress: not counted
      w('c', '2026-11-18'), // older session without times: counts
      w('d', '2026-11-25', { startedAt: 1, endedAt: 60 * 60_000 }), // next week
    ];
    const sets = [
      {
        ...base,
        id: 's',
        sessionId: 'a',
        exercise: 'Run',
        kind: 'cardio',
        reps: 0,
        weight: 0,
        minutes: 20,
        distanceKm: 3,
      },
    ] as WorkoutSet[];
    const habit = {
      ...base,
      id: 'g',
      title: 'Gym',
      target: { type: 'days', days: [1, 2, 3] },
      restDaysAllowed: true,
    } as Habit;
    const logs = [
      { ...base, id: 'l1', habitId: 'g', date: '2026-11-16', status: 'done' },
      { ...base, id: 'l2', habitId: 'g', date: '2026-11-17', status: 'skipped' },
    ] as HabitLog[];
    const s = gymStats(sessions, sets, habit, logs, '2026-11-16', '2026-11-22', '2026-11-19');
    expect(s.workouts).toBe(2);
    expect(s.minutes).toBe(50);
    expect(s.cardio).toEqual({ minutes: 20, km: 3 });
    expect(s.plan).toMatchObject({ planned: 3, done: 1, skipped: 1, missed: 1 }); // Wed 18 not logged
    expect([...s.perDay]).toEqual([
      ['2026-11-16', 1],
      ['2026-11-18', 1],
    ]);
  });

  it('health: sleep average, on-time record, water, plan items done', () => {
    const plan = {
      ...DEFAULT_PLAN,
      routines: [
        {
          id: 'r',
          title: 'Water',
          mode: 'times' as const,
          times: ['10:00', '14:00'],
          from: '2026-11-01',
          remind: false,
        },
      ],
    };
    const checkins = [
      {
        ...base,
        id: 'c1',
        date: '2026-11-16',
        sleepH: 7,
        wakeTime: '07:10',
        waterGlasses: 8,
        routineDone: { r: ['10:00'] },
      },
      { ...base, id: 'c2', date: '2026-11-17', sleepH: 6, wakeTime: '08:30', waterGlasses: 3 },
      { ...base, id: 'c3', date: '2026-10-01', sleepH: 9 }, // outside the period
    ] as Checkin[];
    const h = healthStats(plan, checkins, '2026-11-16', '2026-11-22');
    expect(h.days).toBe(2);
    expect(h.sleepAvg).toBe(6.5);
    expect(h.onTime.wake).toEqual({ logged: 2, onTime: 1 });
    expect(h.onTime.water).toEqual({ logged: 2, onTime: 1 });
    expect(h.routines).toEqual({ due: 4, marked: 1 });
  });

  it('thesis: net words, sessions, time and overall progress', () => {
    const logs = [
      { ...base, id: 'w1', date: '2026-11-16', chapterId: 'c', words: 1200, delta: 1200, minutes: 90 },
      { ...base, id: 'w2', date: '2026-11-17', chapterId: 'c', words: 1100, delta: -100 },
      { ...base, id: 'w3', date: '2026-10-01', chapterId: 'c', words: 0, delta: 500 },
    ] as WritingLog[];
    const chapters = [
      {
        ...base,
        id: 'c',
        title: 'Intro',
        order: 'a',
        targetWords: 4000,
        currentWords: 1100,
        status: 'drafting',
      },
    ] as ThesisChapter[];
    const t = thesisStats(logs, chapters, '2026-11-16', '2026-11-22');
    expect(t).toMatchObject({ words: 1100, sessions: 2, days: 2, minutes: 90, current: 1100, target: 4000 });
  });

  it('days before the Gym habit existed are never planned, so never missed', () => {
    const created = new Date(2026, 10, 18, 7, 30).getTime(); // made on Wednesday
    const habit = {
      ...base,
      createdAt: created,
      id: 'g',
      title: 'Gym',
      target: { type: 'days', days: [1, 2, 3, 4, 5, 6] },
      restDaysAllowed: true,
    } as Habit;
    const s = gymStats([], [], habit, [], '2026-11-16', '2026-11-22', '2026-11-20');
    expect(s.plan).toMatchObject({ planned: 2, missed: 2 }); // Wed and Thu only (Fri is today)
  });
});
