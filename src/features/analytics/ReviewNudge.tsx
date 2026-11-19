import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, Target } from 'lucide-react';
import { Link } from 'react-router';
import { db } from '@/core/db';
import { periodOf } from '@/core/domain/analytics';
import { toLocalDate } from '@/core/domain/tasks';
import { reviewId } from '@/core/repos/reviews';

/**
 * On the last day of the week, and the first day of the next, until that week is reviewed.
 */
export function ReviewNudge({ now, weekStartsOn }: { now: number; weekStartsOn: 0 | 1 }) {
  const today = toLocalDate(now);
  const thisWeek = periodOf('week', new Date(now), 0, weekStartsOn);
  const offset = today === thisWeek.to ? 0 : today === thisWeek.from ? -1 : null;
  const week = offset === null ? null : periodOf('week', new Date(now), offset, weekStartsOn);
  const review = useLiveQuery(
    async () => (week ? ((await db.reviews.get(reviewId(week))) ?? null) : null),
    [week?.from],
  );
  if (!week || review === undefined) return null;
  if (review && !review.deletedAt && Object.keys(review.answers).length) return null;
  return (
    <Link
      to={`/reviews?period=week&offset=${offset}`}
      className="border-line hover:bg-surface-2/60 mb-8 flex items-center gap-3 rounded-2xl border p-4 text-[15px] md:text-sm"
    >
      <ClipboardCheck className="text-success size-5 shrink-0" />
      <span className="flex-1">
        {offset === 0 ? 'The week ends today.' : 'A new week.'} Take five minutes for your weekly review.
      </span>
      <span className="text-muted text-xs">Open</span>
    </Link>
  );
}

/** Last week's review answer to "Top three priorities for next week?", on Today all this week. */
export function WeekPriorities({ now, weekStartsOn }: { now: number; weekStartsOn: 0 | 1 }) {
  const last = periodOf('week', new Date(now), -1, weekStartsOn);
  const review = useLiveQuery(async () => (await db.reviews.get(reviewId(last))) ?? null, [last.from]);
  const text = review && !review.deletedAt ? review.answers.next?.trim() : '';
  if (!text) return null;
  return (
    <section aria-labelledby="week-priorities" className="border-line mb-8 rounded-2xl border p-4">
      <h2 id="week-priorities" className="title-block mb-1 flex items-center gap-2">
        <Target className="text-success size-4" /> This week’s priorities
      </h2>
      <p className="text-[15px] whitespace-pre-line md:text-sm">{text}</p>
      <Link
        to="/reviews?period=week&offset=-1"
        className="text-muted mt-1 inline-block text-xs hover:underline"
      >
        From last week’s review
      </Link>
    </section>
  );
}
