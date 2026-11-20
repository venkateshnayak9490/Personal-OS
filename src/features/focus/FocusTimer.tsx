import { Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { useMeta } from '@/core/hooks';
import { endsAt, FOCUS_KEY, hm } from '@/core/domain/focus';
import type { RunningFocus } from '@/core/domain/types';
import { stopFocus } from '@/core/repos/focus';
import { notify } from '@/features/reminders/Reminders';

export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The running timer, while it runs; ticks every second. */
export function useRunningFocus() {
  const running = useMeta<RunningFocus>(FOCUS_KEY);
  const now = useNow(running ? 1000 : 60_000);
  return { running, now, left: running ? endsAt(running) - now : 0 };
}

/**
 * Mounted once in the app frame: finishes the session when time is up (also after the app was
 * closed through it), and shows a small timer everywhere except the Focus page.
 */
export function FocusTimer() {
  const { running, left } = useRunningFocus();
  const { pathname } = useLocation();
  const finishing = useRef(false);

  useEffect(() => {
    if (!running || left > 0 || finishing.current) return;
    finishing.current = true;
    void attempt(async () => {
      const s = await stopFocus();
      if (s) {
        toast(`Focus session done: ${hm(s.minutes)}. Take a short break.`);
        void notify('Focus session done', `${hm(s.minutes)} of deep work`).catch(() => {});
      }
    }).finally(() => (finishing.current = false));
  }, [running, left]);

  // Phones: a floating pill. Desktop: the countdown sits next to Focus in the sidebar.
  if (!running || pathname === '/focus') return null;
  return (
    <Link
      to="/focus"
      aria-label={`Focus timer, ${clock(left)} left`}
      className="border-line bg-surface-3 fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-40 flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium tabular-nums shadow-xl shadow-black/25 md:hidden"
    >
      <Timer className="text-success size-4" /> {clock(left)}
    </Link>
  );
}

/** Countdown next to "Focus" in the sidebar while a session runs. */
export function FocusBadge() {
  const { running, left } = useRunningFocus();
  return running ? <span className="text-success">{clock(left)}</span> : null;
}
