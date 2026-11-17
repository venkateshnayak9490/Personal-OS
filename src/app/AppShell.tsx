import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useProfile } from '@/core/hooks';
import { NodeDialog } from '@/features/structure/NodeDialog';
import { TaskEditor } from '@/features/tasks/TaskEditor';
import { BottomNav } from './BottomNav';
import { QuickCapture } from './QuickCapture';
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
      <QuickCapture />
      <TaskEditor />
      <NodeDialog state={nodeDialog} onClose={() => closeNodeDialog(null)} />
      <UpdatePrompt />
      <Toaster />
    </div>
  );
}
