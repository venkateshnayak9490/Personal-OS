import { db } from '@/core/db';
import type { DayPlan, LocalDate } from '@/core/domain/types';
import { insert, patch } from './write';

export const dayPlanId = (date: LocalDate) => `d:${date}`;

export type DayPlanFields = Partial<Pick<DayPlan, 'wake' | 'bed' | 'basedOn' | 'items' | 'deferred'>>;

/** Save a day's adjustment and add a line to its history. Returns what was there before, for Undo. */
export async function saveDayPlan(date: LocalDate, fields: DayPlanFields, note: string, at = Date.now()) {
  const id = dayPlanId(date);
  const before = await db.dayPlans.get(id);
  const history = [...(before?.history ?? []), { at, text: note }];
  if (!before)
    await insert<DayPlan>('dayPlans', { id, date, wake: 0, bed: 0, items: [], ...fields, history });
  else await patch<DayPlan>('dayPlans', id, { ...fields, history });
  return before;
}

/** Back to the planned times: the moves are cleared (the history keeps them). */
export const restorePlanned = (date: LocalDate) =>
  saveDayPlan(date, { items: [], deferred: [] }, 'Planned times restored');
