import { describe, expect, it } from 'vitest';
import {
  changePassphrase,
  createVault,
  resetPassphrase,
  sealJSON,
  unlockVault,
  unsealJSON,
  type KdfParams,
} from './vault';

// Small memory so tests stay fast; the app uses DEFAULT_KDF (64 MiB).
const FAST: KdfParams = { alg: 'argon2id', memoryKiB: 1024, iterations: 1, parallelism: 1 };
const PASS = 'correct horse battery staple';

describe('vault crypto', () => {
  it('encrypts with the data key; only the right passphrase opens it', async () => {
    const { keys, recovery, key } = await createVault(PASS, FAST);
    expect(recovery).toMatch(/^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
    const sealed = await sealJSON(key, { title: 'Passport scan', text: 'N1234567' });
    expect(JSON.stringify(sealed)).not.toContain('N1234567');
    expect(JSON.stringify(keys)).not.toContain(PASS);

    expect(await unlockVault(keys, 'wrong passphrase!')).toBeNull();
    const again = await unlockVault(keys, PASS);
    expect(await unsealJSON(again!, sealed)).toEqual({ title: 'Passport scan', text: 'N1234567' });
  });

  it('each encryption uses a fresh IV', async () => {
    const { key } = await createVault(PASS, FAST);
    const a = await sealJSON(key, 'same');
    const b = await sealJSON(key, 'same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('recovery key sets a new passphrase without re-encrypting anything', async () => {
    const { keys, recovery, key } = await createVault(PASS, FAST);
    const sealed = await sealJSON(key, 'note');
    expect(await resetPassphrase(keys, 'AAAA-BBBB', 'a brand new passphrase')).toBeNull();
    // Typed in lower case, without dashes: still accepted.
    const r = await resetPassphrase(
      keys,
      recovery.toLowerCase().replace(/-/g, ' '),
      'a brand new passphrase',
    );
    expect(await unsealJSON(r!.key, sealed)).toBe('note');
    expect(await unlockVault(r!.keys, PASS)).toBeNull();
    expect(await unlockVault(r!.keys, 'a brand new passphrase')).not.toBeNull();
  });

  it('changing the passphrase keeps the data readable; short ones are refused', async () => {
    const { keys, key } = await createVault(PASS, FAST);
    const sealed = await sealJSON(key, 42);
    expect(await changePassphrase(keys, 'nope nope nope', 'another passphrase')).toBeNull();
    const next = await changePassphrase(keys, PASS, 'another passphrase');
    expect(await unsealJSON((await unlockVault(next!, 'another passphrase'))!, sealed)).toBe(42);
    await expect(createVault('abc', FAST)).rejects.toThrow(/at least 4/);
  });
});
