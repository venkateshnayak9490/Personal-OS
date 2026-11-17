import { db } from '@/core/db';
import type { Tag } from '@/core/domain/types';
import { insert, patch, softDeleteBatch } from './write';

function normalize(name: string): string {
  return name.trim().replace(/^#/, '').replace(/\s+/g, '-');
}

export async function createTag(name: string, color = 'slate'): Promise<Tag> {
  const clean = normalize(name);
  if (!clean) throw new Error('A tag needs a name');
  const existing = (await db.tags.toArray()).find(
    (t) => !t.deletedAt && t.name.toLowerCase() === clean.toLowerCase(),
  );
  if (existing) return existing;
  return insert<Tag>('tags', { name: clean, color });
}

export async function updateTag(id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>) {
  if (changes.name !== undefined) {
    const clean = normalize(changes.name);
    if (!clean) throw new Error('A tag needs a name');
    const clash = (await db.tags.toArray()).find(
      (t) => !t.deletedAt && t.id !== id && t.name.toLowerCase() === clean.toLowerCase(),
    );
    if (clash) throw new Error(`A tag named "${clean}" already exists`);
    changes = { ...changes, name: clean };
  }
  return patch<Tag>('tags', id, changes);
}

/** Moves the tag to Trash. Tasks keep the reference, so restoring the tag brings it back on them. */
export async function deleteTag(id: string) {
  return softDeleteBatch([{ tableName: 'tags', id }]);
}
