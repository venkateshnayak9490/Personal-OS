import { isClosed } from './tasks';
import type { Meeting, Task } from './types';

/** Action items are tasks that point at their meeting. */
export const meetingIdOf = (t: Task) => t.custom.meetingId as string | undefined;
export const isFollowUp = (t: Task) => t.custom.followUp === true;

export const actionItems = (meetingId: string, tasks: Task[]) =>
  tasks.filter((t) => !t.parentTaskId && meetingIdOf(t) === meetingId);

/** Meetings of the same series: same calendar event, else same section. */
export function sameSeries(a: Meeting, b: Meeting): boolean {
  if (a.eventId || b.eventId) return a.eventId === b.eventId;
  return a.nodeId === b.nodeId;
}

/**
 * What to bring up at this meeting from earlier ones in its series:
 * every action item still open, plus items marked "follow up" at the meeting just before
 * (even if done, so you can report back).
 */
export function carryOver(meeting: Meeting, meetings: Meeting[], tasks: Task[]): Task[] {
  const earlier = meetings
    .filter((m) => m.id !== meeting.id && !m.deletedAt && m.start < meeting.start && sameSeries(m, meeting))
    .sort((a, b) => b.start - a.start);
  if (!earlier.length) return [];
  const ids = new Set(earlier.map((m) => m.id));
  const previous = earlier[0]!.id;
  return tasks.filter((t) => {
    const mid = meetingIdOf(t);
    if (!mid || !ids.has(mid) || t.parentTaskId || t.status === 'cancelled') return false;
    return !isClosed(t.status) || (mid === previous && isFollowUp(t));
  });
}
