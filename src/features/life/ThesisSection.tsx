import { format, parseISO, startOfWeek } from 'date-fns';
import { Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { BlockHeader, Button, Input, ProgressBar, Select, StatusMark } from '@/components/ui';
import { useChapters, useProfile, useWritingLogs } from '@/core/hooks';
import { toLocalDate } from '@/core/domain/tasks';
import type { ChapterStatus } from '@/core/domain/types';
import { createChapter, deleteChapter, logWriting, updateChapter } from '@/core/repos/life';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';

const STATUS: { value: ChapterStatus; label: string }[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'revising', label: 'Revising' },
  { value: 'done', label: 'Done' },
];
const n = (x: number) => x.toLocaleString();
const labelCls = 'text-muted text-[13px] font-medium md:text-xs';
// Edit-in-place text: reads as plain text, shows a rule on hover and the focus colour while editing.
const inlineCls =
  'border-b border-transparent bg-transparent outline-none hover:border-line-strong focus:border-focus';
const pctOf = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

/** Chapters with word goals, and a log of writing sessions. Shown on the Thesis section. */
export function ThesisSection() {
  const chapters = useChapters();
  const logs = useWritingLogs();
  const profile = useProfile();
  const now = useNow();
  const [newTitle, setNewTitle] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [words, setWords] = useState('');
  const [minutes, setMinutes] = useState('');
  if (!chapters || !logs) return null;

  const total = chapters.reduce((a, c) => a + c.currentWords, 0);
  const target = chapters.reduce((a, c) => a + c.targetWords, 0);
  const weekStart = format(startOfWeek(now, { weekStartsOn: profile?.weekStartsOn ?? 1 }), 'yyyy-MM-dd');
  const thisWeek = logs.filter((l) => l.date >= weekStart).reduce((a, l) => a + l.delta, 0);
  const title = (id: string) => chapters.find((c) => c.id === id)?.title ?? 'Deleted chapter';
  const picked = chapterId || chapters[0]?.id || '';

  const log = () =>
    void attempt(async () => {
      const l = await logWriting(picked, Number(words), toLocalDate(now), Number(minutes) || undefined);
      toast(`${l.delta >= 0 ? '+' : ''}${n(l.delta)} words in ${title(picked)}`);
      setWords('');
      setMinutes('');
    });

  return (
    <section aria-labelledby="thesis-heading" className="mb-10">
      <BlockHeader id="thesis-heading" title="Thesis" />
      {chapters.length > 0 && (
        <div className="mb-4">
          <p className="text-muted mb-2 text-[15px] md:text-sm">
            <b className="text-fg tabular-nums">{n(total)}</b> of {n(target)} words ({pctOf(total, target)}%)
            {' · '}This week {thisWeek >= 0 ? '+' : ''}
            {n(thisWeek)}
          </p>
          <ProgressBar pct={pctOf(total, target)} label="Thesis progress" />
        </div>
      )}

      {chapters.length > 0 && (
        <form
          aria-label="Log writing"
          className="border-line bg-surface mb-6 flex flex-wrap items-end gap-3 rounded-2xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (words !== '') log();
          }}
        >
          <label className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-48 sm:flex-1">
            <span className={labelCls}>Chapter</span>
            <Select value={picked} onChange={(e) => setChapterId(e.target.value)} aria-label="Chapter to log">
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-36 sm:flex-none">
            <span className={labelCls}>Word count now</span>
            <Input type="number" min={0} value={words} onChange={(e) => setWords(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-32 sm:flex-none">
            <span className={labelCls}>Minutes (optional)</span>
            <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <Button type="submit" variant="primary" disabled={words === ''} className="max-sm:w-full">
            Log writing
          </Button>
        </form>
      )}

      <ul aria-label="Chapters" className="divide-line mb-3 divide-y">
        {chapters.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            {/* Done is an ink tick; the status itself is in words in the select. */}
            <span className="flex w-4 shrink-0 justify-center">
              {c.status === 'done' && <StatusMark mark="done" />}
            </span>
            <input
              aria-label={`Chapter name ${c.title}`}
              key={c.title}
              defaultValue={c.title}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value.trim() !== c.title &&
                void attempt(() => updateChapter(c.id, { title: e.target.value.trim() }))
              }
              className={cn(inlineCls, 'h-9 min-w-40 flex-1 text-[15px] font-medium md:h-8 md:text-sm')}
            />
            <Select
              aria-label={`Status of ${c.title}`}
              value={c.status}
              onChange={(e) =>
                void attempt(() => updateChapter(c.id, { status: e.target.value as ChapterStatus }))
              }
              className="h-9 w-auto text-[13px] md:h-8 md:text-xs"
            >
              {STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <span className="text-meta text-muted tabular-nums">
              {n(c.currentWords)} /{' '}
              <input
                aria-label={`Word goal for ${c.title}`}
                type="number"
                min={0}
                key={c.targetWords}
                defaultValue={c.targetWords}
                onBlur={(e) =>
                  Number(e.target.value) !== c.targetWords &&
                  void attempt(() => updateChapter(c.id, { targetWords: Number(e.target.value) }))
                }
                className={cn(inlineCls, 'w-16 text-right tabular-nums')}
              />{' '}
              words
            </span>
            <ProgressBar
              pct={pctOf(c.currentWords, c.targetWords)}
              label={`${c.title} progress`}
              className="w-24"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${c.title}`}
              className="ml-auto"
              onClick={() =>
                void attempt(async () => {
                  const b = await deleteChapter(c.id);
                  if (b) toast(`Moved “${c.title}” to Trash`, () => restoreFromTrash(b));
                })
              }
            >
              <Trash className="size-4" />
            </Button>
          </li>
        ))}
        <li className="py-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Clear straight away, so the next chapter typed while this one saves isn't wiped.
              const title = newTitle;
              if (!title.trim()) return;
              setNewTitle('');
              void attempt(async () => {
                try {
                  await createChapter(title);
                } catch (err) {
                  setNewTitle(title);
                  throw err;
                }
              });
            }}
          >
            <Input
              aria-label="New chapter"
              placeholder={chapters.length ? 'Add a chapter' : 'Add your first chapter, e.g. Introduction'}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Button type="submit" disabled={!newTitle.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
        </li>
      </ul>

      {logs.length > 0 && (
        <details>
          <summary className="text-meta text-muted hover:text-fg flex min-h-11 cursor-pointer items-center md:min-h-8">
            Writing log
          </summary>
          <ul className="divide-line divide-y">
            {logs.slice(0, 20).map((l) => (
              <li key={l.id} className="flex items-baseline gap-3 py-2 text-[15px] md:text-sm">
                <span className="text-meta text-muted w-24 shrink-0 tabular-nums">
                  {format(parseISO(l.date), 'EEE d MMM')}
                </span>
                <span className="min-w-0 flex-1 truncate">{title(l.chapterId)}</span>
                <span className="tabular-nums">
                  {l.delta >= 0 ? '+' : ''}
                  {n(l.delta)}
                </span>
                {l.minutes && <span className="text-meta text-muted tabular-nums">{l.minutes} min</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
