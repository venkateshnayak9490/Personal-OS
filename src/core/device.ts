import type { PersonalOSDB } from '@/core/db/schema';
import { newId } from '@/core/domain/entity';

const DEVICE_KEY = 'deviceId';
let cached: string | undefined;

/** A stable random id for this browser install. Stored in the database so it survives reloads. */
export async function getDeviceId(database: PersonalOSDB): Promise<string> {
  if (cached) return cached;
  return database.transaction('rw', database.meta, async () => {
    const existing = await database.meta.get(DEVICE_KEY);
    if (typeof existing?.value === 'string') {
      cached = existing.value;
      return cached;
    }
    const id = newId();
    await database.meta.put({ key: DEVICE_KEY, value: id });
    cached = id;
    return id;
  });
}

/** Test helper. */
export function resetDeviceIdCache(): void {
  cached = undefined;
}
