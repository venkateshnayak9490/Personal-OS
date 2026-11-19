import { describe, expect, it } from 'vitest';
import { newBase } from './entity';
import { measuredCurrent, type GoalData } from './goals';
import type { Goal } from './types';

const made = new Date('2026-11-10T09:00:00').getTime();
const goal = (measure: Goal['measure']): Goal =>
  ({ ...newBase('d'), id: 'g', title: 'g', status: 'active', order: 'a0', createdAt: made, measure }) as Goal;
const base = (o: object) => ({ ...newBase('d'), ...o });

const data: GoalData = {
  habits: [base({ id: 'h', goalId: 'g' })] as GoalData['habits'],
  habitLogs: [
    base({ habitId: 'h', date: '2026-11-09', status: 'done' }), // before the goal
    base({ habitId: 'h', date: '2026-11-11', status: 'done' }),
    base({ habitId: 'h', date: '2026-11-12', status: 'skipped' }),
  ] as GoalData['habitLogs'],
  workouts: [
    base({ date: '2026-11-11', startedAt: 1, endedAt: 2 }),
    base({ date: '2026-11-12', startedAt: 1 }), // still going
    base({ date: '2026-11-01', startedAt: 1, endedAt: 2 }), // before the goal
  ] as GoalData['workouts'],
  writing: [
    base({ date: '2026-11-11', delta: 900 }),
    base({ date: '2026-11-12', delta: -150 }),
  ] as GoalData['writing'],
  focus: [
    base({ start: made + 3_600_000, end: made + 3 * 3_600_000 }), // 2 h
    base({ start: made - 3_600_000, end: made }), // before
  ] as GoalData['focus'],
  records: [
    base({ collectionId: 'papers', status: 'Read' }),
    base({ collectionId: 'papers', status: 'Read' }),
    base({ collectionId: 'papers', status: 'To read' }),
  ] as GoalData['records'],
};

describe('goals that count themselves', () => {
  it('counts each source from the day the goal was made (a list status: as it is now)', () => {
    const m = (source?: NonNullable<Goal['measure']>['source'], fromHabits?: boolean) =>
      measuredCurrent(goal({ label: 'x', current: 7, target: 10, source, fromHabits }), data);
    expect(m(undefined, true)).toBe(1);
    expect(m({ kind: 'workouts' })).toBe(1);
    expect(m({ kind: 'words' })).toBe(750);
    expect(m({ kind: 'focus' })).toBe(2);
    expect(m({ kind: 'list', collectionId: 'papers', status: 'Read' })).toBe(2);
    expect(m()).toBe(7); // by hand
  });
});
