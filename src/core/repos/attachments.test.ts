import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { resetDb } from '@/test/db-reset';
import { addAttachment, deleteAttachment, MAX_FILE_BYTES } from './attachments';
import { emptyTrash, restoreFromTrash } from './trash';

beforeEach(resetDb);

const file = (name: string, size = 3) => new File(['x'.repeat(size)], name, { type: 'application/pdf' });
const target = { table: 'tasks', id: 't1' };

describe('attachments', () => {
  it('keeps the name, type and size, and the bytes separately', async () => {
    const a = await addAttachment(target, file('paper.pdf'));
    expect(a).toMatchObject({ targetTable: 'tasks', targetId: 't1', name: 'paper.pdf', size: 3 });
    expect(await db.files.count()).toBe(1);
  });

  it('refuses files over 25 MB', async () => {
    const big = { name: 'video.mp4', size: MAX_FILE_BYTES + 1, type: 'video/mp4' } as File;
    await expect(addAttachment(target, big)).rejects.toThrow(/over 25 MB/);
    expect(await db.files.count()).toBe(0);
  });

  it('bytes stay while in Trash (restorable) and go when the Trash is emptied', async () => {
    const a = await addAttachment(target, file('notes.pdf'));
    const batch = await deleteAttachment(a.id);
    await restoreFromTrash(batch!);
    expect(await db.files.count()).toBe(1);
    await deleteAttachment(a.id);
    await emptyTrash();
    expect(await db.attachments.count()).toBe(0);
    expect(await db.files.count()).toBe(0);
  });
});
