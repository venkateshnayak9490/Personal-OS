import { format } from 'date-fns';
import { Bell, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import { useAllTasks, useEvents, useHabitLogs, useHabits, useProfile, useReminders } from '@/core/hooks';
import { occurrences } from '@/core/domain/events';
import { logsByDate, weekProgress } from '@/core/domain/progress';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { dueReminders, REMINDER_WINDOW_MS, reminderKey } from '@/core/domain/reminders';
import { dismissReminder, markReminderShown } from '@/core/repos/events';
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

  useEffect(() => {
    if (!events || !tasks || !shown || !habits || !habitLogs) return;
    const seen = new Set(shown.map(reminderKey));
    for (const r of dueReminders(events, tasks, now, profile?.timezone, habits, quiet)) {
      const key = reminderKey(r);
      if (seen.has(key) || firing.current.has(key)) continue;
      firing.current.add(key);
      void attempt(() => markReminderShown(r.target, r.fireAt));
      void notify(r.title, when(r.at, now)).catch(() => {});
    }
  }, [events, tasks, shown, now, profile?.timezone, habits, habitLogs, quiet]);

  if (!events || !tasks || !shown) return null;
  const titleOf = (table: string, id: string) =>
    (table === 'events'
      ? events.find((e) => e.id === id)
      : table === 'habits'
        ? habits?.find((h) => h.id === id && !quiet.has(h.id))
        : tasks.find((t) => t.id === id && !isClosed(t.status))
    )?.title;
  const open = shown
    .filter((r) => !r.dismissedAt && r.fireAt > now - REMINDER_WINDOW_MS)
    .map((r) => ({ r, title: titleOf(r.target.table, r.target.id) }))
    .filter((x) => x.title)
    .sort((a, b) => b.r.fireAt - a.r.fireAt)
    .slice(0, 3);
  if (!open.length) return null;

  return (
    <section
      aria-label="Reminders"
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 md:bottom-4"
    >
      {open.map(({ r, title }) => {
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
                    : when(at, now)}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 -ml-2"
                onClick={() => {
                  void attempt(() => dismissReminder(r.id));
                  if (r.target.table === 'habits')
                    void attempt(() => setHabitLog(r.target.id, today, 'done'));
                  else if (r.target.table === 'tasks') openTask(r.target.id);
                  else navigate('/calendar');
                }}
              >
                {r.target.table === 'habits' ? 'Mark done' : 'Open'}
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
    </section>
  );
}
