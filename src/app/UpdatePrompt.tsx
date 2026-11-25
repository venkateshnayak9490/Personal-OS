import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { attempt } from './toast';
import { checkForUpdate, refreshApp, setUpdater, useAppUpdate } from './app-update';
import { useOnline } from './use-media-query';

/** "Update available → Reload" toast (never reloads by itself) + offline indicator. build.md §8.6 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      setUpdater(registration, updateServiceWorker);
      // Check for a new version every hour while the app stays open, and whenever it comes back.
      if (registration) setInterval(() => void checkForUpdate(true), 60 * 60 * 1000);
    },
  });
  const online = useOnline();
  // "Later" hides the toast; the refresh button in the sidebar keeps showing the update is ready.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    useAppUpdate.setState({ ready: needRefresh });
  }, [needRefresh]);

  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && void checkForUpdate();
    // A form sheet may hold something half-typed: reloading or closing the window asks first.
    const onLeave = (e: BeforeUnloadEvent) => {
      if (document.querySelector('[role="dialog"] input, [role="dialog"] textarea')) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {!online && (
        <div
          role="status"
          className="border-line bg-surface text-muted flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow"
        >
          <WifiOff className="size-3.5" /> Offline — everything still works on this device
        </div>
      )}
      {/* "Ready to work offline" is not announced: it's technical noise on first launch. */}
      {needRefresh && !hidden && (
        <div
          role="status"
          className="anim-rise bg-fg text-bg pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4 text-[15px] shadow-xl shadow-black/30 md:text-sm"
        >
          <RefreshCw className="size-4 shrink-0" />
          <span className="flex-1">A new version is ready.</span>
          <button
            type="button"
            onClick={() => void attempt(refreshApp)}
            className="h-10 rounded-xl px-3 font-semibold hover:bg-current/10 md:h-8"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="h-10 rounded-xl px-3 opacity-70 hover:opacity-100 md:h-8"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
