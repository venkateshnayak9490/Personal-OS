import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck } from 'lucide-react';
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
      <ClipboardCheck className="text-sec-self size-5 shrink-0" />
      <span className="flex-1">
        {offset === 0 ? 'The week ends today.' : 'A new week.'} Take five minutes for your weekly review.
      </span>
      <span className="text-muted text-xs">Open</span>
    </Link>
  );
}
