import { createClient } from '@supabase/supabase-js';
import type { NewRow, ServerRow, SyncBackend } from './backend';

/**
 * Supabase connection. The URL and the publishable ("anon") key are public by design: they only
 * identify the project. Row-level security on the server is what keeps each account's rows private.
 * They come from the build environment (.env.local / Vercel settings), never from the code.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const syncConfigured = !!supabase;

const COLS = 'tbl,id,data,updated_at,seq';
const TABLE = 'sync_rows';

function client() {
  if (!supabase) throw new Error('Sync isn’t set up for this app.');
  return supabase;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(`Sync: ${error.message}`);
}

export const supabaseBackend: SyncBackend = {
  async fetchByIds(tbl, ids) {
    const { data, error } = await client().from(TABLE).select(COLS).eq('tbl', tbl).in('id', ids);
    fail(error);
    return (data ?? []) as ServerRow[];
  },
  async fetchSince(seq, limit) {
    const { data, error } = await client().from(TABLE).select(COLS).gt('seq', seq).order('seq').limit(limit);
    fail(error);
    return (data ?? []) as ServerRow[];
  },
  async insert(row: NewRow) {
    const { error } = await client().from(TABLE).insert(row);
    if (error?.code === '23505') return 'exists'; // unique violation: another device was first
    fail(error);
    return 'ok';
  },
  async updateIfSeq(row: NewRow, seq: number) {
    const { data, error } = await client()
      .from(TABLE)
      .update({ data: row.data, updated_at: row.updated_at })
      .eq('tbl', row.tbl)
      .eq('id', row.id)
      .eq('seq', seq)
      .select('id');
    fail(error);
    return (data?.length ?? 0) > 0;
  },
  async appendLog(rows: NewRow[]) {
    if (!rows.length) return;
    const { error } = await client()
      .from(TABLE)
      .upsert(rows, { onConflict: 'user_id,tbl,id', ignoreDuplicates: true });
    fail(error);
  },
  async deleteAll() {
    // Row-level security limits this to the signed-in account's rows.
    const { error } = await client().from(TABLE).delete().neq('id', '');
    fail(error);
  },
};
