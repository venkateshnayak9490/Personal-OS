import { Download, HardDrive, Monitor, Moon, Settings, Smartphone, Sun, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInstallStore } from '@/app/pwa-install';
import { useThemeStore } from '@/app/theme';
import { useOnline } from '@/app/use-media-query';
import { Card, PageHeader } from '@/components/PageHeader';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/core/storage';
import type { ThemePref } from '@/core/domain/types';
import { cn } from '@/lib/cn';

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-muted text-xs">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h2 className="text-muted mb-2 flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4" /> {children}
    </h2>
  );
}

export function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { deferred, installed, promptInstall } = useInstallStore();
  const online = useOnline();
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);

  const askPersist = async () => {
    await requestPersistentStorage();
    setStorage(await getStorageStatus());
  };

  return (
    <>
      <PageHeader title="Settings" icon={Settings} />

      <SectionTitle icon={Sun}>Appearance</SectionTitle>
      <Card className="mb-6">
        <SettingRow label="Theme">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="border-line bg-surface-2 inline-flex rounded-lg border p-0.5"
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                  theme === value ? 'bg-surface text-fg font-medium shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </SettingRow>
      </Card>

      <SectionTitle icon={HardDrive}>Data on this device</SectionTitle>
      <Card className="divide-line mb-6 divide-y">
        <SettingRow
          label="Persistent storage"
          hint="Asks the browser never to clear your data to free up space. Installing the app usually grants this."
        >
          {storage?.persisted ? (
            <span className="text-sec-self text-sm font-medium">Protected</span>
          ) : (
            <button
              type="button"
              onClick={() => void askPersist()}
              className="border-line hover:bg-surface-2 rounded-lg border px-3 py-1.5 text-sm"
            >
              Request protection
            </button>
          )}
        </SettingRow>
        <SettingRow
          label="Storage used"
          hint="Everything is stored locally in this browser. Backups arrive in M1."
        >
          <span className="text-muted text-sm tabular-nums">
            {formatBytes(storage?.usageBytes)} of {formatBytes(storage?.quotaBytes)}
          </span>
        </SettingRow>
      </Card>

      <SectionTitle icon={Smartphone}>App</SectionTitle>
      <Card className="divide-line divide-y">
        <SettingRow
          label="Install"
          hint={
            installed ? 'Running as an installed app.' : 'Add Personal OS to your home screen or desktop.'
          }
        >
          {installed ? (
            <span className="text-sec-self text-sm font-medium">Installed</span>
          ) : deferred ? (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="bg-accent text-accent-fg flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <Download className="size-4" /> Install app
            </button>
          ) : (
            <span className="text-muted text-xs">Use the browser menu → Install app</span>
          )}
        </SettingRow>
        <SettingRow label="Connection">
          <span className={cn('text-sm', online ? 'text-sec-self' : 'text-muted')}>
            {online ? 'Online' : 'Offline'}
          </span>
        </SettingRow>
        <SettingRow label="Version">
          <span className="text-muted text-sm tabular-nums">{__APP_VERSION__}</span>
        </SettingRow>
      </Card>
    </>
  );
}
