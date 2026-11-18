import { addDays, format, parseISO } from 'date-fns';
import { Bell, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import {
  useAllTasks,
  useCheckins,
  useCollections,
  useRecords,
  useEvents,
  useHabitLogs,
  useHabits,
  useProfile,
  useReminders,
} from '@/core/hooks';
import { healthReminders, planOf, type Meal } from '@/core/domain/health';
import { occurrences } from '@/core/domain/events';
import { logsByDate, weekProgress } from '@/core/domain/progress';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { datedItems } from '@/core/domain/collections';
import { dueReminders, occasionReminders, REMINDER_WINDOW_MS, reminderKey } from '@/core/domain/reminders';
import { listPath } from '@/features/collections/ListsSection';
import { dismissReminder, markReminderShown } from '@/core/repos/events';
import { addWater, logMeal, setCheckin } from '@/core/repos/life';
import { setHabitLog } from '@/core/repos/plans';

/** System notification while the app is open but in the background (only if the user allowed it). */
export async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, { body, tag: title, icon: '/pwa-192x192.png' });
  else new Notification(title, { body });
}

const when = (at: number, now: number) =>
  at > now
    ? `Starts in ${Math.max(1, Math.round((at - now) / 60_000))} min · ${format(at, 'h:mm a')}`
    : at > now - 60_000
      ? `Now · ${format(at, 'h:mm a')}`
      : `Was at ${format(at, 'h:mm a')}`;

/**
 * In-app reminders (build.md C1): they fire only while the app is open.
 * Each one is recorded in `reminders`, so it shows once, even across reloads or devices after sync.
 */
export function Reminders() {
  const now = useNow(15_000);
  const since = Math.floor((now - REMINDER_WINDOW_MS) / 3_600_000) * 3_600_000; // stable for an hour
  const events = useEvents();
  const tasks = useAllTasks();
  const profile = useProfile();
  const shown = useReminders(since);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const firing = useRef(new Set<string>());
  const habits = useHabits();
  const today = toLocalDate(now, profile?.timezone);
  const habitLogs = useHabitLogs(toLocalDate(now - 7 * 86_400_000, profile?.timezone));
  // Habits that shouldn't nag: already checked in today, or this week's target is met.
  const quiet = useMemo(() => {
    const q = new Set<string>();
    for (const h of habits ?? []) {
      const byDate = logsByDate(habitLogs ?? [], h.id);
      const wp = weekProgress(h, byDate, today, profile?.weekStartsOn ?? 1);
      if (byDate.has(today) || (h.target.type === 'perWeek' && wp.done >= wp.target)) q.add(h.id);
    }
    return q;
  }, [habits, habitLogs, today, profile?.weekStartsOn]);
  // Remind again every few hours until done (Settings), quiet overnight (your health plan's bed/wake times).
  const everyH = (profile?.settings.remindEveryH as number | undefined) ?? 2;
  const plan = planOf(profile?.settings);
  const repeat =
    everyH > 0
      ? { everyH, quiet: [plan?.bed ?? '22:30', plan?.wake ?? '07:00'] as [string, string] }
      : undefined;
  // Birthdays, anniversaries and occasions today.
  const lists = useCollections();
  const records = useRecords();
  const occasions = useMemo(() => {
    if (!lists || !records) return [];
    const start = parseISO(today).getTime();
    const items = datedItems(lists, records, start, start + 86_400_000, profile?.timezone);
    return occasionReminders(items, today, now, profile?.timezone).map((r) => ({
      ...r,
      collectionId: items.find((d) => `${d.record.id}:${d.field.key}` === r.target.id)!.collection.id,
    }));
  }, [lists, records, today, now, profile?.timezone]);
  // Health plan nudges (meals, water, bedtime), only once you've set up a plan on Health.
  const checkins = useCheckins(today);
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
  const health = useMemo(
    () =>
      plan && checkins
        ? healthReminders(
            plan,
            today,
            checkins.find((c) => c.date === today),
            checkins.find((c) => c.date === tomorrow),
            now,
            REMINDER_WINDOW_MS,
            profile?.timezone,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plan is rebuilt from settings each render
    [profile?.settings, checkins, today, tomorrow, now, profile?.timezone],
  );

  useEffect(() => {
    if (!events || !tasks || !shown || !habits || !habitLogs) return;
    const seen = new Set(shown.map(reminderKey));
    for (const r of [
      ...dueReminders(events, tasks, now, profile?.timezone, habits, quiet, repeat),
      ...health,
      ...occasions,
    ]) {
      const key = reminderKey(r);
      if (seen.has(key) || firing.current.has(key)) continue;
      firing.current.add(key);
      void attempt(() => markReminderShown(r.target, r.fireAt));
      void notify(r.title, when(r.at, now)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repeat is rebuilt from settings (everyH, plan) each render
  }, [events, tasks, shown, now, profile?.timezone, habits, habitLogs, quiet, health, occasions, everyH]);

  if (!events || !tasks || !shown) return null;
  const titleOf = (table: string, id: string) =>
    (table === 'events'
      ? events.find((e) => e.id === id)
      : table === 'habits'
        ? habits?.find((h) => h.id === id && !quiet.has(h.id))
        : table === 'health'
          ? health.find((h) => h.target.id === id) // gone once you've logged it
          : table === 'records'
            ? occasions.find((o) => o.target.id === id)
            : tasks.find((t) => t.id === id && !isClosed(t.status))
    )?.title;
  const open = shown
    .filter((r) => !r.dismissedAt && r.fireAt > now - REMINDER_WINDOW_MS)
    .map((r) => ({ r, title: titleOf(r.target.table, r.target.id) }))
    .filter((x) => x.title)
    .sort((a, b) => b.r.fireAt - a.r.fireAt)
    // A repeated reminder shows once: its latest round.
    .filter(
      (x, i, all) =>
        all.findIndex((y) => y.r.target.table === x.r.target.table && y.r.target.id === x.r.target.id) === i,
    )
    .slice(0, 5);
  if (!open.length) return null;
  // One card at a time so they don't cover the page; the rest behind "+N more".
  const shownNow = expanded ? open : open.slice(0, 1);

  return (
    <section
      aria-label="Reminders"
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 md:bottom-4"
    >
      {shownNow.map(({ r, title }) => {
        const ev = r.target.table === 'events' ? events.find((e) => e.id === r.target.id) : undefined;
        const lead = ev ? Math.max(0, ...ev.reminderOffsetsMin) * 60_000 : 0;
        const at = ev
          ? (occurrences(ev, r.fireAt, r.fireAt + lead + 1).find((o) => o.start >= r.fireAt)?.start ??
            r.fireAt)
          : r.fireAt;
        return (
          <div
            key={r.id}
            role="alert"
            className="anim-rise border-line bg-surface flex items-start gap-3 rounded-2xl border p-3 shadow-xl shadow-black/25"
          >
            <Bell className="text-sec-misc mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="text-muted text-xs">
                {r.target.table === 'tasks'
                  ? `Due · ${format(r.fireAt, 'h:mm a')}`
                  : r.target.table === 'habits'
                    ? `Habit · ${format(r.fireAt, 'h:mm a')}`
                    : r.target.table === 'health'
                      ? `Health · ${format(r.fireAt, 'h:mm a')}`
                      : when(at, now)}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 -ml-2"
                onClick={() => {
                  void attempt(() => dismissReminder(r.id));
                  const id = r.target.id;
                  const hhmm = format(Date.now(), 'HH:mm');
                  if (r.target.table === 'habits') void attempt(() => setHabitLog(id, today, 'done'));
                  else if (r.target.table === 'health')
                    void attempt(async () => {
                      if (id === 'water') await addWater(today);
                      else if (id === 'bed') await setCheckin(tomorrow, { bedTime: hhmm });
                      else await logMeal(today, id as Meal, hhmm);
                    });
                  else if (r.target.table === 'tasks') openTask(r.target.id);
                  else if (r.target.table === 'records') {
                    const o = occasions.find((x) => x.target.id === id);
                    if (o) navigate(`${listPath(o.collectionId)}?item=${id.split(':')[0]}`);
                  } else navigate('/calendar');
                }}
              >
                {r.target.table === 'habits'
                  ? 'Mark done'
                  : r.target.table === 'health'
                    ? r.target.id === 'water'
                      ? 'Had a glass'
                      : r.target.id === 'bed'
                        ? 'Going to bed'
                        : 'Ate now'
                    : 'Open'}
              </Button>
            </div>
            <button
              type="button"
              aria-label={`Dismiss reminder for ${title}`}
              onClick={() => void attempt(() => dismissReminder(r.id))}
              className="text-muted hover:text-fg rounded-lg p-1"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
      {open.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="border-line bg-surface text-muted hover:text-fg self-end rounded-full border px-3 py-1.5 text-xs shadow-lg"
        >
          {expanded ? 'Show fewer' : `+${open.length - 1} more reminder${open.length > 2 ? 's' : ''}`}
        </button>
      )}
    </section>
  );
}
