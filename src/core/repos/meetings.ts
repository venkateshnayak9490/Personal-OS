import { db } from '@/core/db';
import type { Meeting, Task } from '@/core/domain/types';
import { insert, patch, softDeleteBatch } from './write';

/** Meetings and their notes. Action items are tasks (see domain/meetings). */

export type MeetingFields = Partial<Pick<Meeting, 'title' | 'nodeId' | 'start' | 'attendees' | 'agenda'>>;

function check(f: MeetingFields): MeetingFields {
  if (f.title === undefined) return f;
  const title = f.title.trim();
  if (!title) throw new Error('A meeting needs a name');
  return { ...f, title };
}

export async function createMeeting(
  input: Pick<Meeting, 'title' | 'start'> & Partial<Pick<Meeting, 'nodeId' | 'eventId' | 'attendees'>>,
): Promise<Meeting> {
  return insert<Meeting>('meetings', { attendees: [], ...input, title: check(input).title! });
}

/** The meeting for one occurrence of a calendar event; created on first open. */
export async function meetingForOccurrence(
  ev: {
    id: string;
    title: string;
    nodeId?: string;
  },
  start: number,
): Promise<Meeting> {
  const existing = (await db.meetings.where('eventId').equals(ev.id).toArray()).find(
    (m) => !m.deletedAt && m.start === start,
  );
  return existing ?? createMeeting({ title: ev.title, start, nodeId: ev.nodeId, eventId: ev.id });
}

export async function updateMeeting(id: string, changes: MeetingFields) {
  return patch<Meeting>('meetings', id, check(changes));
}

/** Typing saves often; keep at most one history line per meeting every 10 minutes. */
export async function saveMeetingNotes(id: string, doc: unknown, text: string) {
  const m = await db.meetings.get(id);
  if (!m || m.deletedAt) return;
  return patch<Meeting>('meetings', id, { doc, text }, 'updated', {
    quiet: true,
    minLogIntervalMs: 10 * 60 * 1000,
  });
}

/** Deleting a meeting keeps its action items: they're commitments, not notes. */
export async function deleteMeeting(id: string) {
  return softDeleteBatch([{ tableName: 'meetings', id }]);
}

/** Mark an action item to bring up at the next meeting. */
export async function setFollowUp(taskId: string, on: boolean) {
  const t = await db.tasks.get(taskId);
  if (!t) throw new Error('This task no longer exists');
  const custom = { ...t.custom };
  if (on) custom.followUp = true;
  else delete custom.followUp;
  return patch<Task>('tasks', taskId, { custom });
}
