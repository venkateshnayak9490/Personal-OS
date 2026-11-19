import { format } from 'date-fns';
import { History, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { Button } from '@/components/ui';
import { db } from '@/core/db';
import { AWAY_AFTER_MS, missedWhileAway } from '@/core/domain/away';
import { toLocalDate } from '@/core/domain/tasks';
import { useAllTasks, useEvents, useHabitLogs, useHabits, useMeta, useProfile } from '@/core/hooks';

const SEEN = 'lastSeen';
const AWAY = 'away';

/** On opening: if the app was away long enough, remember the gap (shown on Today until dismissed). */
export async function markOpened(now = Date.now()) {
  const last = (await db.meta.get(SEEN))?.value as number | undefined;
  if (last && now - last > AWAY_AFTER_MS) await db.meta.put({ key: AWAY, value: { from: last, to: now } });
  await db.meta.put({ key: SEEN, value: now });
}

/** While open (and when hidden), keep "last seen" fresh. Local to this device; not synced. */
export const markSeen = (now = Date.now()) => db.meta.put({ key: SEEN, value: now });

/**
 * "While you were away": events that started, tasks that fell due and habit reminders you didn't see
 * because the app was closed. Collapsed to one line at first; dismiss when you've seen it.
 */
export function AwayCard() {
  const gap = useMeta<{ from: number; to: number }>(AWAY);
  const profile = useProfile();
  const events = useEvents();
  const tasks = useAllTasks();
  const habits = useHabits();
  const logs = useHabitLogs(gap ? toLocalDate(gap.to, profile?.timezone) : '9999-12-31');
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!gap || !events || !tasks || !habits || !logs) return null;
  const missed = missedWhileAway(gap, { events, tasks, habits, logs }, profile?.timezone);
  if (!missed.length) return null;
  const dismiss = () => void attempt(() => db.meta.delete(AWAY));

  return (
    <section aria-label="While you were away" className="border-line mb-8 rounded-2xl border px-4 py-3">
      <div className="flex items-center gap-2">
        <History className="text-muted size-4 shrink-0" />
        <p className="flex-1 text-[15px] md:text-sm">
          <span className="font-medium">While you were away</span>
          <span className="text-muted">
            {' '}
            · {missed.length} reminder{missed.length === 1 ? '' : 's'} since {format(gap.from, 'EEE HH:mm')}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss while you were away" onClick={dismiss}>
          <X className="size-4" />
        </Button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1">
          {missed.map((m) => (
            <li key={`${m.kind}:${m.id}:${m.at}`}>
              <button
                type="button"
                className="hover:bg-surface-2 flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left text-sm"
                onClick={() =>
                  m.kind === 'task' ? openTask(m.id) : navigate(m.kind === 'event' ? '/calendar' : '/habits')
                }
              >
                <span className="text-muted w-24 shrink-0 text-xs tabular-nums">
                  {format(m.at, 'EEE HH:mm')}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="text-muted text-xs">
                  {m.kind === 'event' ? 'Event' : m.kind === 'task' ? 'Task due' : 'Habit'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
