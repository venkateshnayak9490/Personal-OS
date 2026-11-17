export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usageBytes?: number;
  quotaBytes?: number;
}

/**
 * Ask the browser not to evict our data under storage pressure (build.md §8.4).
 * Chrome grants this automatically for installed PWAs or engaged sites; it never shows a prompt there.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (!navigator.storage?.estimate) return { supported: false, persisted: false };
  try {
    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted?.() ?? Promise.resolve(false),
      navigator.storage.estimate(),
    ]);
    return { supported: true, persisted, usageBytes: estimate.usage, quotaBytes: estimate.quota };
  } catch {
    return { supported: false, persisted: false };
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
