import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NodeDialogState } from '@/features/structure/NodeDialog';

/** Per-device UI conveniences only (never user data — that lives in IndexedDB). */
interface UIState {
  sidebarCollapsed: boolean;
  expandedSections: string[];
  quickCaptureOpen: boolean;
  /** Create/edit-section dialog (opened from the sidebar, section pages and Settings). */
  nodeDialog: NodeDialogState;
  /** Task editor: id of the task being edited. */
  editingTaskId: string | null;
  toggleSidebar: () => void;
  toggleSection: (key: string) => void;
  setQuickCaptureOpen: (open: boolean) => void;
  setNodeDialog: (state: NodeDialogState) => void;
  setEditingTaskId: (id: string | null) => void;
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
      expandedSections: [],
      quickCaptureOpen: false,
      nodeDialog: null,
      editingTaskId: null,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleSection: (key) =>
        set((s) => ({
          expandedSections: s.expandedSections.includes(key)
            ? s.expandedSections.filter((k) => k !== key)
            : [...s.expandedSections, key],
        })),
      setQuickCaptureOpen: (quickCaptureOpen) => set({ quickCaptureOpen }),
      setNodeDialog: (nodeDialog) => set({ nodeDialog }),
      setEditingTaskId: (editingTaskId) => set({ editingTaskId }),
    }),
    {
      name: 'pos-ui',
      storage: safeStorage,
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, expandedSections: s.expandedSections }),
    },
  ),
);
