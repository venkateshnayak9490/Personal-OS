import type { CalendarEvent, Reminder } from '@/core/domain/types';
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

export async function dismissReminder(id: string) {
  return patch<Reminder>('reminders', id, { dismissedAt: Date.now() });
}
