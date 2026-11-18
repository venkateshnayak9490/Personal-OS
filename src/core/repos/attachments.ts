import { db } from '@/core/db';
import { newId } from '@/core/domain/entity';
import type { Attachment, EntityRef } from '@/core/domain/types';
import { insert, softDeleteBatch } from './write';

/** Phones have limited storage, and big files belong in a cloud drive (link them instead). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function addAttachment(target: EntityRef, file: File, nodeId?: string): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`“${file.name}” is over 25 MB. Put it in a cloud drive and paste the link instead.`);
  const fileId = newId();
  await db.files.add({ id: fileId, blob: file });
  try {
    return await insert<Attachment>('attachments', {
      targetTable: target.table,
      targetId: target.id,
      nodeId,
      name: file.name || 'File',
      type: file.type || 'application/octet-stream',
      size: file.size,
      fileId,
    });
  } catch (e) {
    await db.files.delete(fileId);
    throw e;
  }
}

/** Moves to Trash; the bytes are removed when the Trash is emptied. */
export async function deleteAttachment(id: string) {
  return softDeleteBatch([{ tableName: 'attachments', id }]);
}

export async function fileBlob(fileId: string): Promise<Blob | undefined> {
  return (await db.files.get(fileId))?.blob;
}

/** Delete bytes no attachment (live or in Trash) points to any more. */
export async function cleanOrphanFiles(): Promise<number> {
  const used = new Set((await db.attachments.toArray()).map((a) => a.fileId));
  const orphans = (await db.files.toCollection().primaryKeys()).filter((id) => !used.has(id));
  await db.files.bulkDelete(orphans);
  return orphans.length;
}
