import {
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  FolderTree,
  Hash,
  HardDrive,
  LayoutGrid,
  Monitor,
  Moon,
  Settings,
  Smartphone,
  Sun,
  Trash,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { diagnosticsReport } from '@/app/diagnostics';
import { useInstallStore } from '@/app/pwa-install';
import { attempt, toast } from '@/app/toast';
import { useThemeStore } from '@/app/theme';
import { useOnline } from '@/app/use-media-query';
import { Card, PageHeader } from '@/components/PageHeader';
import { Confirm, Sheet } from '@/components/Sheet';
import { Button, Input, Select } from '@/components/ui';
import {
  download,
  downloadBackup,
  eraseDevice,
  importBackup,
  LAST_BACKUP_KEY,
  parseBackup,
  tasksCsv,
  type BackupFile,
} from '@/core/backup';
import { useMeta, useProfile } from '@/core/hooks';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/core/storage';
import type { ThemePref } from '@/core/domain/types';
import { timezoneOptions, updateProfile, updateProfileSettings } from '@/core/repos/profile';
import { cn } from '@/lib/cn';

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        {hint && <div className="text-muted text-[13px] md:text-xs">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function DiagnosticsButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      onClick={() => void navigator.clipboard?.writeText(diagnosticsReport()).then(() => setCopied(true))}
    >
      {copied ? 'Copied' : 'Copy diagnostics'}
    </Button>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h2 className="text-muted mb-2 flex items-center gap-2 text-[13px] font-medium">
      <Icon className="size-4" /> {children}
    </h2>
  );
}

function LinkRow({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="hover:bg-surface-2 -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5"
    >
      <Icon className="text-muted size-5 md:size-4" />
      <div className="flex-1">
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        <div className="text-muted text-[13px] md:text-xs">{hint}</div>
      </div>
      <ChevronRight className="text-muted size-4" />
    </Link>
  );
}

function ago(ms: number | undefined): string {
  if (!ms) return 'Never';
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function ImportDialog({ file, onClose }: { file: BackupFile; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const counts = Object.entries(file.tables)
    .filter(([k, v]) => k !== 'activityLog' && v && v.length)
    .map(([k, v]) => `${v!.length} ${k}`)
    .join(', ');

  const run = async (mode: 'merge' | 'replace') => {
    setBusy(true);
    const res = await attempt(async () => {
      if (mode === 'replace') await downloadBackup(); // safety copy of what's here now
      return importBackup(file, mode);
    });
    setBusy(false);
    if (res) {
      toast(`Imported: ${res.added} added, ${res.updated} updated, ${res.unchanged} unchanged`);
      onClose();
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Import backup"
      description={`From ${new Date(file.exportedAt).toLocaleString()}: ${counts || 'no records'}.`}
    >
      <div className="space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('merge')}
          className="border-line hover:border-accent w-full rounded-xl border p-4 text-left"
        >
          <div className="text-sm font-semibold">Merge (recommended)</div>
          <div className="text-muted mt-0.5 text-xs">
            Keeps everything on this device and adds what’s missing. If a record exists in both, the more
            recently edited one wins.
          </div>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('replace')}
          className="border-line hover:border-danger w-full rounded-xl border p-4 text-left"
        >
          <div className="text-danger text-sm font-semibold">Replace everything</div>
          <div className="text-muted mt-0.5 text-xs">
            Deletes all data on this device and loads the backup exactly. A backup of your current data is
            downloaded first.
          </div>
        </button>
      </div>
    </Sheet>
  );
}

export function SettingsPage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { deferred, installed, promptInstall } = useInstallStore();
  const online = useOnline();
  const profile = useProfile();
  const lastBackup = useMeta<number>(LAST_BACKUP_KEY);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const zones = useMemo(() => timezoneOptions(profile?.timezone), [profile?.timezone]);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);

  const askPersist = async () => {
    await requestPersistentStorage();
    setStorage(await getStorageStatus());
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = await attempt(async () => parseBackup(await f.text()));
    if (parsed) setPending(parsed);
    if (fileInput.current) fileInput.current.value = '';
  };

  const displayName = (profile?.settings.displayName as string | undefined) ?? '';

  return (
    <>
      <PageHeader title="Settings" icon={Settings} />

      <SectionTitle icon={LayoutGrid}>Workspace</SectionTitle>
      <Card className="mb-8 py-2">
        <LinkRow
          to="/settings/sections"
          icon={FolderTree}
          label="Sections"
          hint="Add, rename, reorder, nest, hide, recolor"
        />
        <LinkRow to="/settings/tags" icon={Hash} label="Tags" hint="Rename, recolor or delete tags" />
        <LinkRow to="/trash" icon={Trash} label="Trash" hint="Restore deleted items (kept 30 days)" />
      </Card>

      <SectionTitle icon={Sun}>Appearance</SectionTitle>
      <Card className="mb-8">
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

      {profile && (
        <>
          <SectionTitle icon={UserRound}>Profile</SectionTitle>
          <Card className="divide-line mb-8 divide-y">
            <SettingRow label="Name">
              <Input
                key={displayName}
                defaultValue={displayName}
                aria-label="Name"
                placeholder="Your first name"
                className="h-9 w-56"
                onBlur={(e) =>
                  e.target.value.trim() !== displayName &&
                  void attempt(() =>
                    updateProfileSettings({ displayName: e.target.value.trim() || undefined }),
                  )
                }
              />
            </SettingRow>
            <SettingRow label="Time zone" hint="Used for due dates and daily statistics.">
              <Select
                aria-label="Time zone"
                value={profile.timezone}
                onChange={(e) => void attempt(() => updateProfile({ timezone: e.target.value }))}
                className="h-9 w-56"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow label="Week starts on">
              <Select
                aria-label="Week starts on"
                value={profile.weekStartsOn}
                onChange={(e) =>
                  void attempt(() => updateProfile({ weekStartsOn: Number(e.target.value) as 0 | 1 }))
                }
                className="h-9 w-56"
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </SettingRow>
          </Card>
        </>
      )}

      <SectionTitle icon={Database}>Backup & data</SectionTitle>
      <Card className="divide-line mb-8 divide-y">
        <SettingRow
          label="Full backup"
          hint={
            <>
              Everything in one readable JSON file. Last backup: <b className="text-fg">{ago(lastBackup)}</b>
            </>
          }
        >
          <Button size="sm" variant="primary" onClick={() => void attempt(downloadBackup)}>
            <Download className="size-4" /> Download backup
          </Button>
        </SettingRow>
        <SettingRow label="Restore / import" hint="Load a backup file (merge or replace).">
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Choose backup file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Import…
            </Button>
          </>
        </SettingRow>
        <SettingRow label="Tasks spreadsheet" hint="CSV for Excel or Google Sheets.">
          <Button
            size="sm"
            onClick={() =>
              void attempt(async () =>
                download(await tasksCsv(), 'personal-os-tasks.csv', 'text/csv;charset=utf-8'),
              )
            }
          >
            <FileSpreadsheet className="size-4" /> Export CSV
          </Button>
        </SettingRow>
        <SettingRow label="Erase this device" hint="Delete all data here and start over.">
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => setConfirmErase(true)}
          >
            Erase…
          </Button>
        </SettingRow>
      </Card>

      <SectionTitle icon={HardDrive}>Storage on this device</SectionTitle>
      <Card className="divide-line mb-8 divide-y">
        <SettingRow
          label="Persistent storage"
          hint="Asks the browser never to clear your data to free up space. Installing the app usually grants this."
        >
          {storage?.persisted ? (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Protected</span>
          ) : (
            <Button size="sm" onClick={() => void askPersist()}>
              Request protection
            </Button>
          )}
        </SettingRow>
        <SettingRow label="Storage used" hint="Your data lives only in this browser until sync arrives (M5).">
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
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Installed</span>
          ) : deferred ? (
            <Button size="sm" variant="primary" onClick={() => void promptInstall()}>
              <Download className="size-4" /> Install app
            </Button>
          ) : (
            <span className="text-muted text-xs">Use the browser menu → Install app</span>
          )}
        </SettingRow>
        <SettingRow label="Connection">
          <span className={cn('text-sm', online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}>
            {online ? 'Online' : 'Offline'}
          </span>
        </SettingRow>
        <SettingRow label="Version">
          <span className="text-muted text-sm tabular-nums">{__APP_VERSION__}</span>
        </SettingRow>
        <SettingRow
          label="Diagnostics"
          hint="If something looks wrong, copy this report and send it to the developer. It contains no tasks, names or notes."
        >
          <DiagnosticsButton />
        </SettingRow>
      </Card>

      {pending && <ImportDialog file={pending} onClose={() => setPending(null)} />}
      <Confirm
        open={confirmErase}
        onOpenChange={setConfirmErase}
        title="Erase everything on this device?"
        description={
          <>
            All sections, tasks, tags, history and settings on this device are deleted and you start again
            from setup. This can’t be undone — <b>download a backup first</b> if you might want your data
            back.
          </>
        }
        confirmLabel="Erase this device"
        danger
        onConfirm={async () => {
          await attempt(eraseDevice);
          window.location.assign('/');
        }}
      />
    </>
  );
}
