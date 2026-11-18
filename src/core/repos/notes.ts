import { db } from '@/core/db';
import type { JournalEntry, Mood, Note } from '@/core/domain/types';
import { insert, patch, softDeleteBatch } from './write';

/** Typing saves often; keep at most one history line per document every 10 minutes. */
const QUIET = { quiet: true, minLogIntervalMs: 10 * 60 * 1000 };

/* ---------- Notes ---------- */

export async function createNote(input: { nodeId?: string; title?: string } = {}): Promise<Note> {
  return insert<Note>('notes', {
    title: input.title?.trim() ?? '',
    text: '',
    nodeId: input.nodeId,
    pinned: false,
  });
}

export async function updateNote(id: string, changes: Partial<Pick<Note, 'title' | 'nodeId' | 'pinned'>>) {
  if (changes.title !== undefined) changes = { ...changes, title: changes.title.trim() };
  return patch<Note>('notes', id, changes);
}

export async function saveNoteBody(id: string, doc: unknown, text: string) {
  const n = await db.notes.get(id);
  if (!n || n.deletedAt) return;
  return patch<Note>('notes', id, { doc, text }, 'updated', QUIET);
}

export const deleteNote = (id: string) => softDeleteBatch([{ tableName: 'notes', id }]);

/** A note's title, or its first line when it has none. */
export const noteTitle = (n: Pick<Note, 'title' | 'text'>) =>
  n.title || n.text.trim().split('\n')[0]?.slice(0, 80) || 'Untitled';

/* ---------- Journal ---------- */

export const journalId = (date: string) => `j:${date}`;

type DayChanges = Partial<Pick<JournalEntry, 'doc' | 'text' | 'mood' | 'isPrivate'>>;

/**
 * Create the day's entry on first write, then update it. Runs one at a time: typing and a click on
 * Private straight after would otherwise both try to create the same day.
 */
let chain: Promise<unknown> = Promise.resolve();
function upsertDay(date: string, changes: DayChanges) {
  const run = chain.then(() => writeDay(date, changes));
  chain = run.catch(() => {});
  return run;
}

async function writeDay(date: string, changes: DayChanges) {
  const id = journalId(date);
  const existing = await db.journalEntries.get(id);
  if (!existing)
    return insert<JournalEntry>('journalEntries', { id, date, text: '', isPrivate: false, ...changes });
  // Writing on a day whose entry is in the Trash brings it back.
  return patch<JournalEntry>(
    'journalEntries',
    id,
    { ...changes, deletedAt: undefined, trashBatchId: undefined },
    'updated',
    'doc' in changes ? QUIET : {},
  );
}

export const saveJournalBody = (date: string, doc: unknown, text: string) => upsertDay(date, { doc, text });
export const setMood = (date: string, mood: Mood | undefined) => upsertDay(date, { mood });
export const setPrivate = (date: string, isPrivate: boolean) => upsertDay(date, { isPrivate });
export const deleteJournalEntry = (date: string) =>
  softDeleteBatch([{ tableName: 'journalEntries', id: journalId(date) }]);
