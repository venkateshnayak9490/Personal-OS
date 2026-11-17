import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { BottomNav } from './BottomNav';
import { QuickCapture } from './QuickCapture';
import { Sidebar } from './Sidebar';
import { UpdatePrompt } from './UpdatePrompt';
import { useSystemThemeListener } from './theme';

export function AppShell() {
  useSystemThemeListener();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

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
      <UpdatePrompt />
    </div>
  );
}
