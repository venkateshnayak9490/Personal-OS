import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { db } from '@/core/db';
import { useAllTasks, useFocusSessions, useHabitLogs, useHabits } from '@/core/hooks';
import { closedTasks, habitConsistency, taskStats, type Period } from '@/core/domain/analytics';
import { focusMinutes } from '@/core/domain/focus';
import { logsByDate } from '@/core/domain/progress';
import { descendantIds } from '@/core/domain/tree';
import type { ReviewSummary } from '@/core/domain/types';
import type { NodeTree } from '@/features/structure/use-tree';

/** Everything the numbers are made from, from `since` on. `undefined` while loading. */
export function useAnalyticsData(since: string) {
  const tasks = useAllTasks();
  const habits = useHabits();
  const habitLogs = useHabitLogs(since);
  const sessions = useFocusSessions(parseISO(since).getTime());
  const skips = useLiveQuery(() => db.activityLog.where('action').equals('skipped').toArray(), []);
  const closed = useMemo(() => (tasks && skips ? closedTasks(tasks, skips) : undefined), [tasks, skips]);
  if (!tasks || !habits || !habitLogs || !sessions || !closed) return undefined;
  return { tasks, habits, habitLogs, sessions, closed };
}

export type AnalyticsData = NonNullable<ReturnType<typeof useAnalyticsData>>;

/** The automatic part of a review. */
export function summarize(
  d: AnalyticsData,
  p: Period,
  today: string,
  tree: NodeTree,
  weekStartsOn: 0 | 1,
): ReviewSummary {
  const s = taskStats(d.tasks, d.closed, p.from, p.to, today);
  const start = parseISO(p.from).getTime();
  const end = addDays(parseISO(p.to), 1).getTime();
  let habitsDone = 0;
  let habitsTarget = 0;
  for (const h of d.habits) {
    const c = habitConsistency(h, logsByDate(d.habitLogs, h.id), p.from, p.to, today, weekStartsOn);
    habitsDone += c.done;
    habitsTarget += c.target;
  }
  const done = d.closed.filter((c) => c.status === 'completed' && c.date >= p.from && c.date <= p.to);
  const sections = tree.visibleTree
    .map(({ node }) => {
      const ids = new Set([node.id, ...descendantIds(tree.nodes, node.id)]);
      return {
        title: node.title,
        completed: done.filter((c) => c.task.nodeId && ids.has(c.task.nodeId)).length,
      };
    })
    .filter((x) => x.completed > 0)
    .sort((a, b) => b.completed - a.completed);
  return {
    ...s,
    focusMin: focusMinutes(d.sessions, start, end),
    habitsDone,
    habitsTarget,
    wins: done.slice(0, 12).map((c) => c.task.title),
    sections,
  };
}
