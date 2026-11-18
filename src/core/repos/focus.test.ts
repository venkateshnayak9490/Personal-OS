import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { focusMinutes, hm } from '@/core/domain/focus';
import { resetDb } from '@/test/db-reset';
import { extendFocus, runningFocus, startFocus, stopFocus } from './focus';

beforeEach(resetDb);
const MIN = 60_000;

describe('focus sessions', () => {
  it('stopping early saves the minutes worked', async () => {
    await startFocus({ plannedMin: 25, taskId: 't1' }, 0);
    await expect(startFocus({ plannedMin: 25 }, 0)).rejects.toThrow(/already running/);
    const s = await stopFocus(10 * MIN + 30_000);
    expect(s).toMatchObject({ minutes: 10, plannedMin: 25, taskId: 't1' });
    expect(await runningFocus()).toBeUndefined();
  });

  it('a session left running while the app was closed ends at its planned time', async () => {
    await startFocus({ plannedMin: 25 }, 0);
    await extendFocus(5);
    const s = await stopFocus(5 * 60 * MIN);
    expect(s).toMatchObject({ minutes: 30, end: 30 * MIN });
  });

  it('under a minute is not saved', async () => {
    await startFocus({ plannedMin: 25 }, 0);
    expect(await stopFocus(40_000)).toBeNull();
    expect(await db.focusSessions.count()).toBe(0);
  });

  it('counts minutes within a day, splitting sessions across midnight', () => {
    const day = 24 * 60 * MIN;
    const base = { id: 'x', createdAt: 0, updatedAt: 0, version: 1, deviceId: 'd', plannedMin: 60 };
    const s = [
      { ...base, start: day - 20 * MIN, end: day + 40 * MIN, minutes: 60 },
      { ...base, start: day + 2 * 60 * MIN, end: day + 2 * 60 * MIN + 25 * MIN, minutes: 25 },
    ];
    expect(focusMinutes(s, day, 2 * day)).toBe(65);
    expect(hm(65)).toBe('1h 5m');
    expect(hm(120)).toBe('2h');
    expect(hm(45)).toBe('45m');
  });
});
