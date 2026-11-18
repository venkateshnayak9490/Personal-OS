import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { resetDb } from '@/test/db-reset';
import { checkPin, getPin, PIN_KEY, removePin, setPin, waitAfter } from './pin';

beforeEach(resetDb);

describe('app PIN', () => {
  it('stores only a salted hash; checks the PIN', async () => {
    await setPin('4821');
    expect(JSON.stringify(await db.meta.get(PIN_KEY))).not.toContain('4821');
    expect(await checkPin('4821')).toBe(true);
    expect(await checkPin('1111')).toBe(false);
    await removePin();
    expect(await getPin()).toBeUndefined();
  });

  it('accepts 4 to 8 digits only', async () => {
    await expect(setPin('12')).rejects.toThrow(/4 to 8/);
    await expect(setPin('12ab')).rejects.toThrow(/4 to 8/);
  });

  it('slows down guessing after 5 wrong tries', () => {
    expect([0, 4, 5, 9, 10, 15].map(waitAfter)).toEqual([0, 0, 30_000, 30_000, 60_000, 120_000]);
  });
});
