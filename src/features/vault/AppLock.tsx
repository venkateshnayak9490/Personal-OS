import { useLiveQuery } from 'dexie-react-hooks';
import { LockKeyhole } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button, Input } from '@/components/ui';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
import { checkPin, PIN_KEY, removePin, useAppLock, waitAfter, type PinConfig } from '@/core/repos/pin';
import { unlock as unlockVault, VAULT_ID } from '@/core/repos/vault';

/**
 * Shows the app only after the PIN, when one is set. Locks again after the app has been in the
 * background for the chosen time, and locks the Vault with it.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const pin = useLiveQuery(
    async () => ((await db.meta.get(PIN_KEY))?.value as PinConfig | undefined) ?? null,
    [],
  );
  const locked = useAppLock((s) => s.locked);

  useEffect(() => {
    if (pin === null) useAppLock.getState().set(false);
  }, [pin]);

  useEffect(() => {
    if (!pin) return;
    const onVis = () => {
      const s = useAppLock.getState();
      if (document.hidden) useAppLock.setState({ hiddenAt: Date.now() });
      else if (s.hiddenAt !== null && Date.now() - s.hiddenAt >= pin.afterMs) {
        s.set(true);
        useVaultSession.getState().lock();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pin]);

  if (pin === undefined) return null; // a moment while the setting loads: never flash the app
  if (pin && locked) return <LockScreen />;
  return <>{children}</>;
}

function LockScreen() {
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [forgot, setForgot] = useState(false);
  const now = useNow(1000);
  const hasVault = useLiveQuery(async () => !!(await db.vaultMeta.get(VAULT_ID)), []);
  const wait = Math.max(0, until - now);

  const submit = () =>
    void attempt(async () => {
      if (await checkPin(pin)) {
        useAppLock.getState().set(false);
        return;
      }
      const n = fails + 1;
      setFails(n);
      setUntil(Date.now() + waitAfter(n));
      setPin('');
    });

  return (
    <main className="bg-bg fixed inset-0 z-[100] grid place-items-center px-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <div className="border-line-strong mx-auto grid size-12 place-items-center rounded-md border">
          <LockKeyhole aria-hidden className="text-fg size-6" />
        </div>
        <h1 className="title-page border-fg mx-auto w-fit border-b-2 pb-2">Personal OS is locked</h1>
        {!forgot ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin && !wait) submit();
            }}
          >
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              aria-label="PIN"
              placeholder="PIN"
              value={pin}
              maxLength={8}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em]"
            />
            {fails > 0 && (
              <p role="alert" className="text-danger text-sm font-medium">
                Wrong PIN.{wait ? ` Try again in ${Math.ceil(wait / 1000)} s.` : ''}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={pin.length < 4 || !!wait}>
              Unlock
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setForgot(true)}>
              Forgot your PIN?
            </Button>
          </form>
        ) : hasVault ? (
          <ForgotWithVault onBack={() => setForgot(false)} />
        ) : (
          <div className="space-y-3">
            <p className="text-fg-2 text-sm leading-relaxed">
              Without the PIN, the app can only be reopened by clearing this site’s data in your browser
              settings (which erases what’s on this device; restore from a backup afterwards). Setting up the
              Vault gives you a passphrase that can reset the PIN.
            </p>
            <Button variant="ghost" onClick={() => setForgot(false)}>
              Back
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

/** The Vault passphrase proves it's you: it unlocks the app and removes the PIN. */
function ForgotWithVault({ onBack }: { onBack: () => void }) {
  const [pass, setPass] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void attempt(async () => {
          if (await unlockVault(pass)) {
            await removePin();
            useAppLock.getState().set(false);
          } else setWrong(true);
        }).finally(() => setBusy(false));
      }}
    >
      <p className="text-fg-2 text-sm">
        Enter your Vault passphrase. The PIN is removed; you can set a new one in Settings.
      </p>
      <Input
        type="password"
        aria-label="Vault passphrase"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      {wrong && (
        <p role="alert" className="text-danger text-sm font-medium">
          That passphrase didn’t work.
        </p>
      )}
      <div className="flex justify-center gap-2">
        <Button type="submit" variant="primary" disabled={!pass || busy}>
          {busy ? 'Checking…' : 'Remove PIN'}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}
