import { argon2id } from 'hash-wasm';
import { create } from 'zustand';
import { db } from '@/core/db';
import { fromB64, toB64 } from '@/core/crypto/vault';

/**
 * App PIN lock: a privacy screen for this device (someone picking up your phone or laptop).
 * It does not encrypt anything; the Vault does that. The PIN is kept only as a salted hash,
 * on this device only (it never syncs).
 */

export const PIN_KEY = 'pinLock';

export interface PinConfig {
  salt: string;
  hash: string;
  /** Lock again after the app has been in the background this long (0 = right away). */
  afterMs: number;
}

const hash = (pin: string, salt: Uint8Array) =>
  argon2id({
    password: pin,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19 * 1024,
    hashLength: 32,
    outputType: 'hex',
  });

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

export async function getPin(): Promise<PinConfig | undefined> {
  return (await db.meta.get(PIN_KEY))?.value as PinConfig | undefined;
}

export async function setPin(pin: string, afterMs = 60_000) {
  if (!validPin(pin)) throw new Error('Use 4 to 8 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cfg: PinConfig = { salt: toB64(salt), hash: await hash(pin, salt), afterMs };
  await db.meta.put({ key: PIN_KEY, value: cfg });
}

export async function setLockAfter(afterMs: number) {
  const cfg = await getPin();
  if (cfg) await db.meta.put({ key: PIN_KEY, value: { ...cfg, afterMs } });
}

export async function checkPin(pin: string): Promise<boolean> {
  const cfg = await getPin();
  if (!cfg) return true;
  return (await hash(pin, fromB64(cfg.salt))) === cfg.hash;
}

export const removePin = () => db.meta.delete(PIN_KEY);

/** Wrong guesses: free for 5, then a growing wait (30 s, 60 s, 120 s …). */
export function waitAfter(failures: number): number {
  if (failures < 5) return 0;
  return 30_000 * 2 ** Math.floor((failures - 5) / 5);
}

interface AppLock {
  locked: boolean;
  hiddenAt: number | null;
  set: (locked: boolean) => void;
}

/** Starts locked; AppLockGate unlocks right away when no PIN is set. */
export const useAppLock = create<AppLock>((set) => ({
  locked: true,
  hiddenAt: null,
  set: (locked) => set({ locked }),
}));
