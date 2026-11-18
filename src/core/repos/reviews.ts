import { db } from '@/core/db';
import type { Period } from '@/core/domain/analytics';
import type { Review, ReviewSummary } from '@/core/domain/types';
import { insert, patch } from './write';

export const reviewId = (p: Pick<Period, 'kind' | 'from'>) => `${p.kind}:${p.from}`;

/** Save answers (and freeze the numbers as they are now). One review per period. */
export async function saveReview(p: Period, answers: Record<string, string>, summary: ReviewSummary) {
  const id = reviewId(p);
  const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim()));
  const existing = await db.reviews.get(id);
  if (!existing)
    return insert<Review>('reviews', {
      id,
      period: p.kind,
      periodStart: p.from,
      periodEnd: p.to,
      answers: clean,
      summary,
    });
  return patch<Review>('reviews', id, { answers: clean, summary, deletedAt: undefined });
}
