import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Lock, LockKeyhole, Paperclip, Plus, Search, ShieldCheck, Trash, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Loading, Textarea } from '@/components/ui';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
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

const MIN = 10;

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
          key && !recovery ? (
            <Button size="sm" onClick={lockVault}>
              <Lock className="size-4" /> Lock
            </Button>
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
      <p className="border-line text-muted rounded-xl border p-3 text-xs">
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
      <h2 id="rk" className="flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="text-sec-self size-5" /> Your recovery key
      </h2>
      <p className="text-sm">
        Write it down or save it somewhere safe outside this app. It’s shown only now. With it you can set a
        new passphrase if you ever forget yours.
      </p>
      <code
        aria-label="Recovery key"
        className="bg-surface-2 block rounded-xl p-4 text-center font-mono text-lg tracking-wider select-all"
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="accent-[var(--fg)]"
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
        <ul className="space-y-0.5">
          {list.map(({ i, c }) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setOpenId(i.id)}
                className={cn(
                  'hover:bg-surface-2/60 w-full rounded-lg px-3 py-2 text-left',
                  i.id === openId && 'bg-surface-2',
                )}
              >
                <div className="truncate text-sm font-medium">{c?.title ?? '…'}</div>
                <div className="text-muted truncate text-xs">
                  {c
                    ? c.files.length
                      ? `${c.files.length} file${c.files.length > 1 ? 's' : ''}`
                      : c.text.slice(0, 40) || 'Empty'
                    : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="text-muted hover:text-fg mt-4 text-xs underline-offset-2 hover:underline"
        >
          Change passphrase
        </button>
        {changing && <ChangePassphrase onDone={() => setChanging(false)} />}
      </aside>
      <div className="min-w-0">
        {open && openPlain ? (
          <ItemEditor key={open.id} item={open} content={openPlain} onDeleted={() => setOpenId(null)} />
        ) : (
          <p className="text-muted py-8 text-sm">
            {items.length
              ? 'Pick an item.'
              : 'Nothing here yet. Good for ID scans, certificates, policy numbers and private notes.'}
          </p>
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
    <article className="space-y-4">
      <div className="flex items-center gap-2">
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
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none"
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
        {content.files.map((f) => (
          <div key={f.fileId} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void open(f)}
              className="hover:bg-surface-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
            >
              <FileText className="text-muted size-4 shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${f.name}`}
              onClick={() => save({ ...content, files: content.files.filter((x) => x.fileId !== f.fileId) })}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
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
        <span className="text-muted ml-2 text-xs">encrypted before it’s stored · up to 25 MB</span>
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
      {wrong && <p className="text-danger text-xs">The current passphrase didn’t work.</p>}
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
