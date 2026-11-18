/// <reference types="vite/client" />

/** Injected by Vite from package.json (see vite.config.ts `define`). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Supabase project URL (Settings → API). Public. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key (or the older "anon" key). Public; row-level security protects data. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
