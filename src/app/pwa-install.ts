import { create } from 'zustand';

/** Chrome/Edge/Android fire `beforeinstallprompt` when the app is installable. Not in TS DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  promptInstall: () => Promise<boolean>;
}

function isStandalone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
}

export const useInstallStore = create<InstallState>((set, get) => ({
  deferred: null,
  installed: isStandalone(),
  promptInstall: async () => {
    const ev = get().deferred;
    if (!ev) return false;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    set({ deferred: null, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
}));

/** Call once at startup, before React renders, so the early event isn't missed. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own "Install app" button instead of the mini-infobar
    useInstallStore.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    useInstallStore.setState({ deferred: null, installed: true }),
  );
}
