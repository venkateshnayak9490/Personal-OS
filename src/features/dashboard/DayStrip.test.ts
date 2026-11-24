import { describe, expect, it } from 'vitest';
import { assignLanes, type Period } from './DayStrip';

const H = 3_600_000;
const p = (start: number, end: number): Period => ({
  key: `${start}`,
  title: 'x',
  start: start * H,
  end: end * H,
  kind: 'event',
});

describe('assignLanes', () => {
  it('keeps items that do not overlap in one lane', () => {
    expect(assignLanes([p(9, 10.5), p(11, 13), p(14, 15.5)])).toEqual([0, 0, 0]);
  });

  it('moves an overlapping item to the next lane', () => {
    expect(assignLanes([p(9, 11), p(10, 12), p(12, 13)])).toEqual([0, 1, 0]);
  });

  it('reserves room for a short item’s label', () => {
    // 09:30–10:00 is short, so its label holds the lane until 11:45; 11:30 must go below, 12:00 need not.
    expect(assignLanes([p(9.5, 10), p(11.5, 13)])).toEqual([0, 1]);
    expect(assignLanes([p(9.5, 10), p(12, 13)])).toEqual([0, 0]);
  });
});
