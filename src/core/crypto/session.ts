import { create } from 'zustand';

/**
 * The unlocked vault key lives only here, in memory: never stored, gone on reload or tab close,
 * dropped on Lock or after idle time (see VaultAutoLock).
 */
interface VaultSession {
  key: CryptoKey | null;
  lastActive: number;
  unlock: (key: CryptoKey) => void;
  lock: () => void;
  touch: () => void;
}

export const useVaultSession = create<VaultSession>((set) => ({
  key: null,
  lastActive: 0,
  unlock: (key) => set({ key, lastActive: Date.now() }),
  lock: () => set({ key: null }),
  touch: () => set({ lastActive: Date.now() }),
}));

export const vaultKey = () => useVaultSession.getState().key;

/** The key, or a plain error telling the user what to do. */
export function requireVaultKey(): CryptoKey {
  const k = vaultKey();
  if (!k) throw new Error('Unlock the Vault first.');
  return k;
}
