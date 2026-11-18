import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
import { resetDb } from '@/test/db-reset';
import { cleanOrphanFiles } from './attachments';
import {
  addVaultFile,
  createVaultItem,
  lockVault,
  readVaultItem,
  recover,
  setupVault,
  unlock,
  vaultFileBlob,
} from './vault';

beforeEach(async () => {
  await resetDb();
  useVaultSession.getState().lock();
});
const FAST = { alg: 'argon2id' as const, memoryKiB: 1024, iterations: 1, parallelism: 1 };

describe('vault', () => {
  it('set up, add an item with a file, lock, unlock, recover', async () => {
    const recovery = await setupVault('correct horse battery', FAST);
    const item = await createVaultItem({ title: 'Passport', text: 'Number N1234567' });
    await addVaultFile(item, new File(['%PDF secret scan'], 'passport.pdf', { type: 'application/pdf' }));

    // Nothing readable is stored.
    const stored = JSON.stringify([await db.vaultItems.toArray(), await db.activityLog.toArray()]);
    expect(stored).not.toContain('N1234567');
    expect(stored).not.toContain('Passport');
    const file = (await db.files.toArray())[0]!;
    expect(file.blob).toBeUndefined();
    expect(JSON.stringify(file.sealed)).not.toContain('secret');

    lockVault();
    await expect(readVaultItem((await db.vaultItems.get(item.id))!)).rejects.toThrow(/Unlock/);
    expect(await unlock('wrong one entirely')).toBe(false);
    expect(await unlock('correct horse battery')).toBe(true);
    const content = await readVaultItem((await db.vaultItems.get(item.id))!);
    expect(content).toMatchObject({ title: 'Passport', text: 'Number N1234567' });
    expect(await (await vaultFileBlob(content.files[0]!.fileId, 'application/pdf'))!.text()).toBe(
      '%PDF secret scan',
    );

    // Cleanup never deletes encrypted files, even while locked.
    lockVault();
    expect(await cleanOrphanFiles()).toBe(0);

    expect(await recover(recovery, 'a new long passphrase')).toBe(true);
    lockVault();
    expect(await unlock('a new long passphrase')).toBe(true);
  });
});
