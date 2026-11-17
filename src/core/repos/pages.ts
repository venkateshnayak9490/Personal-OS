import { db } from '@/core/db';
import type { Page } from '@/core/domain/types';
import { insert, patch } from './write';

/** Typing saves often; keep at most one history line per page every 10 minutes. */
const LOG_EVERY_MS = 10 * 60 * 1000;

/** Save a section's page (creates it on first save). The page id is the section id. */
export async function savePage(nodeId: string, doc: unknown, text: string): Promise<void> {
  const existing = await db.pages.get(nodeId);
  if (!existing) {
    await insert<Page>('pages', { id: nodeId, nodeId, doc, text });
    return;
  }
  if (existing.deletedAt) return; // its section is in the Trash; restoring the section restores the page
  await patch<Page>('pages', nodeId, { doc, text }, 'updated', {
    quiet: true,
    minLogIntervalMs: LOG_EVERY_MS,
  });
}
