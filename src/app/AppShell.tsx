import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useProfile } from '@/core/hooks';
import { FocusTimer } from '@/features/focus/FocusTimer';
import { Reminders } from '@/features/reminders/Reminders';
import { NodeDialog } from '@/features/structure/NodeDialog';
import { TaskEditor } from '@/features/tasks/TaskEditor';
import { NewTaskSheet } from '@/features/tasks/TaskComposer';
import { BottomNav } from './BottomNav';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Toaster } from './toast';
import { UpdatePrompt } from './UpdatePrompt';
import { useSystemThemeListener } from './theme';
import { useUIStore } from './ui-store';

export function AppShell() {
  useSystemThemeListener();
  const { pathname } = useLocation();
  const profile = useProfile();
  const nodeDialog = useUIStore((s) => s.nodeDialog);
  const closeNodeDialog = useUIStore((s) => s.setNodeDialog);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Desktop: press N anywhere (outside a text field) to add a task.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K / ⌘K works everywhere, even while typing.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const ui = useUIStore.getState();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      useUIStore.getState().setComposerOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (profile === undefined) return null; // database still opening (a few ms)
  if (profile === null) return <Navigate to="/welcome" replace />;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main id="main" className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-10 md:px-8 md:pt-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <NewTaskSheet />
      <CommandPalette />
      <TaskEditor />
      <NodeDialog state={nodeDialog} onClose={() => closeNodeDialog(null)} />
      <Reminders />
      <FocusTimer />
      <UpdatePrompt />
      <Toaster />
    </div>
  );
}
