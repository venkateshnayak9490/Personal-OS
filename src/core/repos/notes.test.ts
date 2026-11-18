import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
import { createVault } from '@/core/crypto/vault';
import { resetDb } from '@/test/db-reset';
import {
  createNote,
  deleteJournalEntry,
  encryptPrivateEntries,
  readJournalBody,
  journalId,
  noteTitle,
  saveJournalBody,
  saveNoteBody,
  setMood,
  setPrivate,
} from './notes';

beforeEach(resetDb);

const FAST = { alg: 'argon2id' as const, memoryKiB: 1024, iterations: 1, parallelism: 1 };
async function unlocked() {
  const { key } = await createVault('correct horse battery', FAST);
  useVaultSession.getState().unlock(key);
  return key;
}

describe('notes', () => {
  it('untitled notes are named by their first line', async () => {
    const n = await createNote({ nodeId: 'research' });
    await saveNoteBody(n.id, { type: 'doc' }, 'Grasp ideas\nTry tactile sensing');
    const saved = (await db.notes.get(n.id))!;
    expect(noteTitle(saved)).toBe('Grasp ideas');
    expect(noteTitle({ title: '', text: '' })).toBe('Untitled');
  });
});

describe('journal', () => {
  it('one entry per day, made on first write', async () => {
    await unlocked();
    await setMood('2026-11-18', 4);
    await saveJournalBody('2026-11-18', { type: 'doc' }, 'Good lab day.');
    await setPrivate('2026-11-18', true);
    expect(await db.journalEntries.count()).toBe(1);
    const e = (await db.journalEntries.get(journalId('2026-11-18')))!;
    expect(e).toMatchObject({ mood: 4, text: '', isPrivate: true });
    expect(await readJournalBody(e)).toMatchObject({ text: 'Good lab day.' });
  });

  it('a save and a click at the same moment make one entry with both', async () => {
    await unlocked();
    await Promise.all([saveJournalBody('2026-11-19', {}, 'Typed'), setPrivate('2026-11-19', true)]);
    const e = (await db.journalEntries.get(journalId('2026-11-19')))!;
    expect(e.isPrivate).toBe(true);
    expect(await readJournalBody(e)).toMatchObject({ text: 'Typed' });
  });

  it('writing on a trashed day brings the entry back', async () => {
    await saveJournalBody('2026-11-18', {}, 'x');
    await deleteJournalEntry('2026-11-18');
    await saveJournalBody('2026-11-18', {}, 'again');
    const e = await db.journalEntries.get(journalId('2026-11-18'));
    expect(e?.deletedAt).toBeUndefined();
    expect(e?.text).toBe('again');
  });
});

describe('private journal encryption', () => {
  it('private text is stored encrypted and scrubbed from history; locked means unreadable', async () => {
    await unlocked();
    await saveJournalBody('2026-11-18', { type: 'doc' }, 'A secret about the lab');
    await setPrivate('2026-11-18', true);
    await saveJournalBody('2026-11-18', { type: 'doc' }, 'A secret about the lab, continued');
    const e = (await db.journalEntries.get(journalId('2026-11-18')))!;
    expect(e.cipher).toBeDefined();
    const everything = JSON.stringify([await db.journalEntries.toArray(), await db.activityLog.toArray()]);
    expect(everything).not.toContain('secret');
    expect((await readJournalBody(e))?.text).toBe('A secret about the lab, continued');

    useVaultSession.getState().lock();
    expect(await readJournalBody(e)).toBeNull();
    await expect(saveJournalBody('2026-11-18', {}, 'x')).rejects.toThrow(/Vault/);
    await expect(setPrivate('2026-11-19', true)).rejects.toThrow(/Vault/);
  });

  it('making an entry public again decrypts it', async () => {
    await unlocked();
    await saveJournalBody('2026-11-18', {}, 'Was private');
    await setPrivate('2026-11-18', true);
    await setPrivate('2026-11-18', false);
    const e = (await db.journalEntries.get(journalId('2026-11-18')))!;
    expect(e).toMatchObject({ isPrivate: false, text: 'Was private' });
    expect(e.cipher).toBeUndefined();
  });

  it('private entries from before the Vault get encrypted on setup', async () => {
    await db.journalEntries.add({
      ...(await import('@/core/domain/entity')).newBase('d'),
      id: journalId('2026-11-10'),
      date: '2026-11-10',
      text: 'old private text',
      isPrivate: true,
    });
    const key = await unlocked();
    await encryptPrivateEntries(key);
    expect(JSON.stringify(await db.journalEntries.toArray())).not.toContain('old private text');
  });
});
