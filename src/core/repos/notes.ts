import { db } from '@/core/db';
import type { JournalEntry, Mood, Note } from '@/core/domain/types';
import { sealJSON, unsealJSON } from '@/core/crypto/vault';
import { vaultKey } from '@/core/crypto/session';
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

type Body = { doc?: unknown; text: string };
type DayChange = { body?: Body; mood?: Mood | undefined; isPrivate?: boolean };

/**
 * Create the day's entry on first write, then update it. Runs one at a time: typing and a click on
 * Private straight after would otherwise both try to create the same day.
 */
let chain: Promise<unknown> = Promise.resolve();
function upsertDay(date: string, change: DayChange) {
  const run = chain.then(() => writeDay(date, change));
  chain = run.catch(() => {});
  return run;
}

/**
 * Private entries are stored encrypted with the Vault key: their text never touches the
 * database, the history or a backup in readable form.
 */
async function writeDay(date: string, change: DayChange) {
  const id = journalId(date);
  const existing = await db.journalEntries.get(id);
  const willBePrivate = change.isPrivate ?? existing?.isPrivate ?? false;
  const wasPrivate = !!existing?.isPrivate;
  if (change.isPrivate && !wasPrivate) vaultKeyOrThrow(); // private always means encrypted
  const fields: Partial<JournalEntry> = {};
  if ('mood' in change) fields.mood = change.mood;
  if (change.isPrivate !== undefined) fields.isPrivate = change.isPrivate;

  // The body to store: the new one, or the current one when only privacy changes.
  let body = change.body;
  if (!body && change.isPrivate !== undefined && change.isPrivate !== wasPrivate && existing)
    body = existing.cipher
      ? await unsealJSON<Body>(vaultKeyOrThrow(), existing.cipher)
      : { doc: existing.doc, text: existing.text };
  if (body) {
    if (willBePrivate)
      Object.assign(fields, { cipher: await sealJSON(vaultKeyOrThrow(), body), doc: undefined, text: '' });
    else Object.assign(fields, { doc: body.doc, text: body.text, cipher: undefined });
  }

  const touchesText = !!body || willBePrivate;
  const res = !existing
    ? await insert<JournalEntry>('journalEntries', { id, date, text: '', isPrivate: false, ...fields })
    : await patch<JournalEntry>(
        'journalEntries',
        id,
        // Writing on a day whose entry is in the Trash brings it back.
        { ...fields, deletedAt: undefined, trashBatchId: undefined },
        'updated',
        touchesText ? QUIET : {},
      );
  if (willBePrivate && !wasPrivate) await redactHistory(id);
  return res;
}

function vaultKeyOrThrow(): CryptoKey {
  const k = vaultKey();
  if (!k) throw new Error('Private entries are encrypted with the Vault. Set it up or unlock it first.');
  return k;
}

/**
 * Remove an entry's earlier text from the activity history once it becomes private.
 * The one deliberate exception to "history is never edited": privacy wins.
 */
async function redactHistory(entityId: string) {
  const entries = await db.activityLog
    .where('[entityTable+entityId]')
    .equals(['journalEntries', entityId])
    .toArray();
  for (const e of entries) {
    const strip = (o?: Record<string, unknown>) =>
      o && Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'doc' && k !== 'text'));
    await db.activityLog.update(e.id, { before: strip(e.before), after: strip(e.after) });
  }
}

/** Private entries written before the Vault existed (or on another device) get encrypted now. */
export async function encryptPrivateEntries(key: CryptoKey) {
  for (const e of await db.journalEntries.toArray()) {
    if (!e.isPrivate || e.cipher || e.deletedAt) continue;
    const cipher = await sealJSON(key, { doc: e.doc, text: e.text });
    await patch<JournalEntry>('journalEntries', e.id, { cipher, doc: undefined, text: '' }, 'updated', QUIET);
    await redactHistory(e.id);
  }
}

/** The readable body of an entry; null while a private one is locked. */
export async function readJournalBody(e: JournalEntry): Promise<Body | null> {
  if (!e.cipher) return { doc: e.doc, text: e.text };
  const k = vaultKey();
  return k ? unsealJSON<Body>(k, e.cipher) : null;
}

export const saveJournalBody = (date: string, doc: unknown, text: string) =>
  upsertDay(date, { body: { doc, text } });
export const setMood = (date: string, mood: Mood | undefined) => upsertDay(date, { mood });
export const setPrivate = (date: string, isPrivate: boolean) => upsertDay(date, { isPrivate });
export const deleteJournalEntry = (date: string) =>
  softDeleteBatch([{ tableName: 'journalEntries', id: journalId(date) }]);
