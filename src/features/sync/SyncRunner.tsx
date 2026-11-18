import type { Session } from '@supabase/supabase-js';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { create } from 'zustand';
import { db } from '@/core/db';
import { syncOnce } from '@/core/sync/engine';
import { supabase, supabaseBackend } from '@/core/sync/supabase';

interface SyncStatus {
  session: Session | null;
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastAt?: number;
  error?: string;
  conflicts: number;
}

export const useSync = create<SyncStatus>(() => ({ session: null, state: 'off', conflicts: 0 }));

let running: Promise<void> | null = null;

/** Run one sync (never two at once). Safe to call any time; does nothing when signed out. */
export function syncNow(): Promise<void> {
  if (!supabase || !useSync.getState().session || !navigator.onLine) return Promise.resolve();
  running ??= (async () => {
    useSync.setState({ state: 'syncing' });
    try {
      const r = await syncOnce(supabaseBackend);
      useSync.setState((s) => ({
        state: 'idle',
        lastAt: Date.now(),
        error: undefined,
        conflicts: s.conflicts + r.conflicts,
      }));
    } catch (e) {
      useSync.setState({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

const EVERY_MS = 60_000;
const AFTER_EDIT_MS = 3_000;

/** Mounted once in the app frame: keeps the session and syncs on start, on reconnect, every minute and soon after edits. */
export function SyncRunner() {
  const session = useSync((s) => s.session);
  const pending = useLiveQuery(() => db.outbox.count(), []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => useSync.setState({ session: data.session, state: data.session ? 'idle' : 'off' }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      useSync.setState({ session: s, state: s ? 'idle' : 'off' }),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void syncNow();
    const id = setInterval(() => void syncNow(), EVERY_MS);
    const online = () => void syncNow();
    window.addEventListener('online', online);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', online);
    };
  }, [session]);

  useEffect(() => {
    if (!session || !pending) return;
    const id = setTimeout(() => void syncNow(), AFTER_EDIT_MS);
    return () => clearTimeout(id);
  }, [session, pending]);

  return null;
}
