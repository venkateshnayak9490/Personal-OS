import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import { actionItems, carryOver } from '@/core/domain/meetings';
import { resetDb } from '@/test/db-reset';
import { createMeeting, deleteMeeting, meetingForOccurrence, setFollowUp } from './meetings';
import { createTask, setTaskStatus } from './tasks';

beforeEach(resetDb);

const DAY = 86_400_000;
const item = (meetingId: string, title: string) => createTask({ title, custom: { meetingId } });

describe('meetings', () => {
  it('one meeting per occurrence of a calendar event', async () => {
    const ev = { id: 'ev1', title: 'Meeting with Prof. Rajan', nodeId: 'meet' };
    const a = await meetingForOccurrence(ev, 1000);
    const again = await meetingForOccurrence(ev, 1000);
    const next = await meetingForOccurrence(ev, 1000 + 7 * DAY);
    expect(again.id).toBe(a.id);
    expect(next.id).not.toBe(a.id);
    expect(a).toMatchObject({ title: 'Meeting with Prof. Rajan', nodeId: 'meet', eventId: 'ev1' });
  });

  it('carries open items and last time’s follow-ups to the next meeting', async () => {
    const m1 = await createMeeting({ title: 'Week 1', start: 0, nodeId: 'meet' });
    const m2 = await createMeeting({ title: 'Week 2', start: 7 * DAY, nodeId: 'meet' });
    const m3 = await createMeeting({ title: 'Week 3', start: 14 * DAY, nodeId: 'meet' });
    const other = await createMeeting({ title: 'Lab sync', start: 7 * DAY, nodeId: 'lab' });

    const open1 = await item(m1.id, 'Run baseline');
    const done1 = await item(m1.id, 'Read RT-2');
    await setFollowUp(done1.id, true);
    await setTaskStatus(done1.id, 'completed');
    const done2 = await item(m2.id, 'Fix seed');
    await setFollowUp(done2.id, true);
    await setTaskStatus(done2.id, 'completed');
    await item(other.id, 'Order GPU');

    const tasks = await db.tasks.toArray();
    const meetings = await db.meetings.toArray();
    const titles = (m: typeof m1) =>
      carryOver(m, meetings, tasks)
        .map((t) => t.title)
        .sort();
    expect(titles(m1)).toEqual([]);
    expect(titles(m2)).toEqual(['Read RT-2', 'Run baseline']); // done but flagged at the previous meeting
    expect(titles(m3)).toEqual(['Fix seed', 'Run baseline']); // Week 1's done item no longer
    expect(
      actionItems(m1.id, tasks)
        .map((t) => t.id)
        .sort(),
    ).toEqual([open1.id, done1.id].sort());
  });

  it('deleting a meeting keeps its action items', async () => {
    const m = await createMeeting({ title: 'Week 1', start: 0 });
    const t = await item(m.id, 'Run baseline');
    await deleteMeeting(m.id);
    expect((await db.tasks.get(t.id))?.deletedAt).toBeUndefined();
    await expect(createMeeting({ title: ' ', start: 0 })).rejects.toThrow(/needs a name/);
  });
});
