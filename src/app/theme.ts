import { useEffect } from 'react';
import { create } from 'zustand';
import type { ThemePref } from '@/core/domain/types';

/** Must match public/theme-init.js. */
export const THEME_STORAGE_KEY = 'pos-theme';
const DEFAULT_THEME: ThemePref = 'dark';

function readSaved(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_THEME;
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

export function applyTheme(pref: ThemePref): void {
  const dark = resolveTheme(pref) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131316' : '#f5f3ef');
}

interface ThemeState {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readSaved(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage blocked: theme still applies for this session */
    }
    applyTheme(theme);
    set({ theme });
  },
}));

/** Keeps the page in sync when the theme is "system" and the OS switches light/dark. */
export function useSystemThemeListener(): void {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}
