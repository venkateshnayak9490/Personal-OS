import {
  Bell,
  ChevronLeft,
  CalendarDays,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  FolderTree,
  Hash,
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
import { Link, useParams } from 'react-router';
import { diagnosticsReport } from '@/app/diagnostics';
import { useInstallStore } from '@/app/pwa-install';
import { attempt, toast } from '@/app/toast';
import { useThemeStore } from '@/app/theme';
import { useOnline } from '@/app/use-media-query';
import { Card, PageHeader } from '@/components/PageHeader';
import { Confirm, Sheet } from '@/components/Sheet';
import { Badge, BlockHeader, Button, Input, Select, Segmented } from '@/components/ui';
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
import { useMessages, useMeta, useProfile } from '@/core/hooks';
import { db } from '@/core/db';
import {
  getPin,
  PIN_KEY,
  removePin,
  setLockAfter,
  setPin,
  useAppLock,
  validPin,
  checkPin,
} from '@/core/repos/pin';
import { useVaultSession } from '@/core/crypto/session';
import { AccountCard } from '@/features/sync/AccountCard';
import { planOf } from '@/core/domain/health';
import { repeatOf } from '@/core/domain/reminders';
import { toICS } from '@/core/domain/ics';
import { createMessage, deleteMessage } from '@/core/repos/messages';
import { restoreFromTrash } from '@/core/repos/trash';
import { MESSAGES_OFF_KEY } from '@/features/messages/MotivationLine';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { useNodeTree } from '@/features/structure/use-tree';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/core/storage';
import type { ThemePref } from '@/core/domain/types';
import { timezoneOptions, updateProfile, updateProfileSettings } from '@/core/repos/profile';
import { tabChoices, useBottomTabs } from '@/app/BottomNav';
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
    // Label and its one-line explanation on the left, the control on the right; stacked on phones.
    <div className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        {hint && <div className="text-meta text-muted mt-0.5">{hint}</div>}
      </div>
      <div className="md:shrink-0">{children}</div>
    </div>
  );
}

/** Phone bottom bar: choose the three tabs around ＋ (More stays, so nothing becomes unreachable). */
function BottomTabsRow() {
  const tree = useNodeTree();
  const keys = useBottomTabs();
  const choices = tabChoices(tree);
  const set = (slot: number, key: string) =>
    void attempt(() =>
      updateProfileSettings((cur) => {
        // Start from what's saved (not this screen's copy): quick changes to two slots both stick.
        const saved =
          Array.isArray(cur.bottomTabs) && cur.bottomTabs.length === 3 ? (cur.bottomTabs as string[]) : keys;
        return { bottomTabs: saved.map((k, i) => (i === slot ? key : k)) };
      }),
    );
  return (
    <SettingRow label="Phone bottom bar" hint="The three tabs next to ＋. More is always there.">
      <div className="flex flex-col gap-2 md:flex-row">
        {keys.map((k, slot) => (
          <Select
            key={slot}
            aria-label={`Bottom bar tab ${slot + 1}`}
            value={k}
            onChange={(e) => set(slot, e.target.value)}
            className="md:w-36"
          >
            {choices.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key.startsWith('node:') ? `Section: ${c.label}` : c.label}
              </option>
            ))}
          </Select>
        ))}
      </div>
    </SettingRow>
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

/** A block of settings: its title over the strong hairline, then ruled rows. */
function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <BlockHeader id={id} title={title} />
      <div className="divide-line divide-y">{children}</div>
    </section>
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
    <Link to={to} className="hover:bg-surface-2 flex min-h-14 items-center gap-3 px-1 py-2.5">
      <Icon className="text-muted size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        <div className="text-meta text-muted">{hint}</div>
      </div>
      <ChevronRight className="text-muted size-4" />
    </Link>
  );
}

function ago(ms: number | undefined): string {
  if (!ms) return 'Never';
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${days} days ago (${d.toLocaleDateString([], { day: 'numeric', month: 'short' })})`;
}

/** No backup yet, or the last one is over a week old. */
const stale = (ms: number | undefined) => !ms || Date.now() - ms > 7 * 86_400_000;

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
          className="border-line-strong hover:bg-surface-2 w-full rounded-md border p-4 text-left"
        >
          <div className="text-sm font-semibold">Merge (recommended)</div>
          <div className="text-meta text-muted mt-0.5">
            Keeps everything on this device and adds what’s missing. If a record exists in both, the more
            recently edited one wins.
          </div>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('replace')}
          className="border-line-strong hover:border-danger hover:bg-surface-2 w-full rounded-md border p-4 text-left"
        >
          <div className="text-danger text-sm font-semibold">Replace everything</div>
          <div className="text-meta text-muted mt-0.5">
            Deletes all data on this device and loads the backup exactly. A backup of your current data is
            downloaded first.
          </div>
        </button>
      </div>
    </Sheet>
  );
}

/** Settings in four parts, so each fits a phone screen or two. */
const PARTS = [
  {
    key: 'general',
    label: 'General',
    icon: UserRound,
    hint: 'Name, time zone, theme, bottom bar, sections, messages',
  },
  {
    key: 'reminders',
    label: 'Reminders & privacy',
    icon: Bell,
    hint: 'Notifications, remind again, quiet hours, app lock',
  },
  { key: 'data', label: 'Data & sync', icon: Database, hint: 'Backup, import, export, storage, account' },
  {
    key: 'app',
    label: 'About this app',
    icon: Smartphone,
    hint: 'Install, version, connection, diagnostics',
  },
] as const;

export function SettingsPage() {
  const { part } = useParams();
  const current = PARTS.find((x) => x.key === part);
  const show = (key: (typeof PARTS)[number]['key']) => current?.key === key;
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
      {current ? (
        <>
          <Link
            to="/settings"
            className="text-muted hover:text-fg mb-2 inline-flex items-center gap-1 text-sm max-md:min-h-11"
          >
            <ChevronLeft className="size-4" /> Settings
          </Link>
          <PageHeader title={current.label} icon={current.icon} />
        </>
      ) : (
        <>
          <PageHeader title="Settings" icon={Settings} />
          <nav aria-label="Settings" className="divide-line divide-y">
            {PARTS.map((x) => (
              <LinkRow key={x.key} to={`/settings/${x.key}`} icon={x.icon} label={x.label} hint={x.hint} />
            ))}
          </nav>
        </>
      )}

      {show('general') && (
        <>
          <Block id="set-workspace" title="Workspace">
            <LinkRow
              to="/settings/sections"
              icon={FolderTree}
              label="Sections"
              hint="Add, rename, reorder, nest, hide, recolor"
            />
            <LinkRow to="/settings/tags" icon={Hash} label="Tags" hint="Rename, recolor or delete tags" />
            <LinkRow to="/trash" icon={Trash} label="Trash" hint="Restore deleted items (kept 30 days)" />
          </Block>

          <Block id="set-messages" title="Messages">
            <MessagesCard />
          </Block>

          <Block id="set-appearance" title="Appearance">
            <SettingRow label="Theme" hint="Dark is the default. System follows your device.">
              <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
            </SettingRow>
            <BottomTabsRow />
          </Block>

          {profile && (
            <Block id="set-profile" title="Profile">
              <SettingRow label="Name">
                <Input
                  key={displayName}
                  defaultValue={displayName}
                  aria-label="Name"
                  placeholder="Your first name"
                  className="md:w-56"
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
                  className="md:w-56"
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
                  className="md:w-56"
                >
                  <option value={1}>Monday</option>
                  <option value={0}>Sunday</option>
                </Select>
              </SettingRow>
            </Block>
          )}
        </>
      )}

      {show('data') && (
        <>
          <section aria-labelledby="set-sync" className="mb-8">
            <BlockHeader id="set-sync" title="Account & sync" />
            {/* Sign-in and sync status are one object; AccountCard pads itself. */}
            <Card className="p-0">
              <AccountCard />
            </Card>
          </section>

          <Block id="set-backup" title="Backup & data">
            <SettingRow
              label="Full backup"
              hint={
                <>
                  Everything in one readable JSON file. Last backup:{' '}
                  <b className="text-fg">{ago(lastBackup)}</b>
                  {stale(lastBackup) && (
                    <Badge tone="warning" className="ml-1.5 align-middle">
                      Due
                    </Badge>
                  )}
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
            <SettingRow
              label="Calendar file (.ics)"
              hint="Events, dated tasks, deadlines, birthdays and habit reminders. Import it into Google Calendar or your phone's calendar so you're reminded even when this app is closed. Export again after changes."
            >
              <Button
                size="sm"
                onClick={() =>
                  void attempt(async () => {
                    const [events, tasks, collections, records, habits] = await Promise.all([
                      db.events.toArray(),
                      db.tasks.toArray(),
                      db.collections.toArray(),
                      db.records.toArray(),
                      db.habits.toArray(),
                    ]);
                    const ics = toICS(
                      { events, tasks, collections, records, habits, healthPlan: planOf(profile?.settings) },
                      Date.now(),
                      profile?.timezone,
                    );
                    download(ics, 'personal-os.ics', 'text/calendar;charset=utf-8');
                  })
                }
              >
                <CalendarDays className="size-4" /> Export .ics
              </Button>
            </SettingRow>
            <SettingRow label="Erase this device" hint="Delete all data here and start over.">
              <Button
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => setConfirmErase(true)}
              >
                Erase…
              </Button>
            </SettingRow>
          </Block>

          <Block id="set-storage" title="Storage on this device">
            <SettingRow
              label="Persistent storage"
              hint="Asks the browser never to clear your data to free up space. Installing the app usually grants this."
            >
              {storage?.persisted ? (
                <span className="text-success text-sm font-medium">Protected</span>
              ) : (
                <Button size="sm" onClick={() => void askPersist()}>
                  Request protection
                </Button>
              )}
            </SettingRow>
            <SettingRow
              label="Storage used"
              hint="Your data lives only in this browser until sync arrives (M5)."
            >
              <span className="text-muted text-sm tabular-nums">
                {formatBytes(storage?.usageBytes)} of {formatBytes(storage?.quotaBytes)}
              </span>
            </SettingRow>
          </Block>
        </>
      )}

      {show('app') && (
        <Block id="set-app" title="This app">
          <SettingRow
            label="Install"
            hint={
              installed ? 'Running as an installed app.' : 'Add Personal OS to your home screen or desktop.'
            }
          >
            {installed ? (
              <span className="text-success text-sm font-medium">Installed</span>
            ) : deferred ? (
              <Button size="sm" variant="primary" onClick={() => void promptInstall()}>
                <Download className="size-4" /> Install app
              </Button>
            ) : (
              <span className="text-muted text-xs">Use the browser menu → Install app</span>
            )}
          </SettingRow>
          <SettingRow label="Connection">
            <span className={cn('text-sm', online ? 'text-success' : 'text-muted')}>
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
        </Block>
      )}

      {show('reminders') && (
        <>
          <Block id="set-reminders" title="Notifications">
            <SettingRow
              label="Reminders"
              hint="Reminders show inside the app while it is open. Allow notifications to also see them when this tab is in the background."
            >
              <NotificationsButton />
            </SettingRow>
            <SettingRow
              label="Remind again until done"
              hint="Habits and overdue tasks keep reminding you at this interval until you do them (or skip them). Dismissing a reminder doesn't mark anything done. A habit can have its own setting."
            >
              <Select
                aria-label="Remind again every"
                value={String(repeatOf(profile?.settings, ['22:30', '07:00']).everyMin)}
                onChange={(e) =>
                  void attempt(() => updateProfileSettings({ remindEveryMin: Number(e.target.value) }))
                }
                className="md:w-48"
              >
                <option value="0">Just once</option>
                <option value="15">Every 15 minutes</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every hour</option>
                <option value="120">Every 2 hours</option>
                <option value="180">Every 3 hours</option>
              </Select>
            </SettingRow>
            <SettingRow
              label="Quiet hours"
              hint="No reminders between these times. Leave as is to follow your Health plan's bedtime and wake-up."
            >
              <div className="flex items-center gap-2">
                {(['from', 'to'] as const).map((k, i) => {
                  const plan = planOf(profile?.settings);
                  const q = repeatOf(profile?.settings, [plan?.bed ?? '22:30', plan?.wake ?? '07:00']).quiet;
                  return (
                    <Input
                      key={k}
                      type="time"
                      aria-label={`Quiet hours ${k}`}
                      value={q[i]}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        void attempt(() =>
                          // From the latest saved pair, so changing both ends quickly keeps both.
                          updateProfileSettings((cur) => {
                            const p = planOf(cur);
                            const saved = repeatOf(cur, [p?.bed ?? '22:30', p?.wake ?? '07:00']).quiet;
                            return { remindQuiet: i === 0 ? [v, saved[1]] : [saved[0], v] };
                          }),
                        );
                      }}
                      className="w-32"
                    />
                  );
                })}
              </div>
            </SettingRow>
          </Block>
          <AppLockCard />
        </>
      )}

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

function NotificationsButton() {
  const supported = 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied');
  if (!supported) return <span className="text-muted text-xs">Not supported here</span>;
  if (perm === 'granted') return <span className="text-success text-sm font-medium">Allowed</span>;
  if (perm === 'denied') return <span className="text-muted text-xs">Blocked in browser settings</span>;
  return (
    <Button size="sm" onClick={() => void Notification.requestPermission().then(setPerm)}>
      Allow notifications
    </Button>
  );
}

function MessagesCard() {
  const off = useMeta<boolean>(MESSAGES_OFF_KEY);
  const mine = useMessages();
  const [text, setText] = useState('');
  const [nodeId, setNodeId] = useState<string>();
  return (
    <div className="space-y-3 py-3">
      <label className="flex min-h-11 items-center gap-2.5 text-[15px] md:min-h-0 md:text-sm">
        <input
          type="checkbox"
          checked={!off}
          onChange={(e) => void db.meta.put({ key: MESSAGES_OFF_KEY, value: !e.target.checked })}
          className="accent-[var(--fg)]"
        />
        Show a short motivational line under Today and section titles
      </label>
      {!off && (
        <>
          <form
            className="flex flex-col gap-2 md:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void attempt(() => createMessage(text, nodeId));
              setText('');
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add your own line, e.g. One more experiment, then rest."
              aria-label="Your message"
              className="md:flex-1"
            />
            <SectionSelect value={nodeId} onChange={setNodeId} noneLabel="Anywhere" className="md:w-44" />
            <Button type="submit" disabled={!text.trim()}>
              Add
            </Button>
          </form>
          {!!mine?.length && (
            <ul className="divide-line border-line divide-y border-t">
              {mine.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-1.5 text-[15px] md:text-sm">
                  <span className="min-w-0 flex-1">{m.text}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete message ${m.text}`}
                    onClick={() =>
                      void attempt(async () => {
                        const b = await deleteMessage(m.id);
                        if (b) toast('Message moved to Trash', () => restoreFromTrash(b));
                      })
                    }
                  >
                    <Trash className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const LOCK_AFTER = [
  { value: 0, label: 'Right away' },
  { value: 60_000, label: 'After 1 minute away' },
  { value: 5 * 60_000, label: 'After 5 minutes away' },
  { value: 15 * 60_000, label: 'After 15 minutes away' },
];

/** App PIN: a privacy screen for this device. */
function AppLockCard() {
  const cfg = useMeta<{ afterMs: number }>(PIN_KEY);
  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const reset = () => {
    setMode('idle');
    setA('');
    setB('');
  };
  return (
    <Block id="set-lock" title="App lock">
      <SettingRow
        label="PIN"
        hint={
          cfg
            ? 'On. Asked when the app opens and when you come back to it.'
            : 'Ask for a PIN when the app opens, so someone with your phone or laptop can’t look around. It doesn’t encrypt anything; the Vault does that.'
        }
      >
        {cfg ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                useAppLock.getState().set(true);
                useVaultSession.getState().lock();
              }}
            >
              Lock now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('remove')}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setMode('set')}>
            Set a PIN
          </Button>
        )}
      </SettingRow>
      {cfg && (
        <SettingRow label="Lock again" hint="When you switch away from the app and come back.">
          <Select
            aria-label="Lock again"
            value={cfg.afterMs}
            onChange={(e) => void attempt(() => setLockAfter(Number(e.target.value)))}
            className="md:w-auto"
          >
            {LOCK_AFTER.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </SettingRow>
      )}
      {mode !== 'idle' && (
        <form
          className="flex flex-wrap items-center gap-2 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void attempt(async () => {
              if (mode === 'set') {
                if (a !== b) throw new Error('The two PINs don’t match.');
                await setPin(a, (await getPin())?.afterMs ?? 60_000);
                useAppLock.getState().set(false);
                toast('PIN set. You’ll be asked for it when the app opens.');
              } else {
                if (!(await checkPin(a))) throw new Error('That’s not the PIN.');
                await removePin();
                toast('App lock turned off');
              }
              reset();
            });
          }}
        >
          <Input
            type="password"
            inputMode="numeric"
            aria-label={mode === 'set' ? 'New PIN' : 'Current PIN'}
            placeholder={mode === 'set' ? 'New PIN (4–8 digits)' : 'Current PIN'}
            value={a}
            maxLength={8}
            onChange={(e) => setA(e.target.value.replace(/\D/g, ''))}
            className="max-md:flex-1 md:w-44"
          />
          {mode === 'set' && (
            <Input
              type="password"
              inputMode="numeric"
              aria-label="PIN again"
              placeholder="Again"
              value={b}
              maxLength={8}
              onChange={(e) => setB(e.target.value.replace(/\D/g, ''))}
              className="max-md:flex-1 md:w-32"
            />
          )}
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={mode === 'set' ? !validPin(a) || !b : !a}
          >
            {mode === 'set' ? 'Save PIN' : 'Turn off'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </form>
      )}
    </Block>
  );
}
