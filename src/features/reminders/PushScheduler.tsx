import { format } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { useNow } from '@/app/use-now';
import {
  useAllTasks,
  useCheckins,
  useCollections,
  useDayPlans,
  useEvents,
  useHabitLogs,
  useHabits,
  useProfile,
  useRecords,
  useReminders,
} from '@/core/hooks';
import { planOf } from '@/core/domain/health';
import { logsByDate, weekProgress } from '@/core/domain/progress';
import { REMINDER_WINDOW_MS, repeatOf } from '@/core/domain/reminders';
import { toLocalDate } from '@/core/domain/tasks';
import { withAdjusted } from '@/core/domain/day-input';
import { notifyOff, upcomingReminders, type ReminderInputs, type Upcoming } from '@/core/domain/upcoming';
import { nodePath } from '@/app/nav';
import { supabase } from '@/core/sync/supabase';
import { useNodeTree } from '@/features/structure/use-tree';
import { useSync } from '@/features/sync/SyncRunner';

/** How far ahead device notifications are queued, and how often the queue is refreshed anyway. */
const HOURS = 48;
const EVERY_MS = 15 * 60_000;
/** After a change, wait this long for more changes before rewriting the queue. */
const SETTLE_MS = 5_000;

interface Row {
  id: string;
  fire_at: string;
  title: string;
  body: string;
  url: string;
}

/**
 * Keeps the server's push queue (docs/proposals/ADAPTIVE_DAY_AND_PUSH.md §2) equal to the reminders
 * of the next 48 hours, worked out by the same rules as the in-app reminder cards. Runs on every
 * signed-in device; two devices queueing the same reminder write the same row (its key).
 */
export function PushScheduler() {
  const session = useSync((s) => s.session);
  const now = useNow(EVERY_MS);
  const profile = useProfile();
  const tz = profile?.timezone;
  const today = toLocalDate(now, tz);
  const events = useEvents();
  const tasks = useAllTasks();
  const habits = useHabits();
  const habitLogs = useHabitLogs(toLocalDate(now - 7 * 86_400_000, tz));
  const checkins = useCheckins(today);
  const lists = useCollections();
  const records = useRecords();
  const shown = useReminders(now - REMINDER_WINDOW_MS);
  const tree = useNodeTree();
  const dayPlans = useDayPlans(today);

  const inputs = useMemo((): ReminderInputs | null => {
    if (
      !profile ||
      !events ||
      !tasks ||
      !habits ||
      !habitLogs ||
      !checkins ||
      !lists ||
      !records ||
      !dayPlans
    )
      return null;
    // Today's accepted adjustments: notifications follow the adjusted times.
    const adjusted = withAdjusted(
      dayPlans.find((d) => d.date === today),
      tasks,
      habits,
    );
    const quietToday = new Set<string>();
    const weekMet = new Set<string>();
    for (const h of habits) {
      const byDate = logsByDate(habitLogs, h.id);
      const wp = weekProgress(h, byDate, today, profile.weekStartsOn);
      const met = h.target.type === 'perWeek' && wp.done >= wp.target;
      if (met) weekMet.add(h.id);
      if (met || byDate.has(today)) quietToday.add(h.id);
    }
    const plan = planOf(profile.settings);
    return {
      events,
      tasks: adjusted.tasks,
      habits,
      todayHabits: adjusted.habits,
      quietToday,
      weekMet,
      weekStartsOn: profile.weekStartsOn,
      repeat: repeatOf(profile.settings, [plan?.bed ?? '22:30', plan?.wake ?? '07:00']),
      plan,
      checkins,
      lists,
      records,
      tz,
    };
  }, [profile, events, tasks, habits, habitLogs, checkins, lists, records, today, tz, dayPlans]);

  useEffect(() => {
    if (!session || !supabase || !inputs || !shown || !tree) return;
    const healthNode = tree.nodes.find((n) => n.moduleKey === 'health' && !n.deletedAt);
    const off = new Set(notifyOff(profile?.settings));
    const id = setTimeout(() => {
      const at = Date.now();
      // Snoozed things stay silent until the snooze ends; then one "back" notification.
      const snoozed = new Map(
        shown
          .filter((r) => (r.snoozedUntil ?? 0) > at && !r.dismissedAt)
          .map((r) => [`${r.target.table}:${r.target.id}`, r]),
      );
      const titleOf = (table: string, rid: string) =>
        (table === 'tasks'
          ? inputs.tasks
          : table === 'events'
            ? inputs.events
            : table === 'habits'
              ? inputs.habits
              : []
        ).find((x) => x.id === rid)?.title;
      const due = upcomingReminders(inputs, at, HOURS)
        .filter((r) => !off.has(r.category))
        .filter((r) => r.fireAt >= (snoozed.get(`${r.target.table}:${r.target.id}`)?.snoozedUntil ?? 0));
      const healthPath = healthNode ? nodePath(healthNode.id) : '/';
      const rows = toQueueRows(due, inputs, healthPath);
      for (const r of snoozed.values()) {
        const title = titleOf(r.target.table, r.target.id);
        if (title)
          rows.push({
            id: `${r.id}:snooze:${r.snoozedUntil}`,
            fire_at: new Date(r.snoozedUntil!).toISOString(),
            title,
            body: 'Your snoozed reminder is back',
            url: '/',
          });
      }
      void syncQueue(rows, at).catch(() => {}); // offline or server down: the next run catches up
    }, SETTLE_MS);
    return () => clearTimeout(id);
  }, [session, inputs, shown, tree, profile?.settings, now]);

  return null;
}

/**
 * Queue rows for these reminders. Several at the same minute (overdue tasks repeating hourly, say)
 * become one notification, like the in-app stack's "+N more", instead of a burst.
 */
export function toQueueRows(due: Upcoming[], inputs: ReminderInputs, healthPath: string): Row[] {
  const byMinute = new Map<number, Upcoming[]>();
  for (const r of due) byMinute.set(r.fireAt, [...(byMinute.get(r.fireAt) ?? []), r]);
  return [...byMinute.entries()].map(([fireAt, group]) =>
    group.length === 1
      ? {
          id: group[0]!.key,
          fire_at: new Date(fireAt).toISOString(),
          title: group[0]!.title,
          body: bodyOf(group[0]!, inputs),
          url: urlOf(group[0]!, inputs, healthPath),
        }
      : {
          id: `group:${fireAt}`,
          fire_at: new Date(fireAt).toISOString(),
          title: `${group.length} reminders`,
          body: group.map((r) => r.title).join(' · '),
          url: '/',
        },
  );
}

/** Make the server's pending queue equal `rows`: add or update those, delete pending ones not in it. */
async function syncQueue(rows: Row[], at: number) {
  const { data: pending, error } = await supabase!
    .from('push_queue')
    .select('id')
    .is('sent_at', null)
    .gt('fire_at', new Date(at).toISOString())
    .not('id', 'like', 'test:%');
  if (error) throw error;
  const want = new Set(rows.map((r) => r.id));
  const gone = (pending ?? []).map((p) => p.id as string).filter((pid) => !want.has(pid));
  for (let i = 0; i < gone.length; i += 100)
    await supabase!
      .from('push_queue')
      .delete()
      .in('id', gone.slice(i, i + 100));
  for (let i = 0; i < rows.length; i += 200)
    await supabase!
      .from('push_queue')
      .upsert(rows.slice(i, i + 200), { onConflict: 'user_id,id' })
      .throwOnError();
}

const hhmm = (ms: number) => format(ms, 'HH:mm');

function bodyOf(r: Upcoming, i: ReminderInputs): string {
  switch (r.target.table) {
    case 'events':
      return `Starts at ${hhmm(r.at)}`;
    case 'tasks': {
      const t = i.tasks.find((x) => x.id === r.target.id);
      return t?.dueTime ? `Due at ${hhmm(r.at)}` : 'Due today';
    }
    case 'habits':
      return r.category === 'gym' ? 'Time for your workout' : 'Time to check in';
    case 'health':
      return 'Health plan';
    default:
      return '';
  }
}

function urlOf(r: Upcoming, i: ReminderInputs, healthPath: string): string {
  switch (r.target.table) {
    case 'tasks':
      return `/?do=open&task=${encodeURIComponent(r.target.id)}`;
    case 'events':
      return '/calendar';
    case 'habits':
      return '/habits';
    case 'health':
      return healthPath;
    case 'records': {
      const rec = i.records.find((x) => r.target.id.startsWith(`${x.id}:`));
      return rec ? `/lists/${rec.collectionId}` : '/';
    }
    default:
      return '/';
  }
}
