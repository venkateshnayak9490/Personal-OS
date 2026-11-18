import { Check } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { Button } from '@/components/ui';
import { useProfile } from '@/core/hooks';
import { PROFILE_OPTIONS } from '@/core/domain/templates';
import type { ProfileType } from '@/core/domain/types';
import { completeOnboarding } from '@/core/repos/profile';
import { syncConfigured } from '@/core/sync/supabase';
import { AccountCard } from '@/features/sync/AccountCard';
import { SyncRunner } from '@/features/sync/SyncRunner';
import { cn } from '@/lib/cn';

/**
 * First run: one screen, two optional questions. Everything else (research areas, courses, adviser,
 * theme, time zone) is suggested afterwards on Today, never required up front.
 */
export function OnboardingPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [types, setTypes] = useState<ProfileType[]>([]);
  const [saving, setSaving] = useState(false);

  if (profile) return <Navigate to="/" replace />;

  const toggle = (t: ProfileType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const start = async () => {
    setSaving(true);
    const done = await attempt(() =>
      completeOnboarding({ profileTypes: types.length ? types : ['other'], displayName: name }),
    );
    setSaving(false);
    if (done) navigate('/', { replace: true });
  };

  return (
    <div className="bg-bg min-h-dvh px-5 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <form
        className="mx-auto flex max-w-md flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <img src="/favicon.svg" alt="" className="mb-8 size-12 rounded-xl" />
        <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
          Your work, growth and life in one calm place.
        </h1>
        <p className="text-muted mt-4 text-[15px] leading-relaxed md:text-base">
          Two quick questions, both optional. Your data stays on this device, and you don’t need an account.
        </p>

        <label htmlFor="ob-name" className="mt-10 mb-2 block text-[15px] font-medium md:text-sm">
          What should we call you?
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          className="border-line placeholder:text-muted/70 focus:border-fg/50 h-12 border-b bg-transparent text-xl focus:outline-none"
        />

        <fieldset className="mt-10">
          <legend className="mb-1 text-[15px] font-medium md:text-sm">What do you do?</legend>
          <p className="text-muted mb-4 text-[13px]">Pick any. This only decides your starter sections.</p>
          <div className="flex flex-wrap gap-2">
            {PROFILE_OPTIONS.map((o) => {
              const on = types.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors md:h-10 md:text-sm',
                    on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:bg-surface-2',
                  )}
                >
                  {on && <Check className="-ml-1 size-4" strokeWidth={2.5} />}
                  {o.value === 'other' ? 'Something else' : o.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button type="submit" variant="primary" disabled={saving} className="mt-12 h-12 text-base md:h-12">
          {saving ? 'Setting up…' : 'Get started'}
        </Button>
        <p className="text-muted mt-3 text-center text-[13px]">
          You can rename, add or remove anything later.
        </p>
      </form>
      <div className="mx-auto max-w-md">
        {/* A second device: sign in first, so your sections arrive instead of new starter ones. */}
        {syncConfigured && (
          <details className="border-line mt-10 rounded-2xl border">
            <summary className="cursor-pointer px-4 py-3 text-[15px] font-medium md:text-sm">
              Already use Personal OS on another device? Sign in
            </summary>
            <AccountCard redirectPath="/welcome" />
          </details>
        )}
        <SyncRunner />
      </div>
    </div>
  );
}
