import { db } from '@/core/db';
import { resetDeviceIdCache } from '@/core/device';

/** Wipe the shared database between tests. */
export async function resetDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
  resetDeviceIdCache();
}
