import { create } from 'zustand';
import { db } from '@/core/db';
import { syncNow } from '@/features/sync/SyncRunner';

/** The service worker registration and the plugin's "install the waiting version" call, set by UpdatePrompt. */
let registration: ServiceWorkerRegistration | undefined;
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;

/** A new version has downloaded and waits for a reload. Stays true after "Later" hides the toast. */
export const useAppUpdate = create<{ ready: boolean }>(() => ({ ready: false }));

export function setUpdater(
  reg: ServiceWorkerRegistration | undefined,
  apply: (reload?: boolean) => Promise<void>,
) {
  registration = reg;
  applyUpdate = apply;
}

let lastCheck = 0;
/** Ask the server for a newer version. At most once a minute unless forced. */
export async function checkForUpdate(force = false): Promise<void> {
  if (!registration || (!force && Date.now() - lastCheck < 60_000)) return;
  lastCheck = Date.now();
  await registration.update().catch(() => {}); // offline: try again next time
}

/** Resolves once a just-found new version has finished installing (or after `ms`). */
function installed(ms = 10_000): Promise<void> {
  const sw = registration?.installing;
  if (!sw) return Promise.resolve();
  return new Promise((done) => {
    const t = setTimeout(done, ms);
    sw.addEventListener('statechange', () => {
      if (sw.state !== 'installing') {
        clearTimeout(t);
        done();
      }
    });
  });
}

/**
 * Refresh: save and sync what's pending, take the newest version if there is one, then reload.
 * Local data is in IndexedDB, so a reload never loses saved work.
 */
export async function refreshApp(): Promise<void> {
  // A field you just left saves on blur; give that write a moment, then wait for open writes to finish.
  // shortcut: a fixed 300 ms, enough for one local write; replace with a write counter if saves grow slow.
  await new Promise((r) => setTimeout(r, 300));
  await db.transaction('r', db.outbox, () => {});
  await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 8_000))]);
  await checkForUpdate(true);
  await installed();
  if (registration?.waiting && applyUpdate) {
    await applyUpdate(true); // the new version takes over and the page reloads
    // Backstop: if the takeover doesn't reload the page within 3 s, reload ourselves.
    setTimeout(() => location.reload(), 3_000);
    return;
  }
  // Nothing waiting (no update, or it already went live because this page wasn't controlled yet):
  // a plain reload loads the newest version.
  location.reload();
}
