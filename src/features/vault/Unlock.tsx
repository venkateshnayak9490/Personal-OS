import { useState } from 'react';
import { attempt } from '@/app/toast';
import { Button, Input } from '@/components/ui';
import { unlock } from '@/core/repos/vault';

/** Passphrase box. Argon2id takes about a second on purpose (it's what slows down guessing). */
export function UnlockForm({ onForgot, compact }: { onForgot?: () => void; compact?: boolean }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className={compact ? 'flex flex-wrap items-center gap-2' : 'max-w-sm space-y-3'}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void attempt(async () => {
          const ok = await unlock(pass);
          setWrong(!ok);
          if (ok) setPass('');
        }).finally(() => setBusy(false));
      }}
    >
      <Input
        type="password"
        aria-label="Vault passphrase"
        placeholder="Vault passphrase"
        autoComplete="current-password"
        autoFocus={!compact}
        value={pass}
        onChange={(e) => {
          setPass(e.target.value);
          setWrong(false);
        }}
        className={compact ? 'w-56' : undefined}
      />
      <Button type="submit" variant="primary" disabled={!pass || busy}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </Button>
      {wrong && (
        <p role="alert" className="text-danger text-sm font-medium">
          That passphrase didn’t work.
        </p>
      )}
      {onForgot && (
        <button
          type="button"
          onClick={onForgot}
          className="text-muted hover:text-fg text-meta block min-h-11 underline-offset-2 hover:underline md:min-h-8"
        >
          Forgot the passphrase?
        </button>
      )}
    </form>
  );
}
