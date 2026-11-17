import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnline } from './use-media-query';

/** "Update available → Reload" toast (never reloads by itself) + offline indicator. build.md §8.6 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  const online = useOnline();

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
      {needRefresh && (
        <div
          role="status"
          className="anim-rise bg-fg text-bg pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4 text-[15px] shadow-xl shadow-black/30 md:text-sm"
        >
          <RefreshCw className="size-4 shrink-0" />
          <span className="flex-1">A new version is ready.</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="h-10 rounded-xl px-3 font-semibold hover:bg-current/10 md:h-8"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              setNeedRefresh(false);
              setOfflineReady(false);
            }}
            className="h-10 rounded-xl px-3 opacity-70 hover:opacity-100 md:h-8"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
