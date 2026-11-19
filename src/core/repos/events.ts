import type { CalendarEvent, Reminder } from '@/core/domain/types';
import { db } from '@/core/db';
import { insert, patch, softDeleteBatch } from './write';

/** Calendar events and the record of reminders already shown. */

export type EventFields = Pick<CalendarEvent, 'title' | 'start' | 'end' | 'allDay' | 'reminderOffsetsMin'> &
  Partial<Pick<CalendarEvent, 'description' | 'rrule' | 'nodeId' | 'location' | 'kind'>>;

function check(f: Partial<EventFields>): Partial<EventFields> {
  const out = { ...f };
  if (out.title !== undefined) {
    out.title = out.title.trim();
    if (!out.title) throw new Error('An event needs a name');
  }
  if (out.start !== undefined && out.end !== undefined && out.end < out.start)
    throw new Error('An event can’t end before it starts');
  return out;
}

export async function createEvent(fields: EventFields): Promise<CalendarEvent> {
  return insert<CalendarEvent>('events', check(fields) as EventFields);
}

export async function updateEvent(id: string, changes: Partial<EventFields>) {
  return patch<CalendarEvent>('events', id, check(changes));
}

export async function deleteEvent(id: string) {
  return softDeleteBatch([{ tableName: 'events', id }]);
}

/** Record that a reminder was shown, so it shows once (also across reloads). */
export async function markReminderShown(target: Reminder['target'], fireAt: number) {
  return insert<Reminder>('reminders', { target, fireAt, channel: 'in_app', sentAt: Date.now() });
}

/**
 * Several open tabs each run the reminder check: Web Locks (where supported) make them take turns,
 * and the database is checked inside, so each reminder round is recorded and notified once.
 */
let local: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks) return locks.request('pos-reminders', fn) as Promise<T>;
  // No Web Locks (old browsers, tests): at least this tab takes turns.
  const run = local.then(fn);
  local = run.catch(() => {});
  return run;
}

/** Record a reminder round unless any tab already did. True = this call recorded it (so notify). */
export function fireReminderOnce(target: Reminder['target'], fireAt: number): Promise<boolean> {
  return exclusive(async () => {
    const same = await db.reminders.where('fireAt').equals(fireAt).toArray();
    if (same.some((r) => !r.deletedAt && r.target.table === target.table && r.target.id === target.id))
      return false;
    await markReminderShown(target, fireAt);
    return true;
  });
}

/** Hide a reminder for a while; nothing new about the same thing shows until then. */
export function snoozeReminder(id: string, minutes: number) {
  return patch<Reminder>('reminders', id, { snoozedUntil: Date.now() + minutes * 60_000 });
}

/** A snoozed reminder is due again: true for exactly one tab (which notifies). */
export function resurfaceOnce(id: string): Promise<boolean> {
  return exclusive(async () => {
    const r = await db.reminders.get(id);
    if (!r?.snoozedUntil || (r.resurfacedAt ?? 0) >= r.snoozedUntil || r.dismissedAt) return false;
    await patch<Reminder>('reminders', id, { resurfacedAt: Date.now() });
    return true;
  });
}

export async function dismissReminder(id: string) {
  return patch<Reminder>('reminders', id, { dismissedAt: Date.now() });
}
