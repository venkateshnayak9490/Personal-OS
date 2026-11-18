import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { resetDb } from '@/test/db-reset';
import {
  createNote,
  deleteJournalEntry,
  journalId,
  noteTitle,
  saveJournalBody,
  saveNoteBody,
  setMood,
  setPrivate,
} from './notes';

beforeEach(resetDb);

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
    await setMood('2026-11-18', 4);
    await saveJournalBody('2026-11-18', { type: 'doc' }, 'Good lab day.');
    await setPrivate('2026-11-18', true);
    expect(await db.journalEntries.count()).toBe(1);
    expect(await db.journalEntries.get(journalId('2026-11-18'))).toMatchObject({
      mood: 4,
      text: 'Good lab day.',
      isPrivate: true,
    });
  });

  it('a save and a click at the same moment make one entry with both', async () => {
    await Promise.all([saveJournalBody('2026-11-19', {}, 'Typed'), setPrivate('2026-11-19', true)]);
    expect(await db.journalEntries.get(journalId('2026-11-19'))).toMatchObject({
      text: 'Typed',
      isPrivate: true,
    });
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
