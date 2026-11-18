import { db } from '@/core/db';
import { requireVaultKey, useVaultSession } from '@/core/crypto/session';
import {
  changePassphrase,
  createVault,
  DEFAULT_KDF,
  fromB64,
  resetPassphrase,
  seal,
  sealJSON,
  toB64,
  unlockVault,
  unseal,
  unsealJSON,
  type KdfParams,
} from '@/core/crypto/vault';
import { newId } from '@/core/domain/entity';
import type { VaultContent, VaultItem, VaultMeta } from '@/core/domain/types';
import { MAX_FILE_BYTES } from './attachments';
import { encryptPrivateEntries } from './notes';
import { insert, patch, softDeleteBatch } from './write';

export const VAULT_ID = 'vault';
const QUIET = { quiet: true };

export async function getVaultMeta(): Promise<VaultMeta | null> {
  const m = await db.vaultMeta.get(VAULT_ID);
  return m && !m.deletedAt ? m : null;
}

/** First-time setup. Returns the recovery key, to show once. */
export async function setupVault(passphrase: string, kdf: KdfParams = DEFAULT_KDF): Promise<string> {
  if (await getVaultMeta()) throw new Error('The Vault is already set up.');
  const { keys, recovery, key } = await createVault(passphrase, kdf);
  await insert<VaultMeta>('vaultMeta', { id: VAULT_ID, ...keys });
  useVaultSession.getState().unlock(key);
  await encryptPrivateEntries(key);
  return recovery;
}

/** Unlock; false if the passphrase is wrong. */
export async function unlock(passphrase: string): Promise<boolean> {
  const meta = await getVaultMeta();
  if (!meta) throw new Error('The Vault isn’t set up yet.');
  const key = await unlockVault(meta, passphrase);
  if (!key) return false;
  useVaultSession.getState().unlock(key);
  await encryptPrivateEntries(key); // private entries written before the Vault existed
  return true;
}

/** Forgot the passphrase: recovery key + a new passphrase. False if the recovery key is wrong. */
export async function recover(recoveryKey: string, newPassphrase: string): Promise<boolean> {
  const meta = await getVaultMeta();
  if (!meta) throw new Error('The Vault isn’t set up yet.');
  const r = await resetPassphrase(meta, recoveryKey, newPassphrase);
  if (!r) return false;
  await patch<VaultMeta>(
    'vaultMeta',
    VAULT_ID,
    { salt: r.keys.salt, wrapped: r.keys.wrapped },
    'updated',
    QUIET,
  );
  useVaultSession.getState().unlock(r.key);
  return true;
}

export async function changeVaultPassphrase(oldPassphrase: string, newPassphrase: string): Promise<boolean> {
  const meta = await getVaultMeta();
  if (!meta) throw new Error('The Vault isn’t set up yet.');
  const next = await changePassphrase(meta, oldPassphrase, newPassphrase);
  if (!next) return false;
  await patch<VaultMeta>('vaultMeta', VAULT_ID, { salt: next.salt, wrapped: next.wrapped }, 'updated', QUIET);
  return true;
}

export const lockVault = () => useVaultSession.getState().lock();

/* ---------- Items ---------- */

export const readVaultItem = async (item: VaultItem) =>
  unsealJSON<VaultContent>(requireVaultKey(), item.cipher);

export async function createVaultItem(content: Pick<VaultContent, 'title' | 'text'>): Promise<VaultItem> {
  const c: VaultContent = { title: content.title.trim() || 'Untitled', text: content.text, files: [] };
  return insert<VaultItem>('vaultItems', { cipher: await sealJSON(requireVaultKey(), c), fileIds: [] });
}

export async function saveVaultItem(id: string, content: VaultContent) {
  const cipher = await sealJSON(requireVaultKey(), content);
  return patch<VaultItem>(
    'vaultItems',
    id,
    { cipher, fileIds: content.files.map((f) => f.fileId) },
    'updated',
    QUIET,
  );
}

/** Encrypt a file's bytes into `files` and add it to the item. */
export async function addVaultFile(item: VaultItem, file: File) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is over 25 MB.`);
  const key = requireVaultKey();
  const content = await readVaultItem(item);
  const sealed = await seal(key, new Uint8Array(await file.arrayBuffer()));
  const fileId = newId();
  await db.files.add({ id: fileId, sealed });
  content.files.push({
    fileId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  });
  await saveVaultItem(item.id, content);
}

/** Decrypted file contents, or undefined if its bytes aren't on this device. */
export async function vaultFileBlob(fileId: string, type: string): Promise<Blob | undefined> {
  const stored = await db.files.get(fileId);
  if (!stored?.sealed) return undefined;
  return new Blob([await unseal(requireVaultKey(), stored.sealed)], { type });
}

export const deleteVaultItem = (id: string) => softDeleteBatch([{ tableName: 'vaultItems', id }]);

// Re-exported for tests.
export { fromB64, toB64 };
