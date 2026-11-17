import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnline } from './use-media-query';

/** "Update available → Reload" toast (never reloads by itself) + offline indicator. build.md §8.6 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  const online = useOnline();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {!online && (
        <div
          role="status"
          className="border-line bg-surface text-muted flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow"
        >
          <WifiOff className="size-3.5" /> Offline — everything still works on this device
        </div>
      )}
      {(needRefresh || offlineReady) && (
        <div
          role="status"
          className="border-line bg-surface pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 text-sm shadow-xl"
        >
          <RefreshCw className="text-accent size-4 shrink-0" />
          <span className="flex-1">
            {needRefresh ? 'A new version is available.' : 'Ready to work offline.'}
          </span>
          {needRefresh && (
            <button
              type="button"
              onClick={() => void updateServiceWorker(true)}
              className="bg-accent text-accent-fg rounded-md px-3 py-1.5 text-xs font-medium"
            >
              Reload
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNeedRefresh(false);
              setOfflineReady(false);
            }}
            className="text-muted hover:text-fg rounded-md px-2 py-1.5 text-xs"
          >
            {needRefresh ? 'Later' : 'OK'}
          </button>
        </div>
      )}
    </div>
  );
}
