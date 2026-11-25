import { formatDistanceToNowStrict } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { Confirm } from '@/components/Sheet';
import { Button, Input } from '@/components/ui';
import { db } from '@/core/db';
import { mergeDuplicateSections, planSectionMerges } from '@/core/repos/merge-sections';
import { resetSyncState } from '@/core/sync/engine';
import { supabase, supabaseBackend, syncConfigured } from '@/core/sync/supabase';
import { syncNow, useSync } from './SyncRunner';

/** Settings: sign in with an emailed link, see sync status, sign out, delete cloud data. */
export function AccountCard({ redirectPath = '/settings/data' }: { redirectPath?: string }) {
  const { session, state, lastAt, error, conflicts } = useSync();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const twins = useLiveQuery(async () => planSectionMerges(await db.nodes.toArray()).length, []) ?? 0;

  if (!syncConfigured)
    return (
      <div className="flex items-start gap-3 p-4">
        <CloudOff className="text-muted mt-0.5 size-5 shrink-0" />
        <p className="text-muted text-sm">
          Sync isn’t switched on for this copy of the app yet. Everything stays on this device; keep using
          backups.
        </p>
      </div>
    );

  if (!session)
    return (
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void attempt(async () => {
            const { error: err } = await supabase!.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: `${location.origin}${redirectPath}` },
            });
            if (err) throw new Error(err.message);
            setSent(true);
          });
        }}
      >
        <p className="text-sm">
          Sign in to keep your phone and laptop in sync. Everything you have here is uploaded and merged;
          nothing is lost. The Vault and private journal entries stay encrypted: the server only ever sees
          ciphertext.
        </p>
        {sent ? (
          <p className="text-sm font-medium">Check your email and open the sign-in link on this device.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              autoComplete="email"
              aria-label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-64"
            />
            <Button type="submit" variant="primary" disabled={!/.+@.+\..+/.test(email)}>
              Email me a sign-in link
            </Button>
          </div>
        )}
      </form>
    );

  const status =
    state === 'syncing'
      ? 'Syncing…'
      : state === 'error'
        ? `Couldn’t sync: ${error}`
        : lastAt
          ? `Synced ${formatDistanceToNowStrict(lastAt, { addSuffix: true })}`
          : 'Waiting to sync';

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Cloud className="text-success size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{session.user.email}</div>
          <div
            className={state === 'error' ? 'text-danger text-xs' : 'text-muted text-xs'}
            aria-live="polite"
          >
            {status}
            {!navigator.onLine && ' · offline, will sync when you’re back online'}
          </div>
        </div>
        <Button size="sm" onClick={() => void syncNow()} disabled={state === 'syncing'}>
          <RefreshCw className="size-4" /> Sync now
        </Button>
      </div>
      {conflicts > 0 && (
        <p className="text-muted text-xs">
          {conflicts} text{conflicts > 1 ? 's were' : ' was'} edited on two devices at once. The other version
          is saved as a pinned note named “Conflict copy: …”.
        </p>
      )}
      {twins > 0 && (
        <div className="border-line-strong flex flex-wrap items-center gap-x-3 gap-y-2 border-y py-2">
          <p className="min-w-0 flex-1 text-sm">
            {twins} starter section{twins > 1 ? 's appear' : ' appears'} twice, because each device was set up
            before syncing.
          </p>
          <Button size="sm" onClick={() => setConfirmMerge(true)}>
            Merge duplicates
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void attempt(async () => {
              await supabase!.auth.signOut();
              await resetSyncState();
              toast('Signed out. Your data stays on this device.');
            })
          }
        >
          Sign out
        </Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
          Delete my cloud data
        </Button>
      </div>
      <Confirm
        open={confirmMerge}
        onOpenChange={setConfirmMerge}
        title="Merge duplicate sections?"
        description="Each section is kept once. Tasks, projects, notes, list items, page text and subsections from the spare copy move into the one that’s kept. The empty spare copies go to the Trash as one entry, which you can restore. Run it on one device only; the others pick it up through sync."
        confirmLabel="Merge"
        onConfirm={async () => {
          await attempt(async () => {
            const n = await mergeDuplicateSections();
            toast(`Merged ${n} duplicate section${n === 1 ? '' : 's'}. The spare copies are in the Trash.`);
          });
        }}
      />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your data from the cloud?"
        description="Everything stored for your account on the server is deleted and you’re signed out. What’s on this device stays. Other signed-in devices keep their own copies. This can’t be undone."
        confirmLabel="Delete cloud data"
        danger
        onConfirm={async () => {
          await attempt(async () => {
            await supabaseBackend.deleteAll();
            await supabase!.auth.signOut();
            await resetSyncState();
            toast('Cloud data deleted. You’re signed out; this device keeps its data.');
          });
        }}
      />
    </div>
  );
}
