import { supabase } from './supabase';

/**
 * Public half of the VAPID key pair; the private half is a Supabase secret used by send-due.
 * Public by design (every browser that subscribes receives it). Rotating it means re-subscribing.
 */
export const VAPID_PUBLIC_KEY =
  'BEX_esS5ZoXkpKrmUqUCPBFsQR-74RM7o5rhxpp2_iMpSQGVl1hxre34q4Om7wkaaLz2UJGJccxkB7lIYdPEXNM';

/** Reminders while the app is closed need a service worker, the Push API and sync (for the server). */
export const pushSupported = () =>
  !!supabase && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (b64url: string) => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const b64 = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    : '';

/** A short name for this device in the list of subscribed devices, e.g. "Chrome on Windows". */
function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : 'Linux';
  return `${browser} on ${os}`;
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg)
    throw new Error('Notifications need the installed app (or a reload once it has finished loading).');
  return reg;
}

/** This device's push subscription, if it has one for our key. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function save(sub: PushSubscription) {
  const { error } = await supabase!.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: b64(sub.getKey('p256dh')),
      auth: b64(sub.getKey('auth')),
      device: deviceName(),
    },
    { onConflict: 'user_id,endpoint' },
  );
  if (error) throw new Error(`Couldn't save this device for notifications: ${error.message}`);
}

/** Ask for permission (only now, from a tap), subscribe this device and register it with the server. */
export async function enablePush(): Promise<void> {
  const perm =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted')
    throw new Error('Notifications are blocked for this app. Allow them in the browser’s site settings.');
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // Subscribed with another key (a rotated one): start over.
  if (sub && b64(sub.options.applicationServerKey) !== VAPID_PUBLIC_KEY) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
  });
  await save(sub);
}

/** Stop notifications on this device (other devices keep theirs). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Re-register this device's subscription with the server (on sign-in and app start). Browsers can
 * replace a subscription on their own; this keeps the server's copy current.
 */
export async function keepPushSubscription(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await save(sub);
}

/** Queue a notification for right now. The server sends it within about a minute. */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase!.from('push_queue').insert({
    id: `test:${Date.now()}`,
    fire_at: new Date().toISOString(),
    title: 'Personal OS',
    body: 'Notifications work on this device. Reminders will arrive here even when the app is closed.',
    url: '/settings/reminders',
  });
  if (error) throw new Error(`Couldn't queue the test: ${error.message}`);
}
