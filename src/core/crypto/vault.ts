import { argon2id } from 'hash-wasm';

/**
 * Vault encryption (build.md §10.2), all in the browser:
 *   passphrase ──Argon2id──► KEK ──wraps──► random 256-bit data key (DEK) ──AES-256-GCM──► items
 *   recovery key ──Argon2id──► KEK₂ ──also wraps the same DEK
 * Only ciphertext is ever stored. A wrong passphrase fails GCM authentication.
 */

/** Encrypted bytes: a fresh 96-bit IV and the AES-GCM ciphertext (with its tag), base64. */
export interface Sealed {
  iv: string;
  ct: string;
}

export interface KdfParams {
  alg: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** OWASP's Argon2id baseline is 19 MiB × 2; we use more since it runs once per unlock. */
export const DEFAULT_KDF: KdfParams = {
  alg: 'argon2id',
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

/** What's stored to unlock the vault later (no secrets in it). */
export interface VaultKeys {
  kdf: KdfParams;
  salt: string;
  wrapped: Sealed;
  recoverySalt: string;
  recoveryWrapped: Sealed;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export const toB64 = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function kek(secret: string, salt: Uint8Array, p: KdfParams): Promise<CryptoKey> {
  const raw = await argon2id({
    password: secret.normalize('NFKC'),
    salt,
    parallelism: p.parallelism,
    iterations: p.iterations,
    memorySize: p.memoryKiB,
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** The data key for this session: usable, never readable back out. */
const dataKey = (raw: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function unseal(key: CryptoKey, s: Sealed): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.ct)),
  );
}

export const sealJSON = (key: CryptoKey, value: unknown) => seal(key, enc.encode(JSON.stringify(value)));
export const unsealJSON = async <T>(key: CryptoKey, s: Sealed) =>
  JSON.parse(dec.decode(await unseal(key, s))) as T;

/** 32 characters from an unambiguous alphabet, in groups of 4: easy to write down. */
function recoveryKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = [...random(32)].map((b) => alphabet[b % 32]).join('');
  return chars.match(/.{4}/g)!.join('-');
}
const normalizeRecovery = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** New vault: returns what to store, the recovery key (show once) and the session key. */
export async function createVault(passphrase: string, kdf: KdfParams = DEFAULT_KDF) {
  if (passphrase.length < 10) throw new Error('Use at least 10 characters. A few random words work well.');
  const dek = random(32);
  const salt = random(16);
  const recoverySalt = random(16);
  const recovery = recoveryKey();
  const keys: VaultKeys = {
    kdf,
    salt: toB64(salt),
    wrapped: await seal(await kek(passphrase, salt, kdf), dek),
    recoverySalt: toB64(recoverySalt),
    recoveryWrapped: await seal(await kek(normalizeRecovery(recovery), recoverySalt, kdf), dek),
  };
  return { keys, recovery, key: await dataKey(dek) };
}

async function openWith(secret: string, salt: string, wrapped: Sealed, kdf: KdfParams) {
  try {
    return await unseal(await kek(secret, fromB64(salt), kdf), wrapped);
  } catch {
    return null;
  }
}

/** Unlock with the passphrase. Null if it's wrong. */
export async function unlockVault(keys: VaultKeys, passphrase: string): Promise<CryptoKey | null> {
  const raw = await openWith(passphrase, keys.salt, keys.wrapped, keys.kdf);
  return raw && dataKey(raw);
}

/**
 * Forgot the passphrase: the recovery key unlocks the same data key, which is re-wrapped with a
 * new passphrase. Nothing is re-encrypted. Null if the recovery key is wrong.
 */
export async function resetPassphrase(keys: VaultKeys, recovery: string, newPassphrase: string) {
  if (newPassphrase.length < 10) throw new Error('Use at least 10 characters. A few random words work well.');
  const raw = await openWith(normalizeRecovery(recovery), keys.recoverySalt, keys.recoveryWrapped, keys.kdf);
  if (!raw) return null;
  const salt = random(16);
  const next: VaultKeys = {
    ...keys,
    salt: toB64(salt),
    wrapped: await seal(await kek(newPassphrase, salt, keys.kdf), raw),
  };
  return { keys: next, key: await dataKey(raw) };
}

/** Change the passphrase (knowing the old one). Null if the old one is wrong. */
export async function changePassphrase(keys: VaultKeys, oldPassphrase: string, newPassphrase: string) {
  if (newPassphrase.length < 10) throw new Error('Use at least 10 characters. A few random words work well.');
  const raw = await openWith(oldPassphrase, keys.salt, keys.wrapped, keys.kdf);
  if (!raw) return null;
  const salt = random(16);
  return { ...keys, salt: toB64(salt), wrapped: await seal(await kek(newPassphrase, salt, keys.kdf), raw) };
}
