import { useEffect } from 'react';
import { useVaultSession } from '@/core/crypto/session';

/** Lock the Vault after this long without a tap or key press (build.md §10.2). */
export const VAULT_IDLE_MS = 5 * 60_000;

/** Mounted once in the app frame. Renders nothing. */
export function VaultAutoLock() {
  const key = useVaultSession((s) => s.key);
  useEffect(() => {
    if (!key) return;
    const { touch, lock } = useVaultSession.getState();
    let last = 0;
    const active = () => {
      // Touching the store on every key press would re-render; once every few seconds is enough.
      if (Date.now() - last > 5_000) {
        last = Date.now();
        touch();
      }
    };
    const check = () => {
      if (Date.now() - useVaultSession.getState().lastActive > VAULT_IDLE_MS) lock();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, active, { passive: true });
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 15_000);
    return () => {
      for (const e of events) window.removeEventListener(e, active);
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, [key]);
  return null;
}
