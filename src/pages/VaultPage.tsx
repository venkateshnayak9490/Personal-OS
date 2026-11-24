import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Lock,
  LockKeyhole,
  LockOpen,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Trash,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { Confirm } from '@/components/Sheet';
import { Badge, BlockHeader, Button, EmptyState, Field, Input, Loading, Textarea } from '@/components/ui';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
import { MIN_PASSPHRASE } from '@/core/crypto/vault';
import type { VaultContent, VaultItem } from '@/core/domain/types';
import { download } from '@/core/backup';
import { restoreFromTrash } from '@/core/repos/trash';
import {
  addVaultFile,
  changeVaultPassphrase,
  createVaultItem,
  deleteVaultItem,
  lockVault,
  readVaultItem,
  recover,
  saveVaultItem,
  setupVault,
  VAULT_ID,
  vaultFileBlob,
} from '@/core/repos/vault';
import { UnlockForm } from '@/features/vault/Unlock';
import { cn } from '@/lib/cn';

const MIN = MIN_PASSPHRASE; // 4, your choice

export function VaultPage() {
  const meta = useLiveQuery(async () => (await db.vaultMeta.get(VAULT_ID)) ?? null, []);
  const key = useVaultSession((s) => s.key);
  const [forgot, setForgot] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  if (meta === undefined) return <Loading />;
  return (
    <>
      <PageHeader
        title="Vault"
        icon={LockKeyhole}
        subtitle="Encrypted on this device with your passphrase. Without it, nobody can read what’s here, including us."
        actions={
          meta && !meta.deletedAt && !recovery ? (
            // The state in words and a mark, never colour alone.
            key ? (
              <>
                <Badge>
                  <LockOpen aria-hidden className="size-3" /> Unlocked
                </Badge>
                <Button size="sm" onClick={lockVault}>
                  <Lock className="size-4" /> Lock
                </Button>
              </>
            ) : (
              <Badge>
                <Lock aria-hidden className="size-3" /> Locked
              </Badge>
            )
          ) : undefined
        }
      />
      {recovery ? (
        <RecoveryKey recovery={recovery} onDone={() => setRecovery(null)} />
      ) : !meta || meta.deletedAt ? (
        <Setup onCreated={setRecovery} />
      ) : !key ? (
        forgot ? (
          <Recover onBack={() => setForgot(false)} />
        ) : (
          <UnlockForm onForgot={() => setForgot(true)} />
        )
      ) : (
        <Items />
      )}
    </>
  );
}

function Setup({ onCreated }: { onCreated: (recovery: string) => void }) {
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = pass.length >= MIN && pass === again;
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        void attempt(async () => onCreated(await setupVault(pass))).finally(() => setBusy(false));
      }}
    >
      <p className="text-sm">
        Choose a passphrase you’ll remember. Four or five unrelated words work well; don’t reuse a password
        from elsewhere.
      </p>
      <Field
        label="Passphrase"
        htmlFor="v-pass"
        hint={pass && pass.length < MIN ? `At least ${MIN} characters.` : undefined}
      >
        <Input
          id="v-pass"
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
      </Field>
      <Field
        label="Type it again"
        htmlFor="v-again"
        hint={again && again !== pass ? 'They don’t match yet.' : undefined}
      >
        <Input
          id="v-again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </Field>
      <p className="border-line-strong text-fg-2 text-meta rounded-md border p-3">
        Next you’ll get a recovery key. If you forget the passphrase <b className="text-fg">and</b> lose the
        recovery key, what’s in the Vault can’t be recovered by anyone. That’s what makes it a real vault.
      </p>
      <Button type="submit" variant="primary" disabled={!ok || busy}>
        {busy ? 'Creating…' : 'Create Vault'}
      </Button>
    </form>
  );
}

function RecoveryKey({ recovery, onDone }: { recovery: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <section aria-labelledby="rk" className="max-w-lg space-y-4">
      <BlockHeader
        id="rk"
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4" /> Your recovery key
          </span>
        }
      />
      <p className="text-sm">
        Write it down or save it somewhere safe outside this app. It’s shown only now. With it you can set a
        new passphrase if you ever forget yours.
      </p>
      <code
        aria-label="Recovery key"
        className="border-line-strong bg-surface block rounded-md border p-4 text-center font-mono text-lg tracking-wider break-all select-all"
      >
        {recovery}
      </code>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(recovery).then(() => toast('Copied'))}
        >
          Copy
        </Button>
        <Button
          size="sm"
          onClick={() =>
            download(
              `Personal OS Vault recovery key\n\n${recovery}\n\nKeep this safe and private.\n`,
              'personal-os-recovery-key.txt',
              'text/plain',
            )
          }
        >
          Download as a file
        </Button>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-8">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="size-4 accent-[var(--fg)]"
        />
        I’ve saved my recovery key
      </label>
      <Button variant="primary" disabled={!saved} onClick={onDone}>
        Open the Vault
      </Button>
    </section>
  );
}

function Recover({ onBack }: { onBack: () => void }) {
  const [rk, setRk] = useState('');
  const [pass, setPass] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void attempt(async () => {
          const ok = await recover(rk, pass);
          setWrong(!ok);
          if (ok) toast('New passphrase set. Your recovery key still works.');
        }).finally(() => setBusy(false));
      }}
    >
      <Field label="Recovery key" htmlFor="v-rk">
        <Input
          id="v-rk"
          value={rk}
          onChange={(e) => setRk(e.target.value)}
          placeholder="XXXX-XXXX-…"
          autoComplete="off"
        />
      </Field>
      <Field
        label="New passphrase"
        htmlFor="v-new"
        hint={pass && pass.length < MIN ? `At least ${MIN} characters.` : undefined}
      >
        <Input
          id="v-new"
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
      </Field>
      {wrong && <p className="text-danger text-sm">That recovery key didn’t work.</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!rk || pass.length < MIN || busy}>
          {busy ? 'Checking…' : 'Set new passphrase'}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}

/** Decrypted items, kept only in this component's memory. */
function Items() {
  const items = useLiveQuery(async () => (await db.vaultItems.toArray()).filter((i) => !i.deletedAt), []);
  const [plain, setPlain] = useState<Map<string, VaultContent>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!items) return;
    let live = true;
    void Promise.all(items.map(async (i) => [i.id, await readVaultItem(i)] as const)).then(
      (pairs) => live && setPlain(new Map(pairs)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [items]);

  if (!items) return <Loading />;
  const needle = q.trim().toLowerCase();
  const list = items
    .map((i) => ({ i, c: plain.get(i.id) }))
    .filter(({ c }) => !needle || (c && `${c.title} ${c.text}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.i.updatedAt - a.i.updatedAt);
  const open = items.find((i) => i.id === openId);
  const openPlain = openId ? plain.get(openId) : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Vault items" className="min-w-0">
        <Button
          size="sm"
          variant="primary"
          className="mb-2 w-full"
          onClick={() =>
            void attempt(async () => setOpenId((await createVaultItem({ title: '', text: '' })).id))
          }
        >
          <Plus className="size-4" /> New item
        </Button>
        <div className="relative mb-2">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search the Vault"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {list.length > 0 && (
          <ul className="divide-line border-line-strong divide-y border-t">
            {list.map(({ i, c }) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(i.id)}
                  aria-current={i.id === openId ? 'true' : undefined}
                  className={cn(
                    'hover:bg-surface-2/60 block min-h-11 w-full px-2 py-2 text-left',
                    i.id === openId && 'bg-surface-2 shadow-[inset_2px_0_0_var(--fg)]',
                  )}
                >
                  <span className="block truncate text-sm font-medium">{c?.title ?? '…'}</span>
                  {/* Never the item's text here: a list preview must not show secrets. */}
                  <span className="text-meta text-muted block truncate">
                    {c
                      ? c.files.length
                        ? `${c.files.length} file${c.files.length > 1 ? 's' : ''}`
                        : c.text
                          ? 'Text'
                          : 'Empty'
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-line mt-6 border-t pt-2">
          <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setChanging(true)}>
            Change passphrase
          </Button>
          {changing && <ChangePassphrase onDone={() => setChanging(false)} />}
        </div>
      </aside>
      <div className="min-w-0">
        {open && openPlain ? (
          <ItemEditor key={open.id} item={open} content={openPlain} onDeleted={() => setOpenId(null)} />
        ) : (
          <EmptyState compact icon={LockKeyhole} title={items.length ? 'Pick an item.' : 'Nothing here yet.'}>
            {!items.length && 'Good for ID scans, certificates, policy numbers and private notes.'}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  content,
  onDeleted,
}: {
  item: VaultItem;
  content: VaultContent;
  onDeleted: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<VaultContent['files'][number] | null>(null);
  const save = (c: VaultContent) => void attempt(() => saveVaultItem(item.id, c));
  const open = async (f: VaultContent['files'][number]) => {
    const blob = await vaultFileBlob(f.fileId, f.type);
    if (!blob) return toast(`“${f.name}” isn’t on this device.`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    if (!/^(image\/|application\/pdf|text\/)/.test(f.type)) a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <article className="max-w-[75ch] space-y-4">
      <div className="border-line-strong focus-within:border-focus flex items-center gap-1 border-b pb-1.5">
        <input
          aria-label="Item title"
          placeholder="Untitled"
          key={content.title}
          defaultValue={content.title === 'Untitled' ? '' : content.title}
          autoFocus={content.title === 'Untitled'}
          onBlur={(e) =>
            (e.target.value.trim() || 'Untitled') !== content.title &&
            save({ ...content, title: e.target.value.trim() || 'Untitled' })
          }
          className="title-page placeholder:text-muted min-h-11 min-w-0 flex-1 bg-transparent outline-none md:min-h-10"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete item"
          onClick={() =>
            void attempt(async () => {
              const b = await deleteVaultItem(item.id);
              if (b) toast('Moved to Trash (still encrypted)', () => restoreFromTrash(b));
              onDeleted();
            })
          }
        >
          <Trash className="size-4" />
        </Button>
      </div>
      <Textarea
        aria-label="Item text"
        key={content.text}
        defaultValue={content.text}
        placeholder="Numbers, notes, anything private"
        className="min-h-40 font-mono text-sm"
        onBlur={(e) => e.target.value !== content.text && save({ ...content, text: e.target.value })}
      />
      <div>
        {content.files.length > 0 && <BlockHeader title="Files" count={content.files.length} />}
        <ul className="divide-line divide-y">
          {content.files.map((f) => (
            <li key={f.fileId} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void open(f)}
                className="hover:bg-surface-2/60 flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm md:min-h-9"
              >
                <FileText className="text-muted size-4 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${f.name}`}
                onClick={() => setRemoving(f)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Confirm
          open={!!removing}
          onOpenChange={(o) => !o && setRemoving(null)}
          title={`Remove “${removing?.name ?? ''}”?`}
          description="The file is taken out of this item."
          confirmLabel="Remove file"
          danger
          onConfirm={() => {
            if (removing)
              save({ ...content, files: content.files.filter((x) => x.fileId !== removing.fileId) });
            setRemoving(null);
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Add encrypted files"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void attempt(async () => {
              for (const f of files) {
                const fresh = (await db.vaultItems.get(item.id))!;
                await addVaultFile(fresh, f);
              }
            });
          }}
        />
        <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
          <Paperclip className="size-4" /> Add file
        </Button>
        <span className="text-meta text-muted ml-2">encrypted before it’s stored · up to 25 MB</span>
      </div>
    </article>
  );
}

function ChangePassphrase({ onDone }: { onDone: () => void }) {
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void attempt(async () => {
          const ok = await changeVaultPassphrase(old, next);
          setWrong(!ok);
          if (ok) {
            toast('Passphrase changed');
            onDone();
          }
        });
      }}
    >
      <Input
        type="password"
        aria-label="Current passphrase"
        placeholder="Current"
        value={old}
        onChange={(e) => setOld(e.target.value)}
      />
      <Input
        type="password"
        aria-label="New passphrase"
        placeholder={`New (${MIN}+ characters)`}
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      {wrong && <p className="text-danger text-meta">The current passphrase didn’t work.</p>}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!old || next.length < MIN}>
          Change
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
