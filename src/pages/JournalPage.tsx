import { addDays, format, parseISO } from 'date-fns';
import { BookHeart, ChevronLeft, ChevronRight, Lock, Trash } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { PageHeader } from '@/components/PageHeader';
import { Button, Loading } from '@/components/ui';
import { useJournal, useProfile } from '@/core/hooks';
import { toLocalDate } from '@/core/domain/tasks';
import type { Mood } from '@/core/domain/types';
import {
  deleteJournalEntry,
  readJournalBody,
  saveJournalBody,
  setMood,
  setPrivate,
} from '@/core/repos/notes';
import { db } from '@/core/db';
import { useVaultSession } from '@/core/crypto/session';
import { UnlockForm } from '@/features/vault/Unlock';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';

const RichEditor = lazy(() => import('@/features/pages/PageEditor').then((m) => ({ default: m.RichEditor })));

export const MOODS: { value: Mood; label: string }[] = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];
const moodLabel = (m?: Mood) => MOODS.find((x) => x.value === m)?.label;

/** One entry per day. /journal?date=2026-11-18 opens a given day. */
export function JournalPage() {
  const now = useNow();
  const today = toLocalDate(now);
  const profile = useProfile();
  const entries = useJournal();
  const [params, setParams] = useSearchParams();
  const asked = params.get('date');
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const key = useVaultSession((s) => s.key);
  const hasVault = useLiveQuery(async () => !!(await db.vaultMeta.get('vault')), []);
  const [notice, setNotice] = useState<'setup' | 'unlock' | null>(null);
  const current = entries?.find((e) => e.date === date);
  // Decrypted body of the day's private entry, tagged with what it was decrypted from.
  const tag = current?.cipher && key ? `${current.id}:${current.cipher.ct}` : '';
  const [decrypted, setDecrypted] = useState<{ tag: string; body: { doc?: unknown; text: string } | null }>();
  useEffect(() => {
    if (!tag || !current) return;
    let live = true;
    void readJournalBody(current).then(
      (b) => live && setDecrypted({ tag, body: b }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [tag]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = decrypted?.tag === tag ? decrypted.body : null;
  const go = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });

  if (!entries) return <Loading />;
  const entry = entries.find((e) => e.date === date);
  const locked = !!entry?.cipher && !key;
  const shift = (n: number) => go(format(addDays(parseISO(date), n), 'yyyy-MM-dd'));

  const remove = () =>
    void attempt(async () => {
      const b = await deleteJournalEntry(date);
      if (b) toast('Entry moved to Trash', () => restoreFromTrash(b));
    });

  return (
    <>
      <PageHeader title="Journal" icon={BookHeart} subtitle="A quiet place to write. One page a day." />
      <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
        <article className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Previous day" onClick={() => shift(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="w-52">
              <DatePicker
                value={date}
                weekStartsOn={profile?.weekStartsOn}
                onChange={(v) => v && v <= today && go(v)}
              >
                <DateButton label="Journal date" value={date} />
              </DatePicker>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next day"
              disabled={date >= today}
              onClick={() => shift(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            {date !== today && (
              <Button size="sm" variant="ghost" onClick={() => go(today)}>
                Today
              </Button>
            )}
          </div>

          <h2 className="mb-3 text-2xl font-semibold tracking-tight">
            {format(parseISO(date), 'EEEE d MMMM yyyy')}
          </h2>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div role="radiogroup" aria-label="Mood" className="flex gap-1">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={entry?.mood === m.value}
                  onClick={() =>
                    void attempt(() => setMood(date, entry?.mood === m.value ? undefined : m.value))
                  }
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium',
                    entry?.mood === m.value
                      ? 'bg-fg text-bg border-transparent'
                      : 'border-line text-muted hover:text-fg',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="text-muted flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!entry?.isPrivate}
                onChange={(e) => {
                  // Private means encrypted: that needs the Vault, set up and unlocked.
                  if (!hasVault) return setNotice('setup');
                  if (!key) return setNotice('unlock');
                  setNotice(null);
                  void attempt(() => setPrivate(date, e.target.checked));
                }}
                className="accent-[var(--fg)]"
              />
              <Lock className="size-3.5" /> Private
            </label>
            {entry && (
              <Button variant="ghost" size="sm" className="text-muted ml-auto" onClick={remove}>
                <Trash className="size-4" /> Delete entry
              </Button>
            )}
          </div>
          {notice === 'setup' && (
            <p className="border-line mb-4 rounded-xl border p-3 text-sm">
              Private entries are encrypted with your Vault.{' '}
              <Link to="/vault" className="font-medium underline underline-offset-2">
                Set up the Vault
              </Link>{' '}
              first, then come back.
            </p>
          )}
          {entry?.isPrivate && key && (
            <p className="text-muted mb-3 text-xs">
              Private: encrypted with your Vault key, and kept out of search, reviews and the list.
            </p>
          )}

          {(locked || (notice === 'unlock' && !key)) && (
            <div className="border-line mb-4 space-y-2 rounded-xl border p-4">
              <p className="text-sm">
                {locked
                  ? 'This entry is private. Unlock the Vault to read and write it.'
                  : 'Unlock the Vault to make this entry private.'}
              </p>
              <UnlockForm compact />
            </div>
          )}
          {!locked && (!entry?.cipher || body) && (
            <Suspense fallback={<div className="min-h-10" />}>
              <RichEditor
                key={`${date}:${entry?.cipher ? 'private' : 'plain'}`}
                label="Journal entry"
                initial={entry && !entry.deletedAt ? (entry.cipher ? body?.doc : entry.doc) : undefined}
                placeholder="How was today? What’s on your mind?"
                onSave={(doc, text) => saveJournalBody(date, doc, text)}
              />
            </Suspense>
          )}
        </article>

        <aside aria-labelledby="journal-past">
          <h2 id="journal-past" className="text-muted mb-2 text-xs font-medium">
            Earlier entries
          </h2>
          {entries.length === 0 ? (
            <p className="text-muted text-sm">Nothing yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {entries.slice(0, 60).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => go(e.date)}
                    aria-current={e.date === date ? 'date' : undefined}
                    className={cn(
                      'hover:bg-surface-2/60 w-full rounded-lg px-3 py-2 text-left',
                      e.date === date && 'bg-surface-2',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{format(parseISO(e.date), 'EEE d MMM')}</span>
                      {e.mood && <span className="text-muted text-xs">{moodLabel(e.mood)}</span>}
                    </div>
                    <div className="text-muted truncate text-xs">
                      {e.isPrivate ? (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="size-3" /> Private
                        </span>
                      ) : (
                        e.text.slice(0, 80) || '—'
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
