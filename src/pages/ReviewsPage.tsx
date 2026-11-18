import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Loading, Textarea } from '@/components/ui';
import { db } from '@/core/db';
import { useProfile } from '@/core/hooks';
import { pct, periodLabel, periodOf, REVIEW_QUESTIONS, type PeriodKind } from '@/core/domain/analytics';
import { hm } from '@/core/domain/focus';
import { toLocalDate } from '@/core/domain/tasks';
import type { ReviewSummary } from '@/core/domain/types';
import { reviewId, saveReview } from '@/core/repos/reviews';
import { summarize, useAnalyticsData } from '@/features/analytics/summary';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

export function ReviewsPage() {
  const now = useNow();
  const profile = useProfile();
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  // Links can open a specific review: /reviews?period=week&offset=-1 (last week).
  const [params] = useSearchParams();
  const [kind, setKind] = useState<PeriodKind>(
    KINDS.some((k) => k.value === params.get('period')) ? (params.get('period') as PeriodKind) : 'week',
  );
  const [offset, setOffset] = useState(Math.min(0, Number(params.get('offset')) || 0));
  const period = periodOf(kind, new Date(now), offset, weekStartsOn);
  const data = useAnalyticsData(period.from);
  const t = useNodeTree();
  const saved = useLiveQuery(
    async () => ({ id: reviewId(period), r: (await db.reviews.get(reviewId(period))) ?? null }),
    [period.kind, period.from],
  );
  const past = useLiveQuery(
    async () =>
      (await db.reviews.where('period').equals(kind).toArray())
        .filter((r) => !r.deletedAt && Object.keys(r.answers).length)
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
    [kind],
  );

  if (!data || !t || !saved || saved.id !== reviewId(period) || !past) return <Loading />;
  const today = toLocalDate(now);
  const live = summarize(data, period, today, t, weekStartsOn);
  const review = saved.r && !saved.r.deletedAt ? saved.r : null;
  const isPast = period.to < today;

  const offsetOf = (from: string) => {
    const a = parseISO(from);
    const b = parseISO(periodOf(kind, new Date(now), 0, weekStartsOn).from);
    return kind === 'day'
      ? differenceInCalendarDays(a, b)
      : kind === 'week'
        ? Math.round(differenceInCalendarDays(a, b) / 7)
        : kind === 'month'
          ? differenceInCalendarMonths(a, b)
          : differenceInCalendarYears(a, b);
  };

  return (
    <>
      <PageHeader
        title="Reviews"
        icon={ClipboardCheck}
        subtitle="Look back with real numbers, then decide what’s next."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Review period"
          className="bg-surface-2/70 inline-grid grid-cols-4 gap-1 rounded-lg p-1 max-md:w-full"
        >
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="tab"
              aria-selected={kind === k.value}
              onClick={() => {
                setKind(k.value);
                setOffset(0);
              }}
              className={cn(
                'h-9 rounded-md px-3 text-sm font-medium md:h-7 md:text-xs',
                kind === k.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Previous period"
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium max-md:flex-1">
            {periodLabel(period)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Next period"
            disabled={offset >= 0}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {offset !== 0 && (
          <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
            Back to now
          </Button>
        )}
      </div>

      <Summary s={review && isPast ? review.summary : live} frozen={!!review && isPast} />

      <form
        key={`${period.kind}:${period.from}`}
        className="mb-10 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const answers = Object.fromEntries(
            REVIEW_QUESTIONS[kind].map((q) => [q.key, String(form.get(q.key) ?? '')]),
          );
          void attempt(() => saveReview(period, answers, live));
        }}
      >
        {REVIEW_QUESTIONS[kind].map((q) => (
          <Field key={q.key} label={q.q} htmlFor={`rv-${q.key}`}>
            <Textarea
              id={`rv-${q.key}`}
              name={q.key}
              defaultValue={review?.answers[q.key] ?? ''}
              className="min-h-20"
            />
          </Field>
        ))}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary">
            Save review
          </Button>
          {review && (
            <span className="text-muted text-xs">Saved {new Date(review.updatedAt).toLocaleString()}</span>
          )}
        </div>
      </form>

      {past.length > 0 && (
        <section aria-labelledby="rv-past">
          <h2 id="rv-past" className="mb-2 text-sm font-semibold">
            Past {kind} reviews
          </h2>
          <ul className="divide-line divide-y">
            {past.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOffset(offsetOf(r.periodStart))}
                  className="hover:bg-surface-2/60 flex w-full items-baseline gap-4 px-1 py-2 text-left text-sm"
                >
                  <span className="w-44 shrink-0 font-medium">
                    {periodLabel({ kind: r.period, from: r.periodStart, to: r.periodEnd })}
                  </span>
                  <span className="text-muted min-w-0 flex-1 truncate">{Object.values(r.answers)[0]}</span>
                  <span className="text-muted shrink-0 text-xs tabular-nums">
                    {r.summary.completed} done · {pct(r.summary.rate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Summary({ s, frozen }: { s: ReviewSummary; frozen: boolean }) {
  return (
    <section aria-labelledby="rv-sum" className="border-line mb-8 rounded-2xl border p-4">
      <h2 id="rv-sum" className="mb-3 text-sm font-semibold">
        {frozen ? 'As it was when you wrote this' : 'So far'}
      </h2>
      <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted text-xs">Completed</dt>
          <dd className="text-lg font-semibold tabular-nums">{s.completed}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Completion rate</dt>
          <dd className="text-lg font-semibold tabular-nums">{pct(s.rate)}</dd>
          <dd className="text-muted text-xs">
            {s.skipped} skipped · {s.missed} missed
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Deep work</dt>
          <dd className="text-lg font-semibold tabular-nums">{hm(s.focusMin)}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Habits</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {s.habitsTarget ? pct(s.habitsDone / s.habitsTarget) : '—'}
          </dd>
        </div>
      </dl>
      {s.sections.length > 0 && (
        <p className="text-muted mb-2 text-xs">
          {s.sections.map((x) => `${x.title} ${x.completed}`).join(' · ')}
        </p>
      )}
      {s.wins.length > 0 && (
        <details>
          <summary className="text-muted hover:text-fg cursor-pointer text-xs">What you completed</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
            {s.wins.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
