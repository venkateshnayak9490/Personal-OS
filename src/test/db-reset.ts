import { db } from '@/core/db';
import { resetDeviceIdCache } from '@/core/device';

/**
 * Wipe the shared database between tests. Clearing the tables (rather than close + delete) keeps the
 * connection open, so a live query still settling from the last test never hits a closed database.
 */
export async function resetDb(): Promise<void> {
  if (!db.isOpen()) await db.open();
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
  resetDeviceIdCache();
}
