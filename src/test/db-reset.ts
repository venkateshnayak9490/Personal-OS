import { db } from '@/core/db';
import { resetDeviceIdCache } from '@/core/device';

/** Wipe the shared database between tests. */
export async function resetDb(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
  resetDeviceIdCache();
}
