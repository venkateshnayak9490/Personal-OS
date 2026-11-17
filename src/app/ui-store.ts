import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Per-device UI conveniences only (never user data — that lives in IndexedDB). */
interface UIState {
  sidebarCollapsed: boolean;
  expandedSections: string[];
  quickCaptureOpen: boolean;
  toggleSidebar: () => void;
  toggleSection: (key: string) => void;
  setQuickCaptureOpen: (open: boolean) => void;
}

const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
}));

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      expandedSections: ['work'],
      quickCaptureOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleSection: (key) =>
        set((s) => ({
          expandedSections: s.expandedSections.includes(key)
            ? s.expandedSections.filter((k) => k !== key)
            : [...s.expandedSections, key],
        })),
      setQuickCaptureOpen: (quickCaptureOpen) => set({ quickCaptureOpen }),
    }),
    {
      name: 'pos-ui',
      storage: safeStorage,
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, expandedSections: s.expandedSections }),
    },
  ),
);
