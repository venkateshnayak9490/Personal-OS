import { format } from 'date-fns';
import { Flame } from 'lucide-react';
import { Link } from 'react-router';
import { useNow } from '@/app/use-now';
import { useHabitLogs, useHabits, useProfile } from '@/core/hooks';
import { isScheduled, logsByDate, streak, weekProgress } from '@/core/domain/progress';
import { GymPlanLine } from '@/features/life/GymToday';
import { cn } from '@/lib/cn';
import { DayCell } from './habit-ui';

/** Today's habits on the dashboard: one click to check in. Hidden when you have no habits. */
export function HabitsToday() {
  const habits = useHabits();
  const profile = useProfile();
  const now = useNow();
  const today = format(new Date(now), 'yyyy-MM-dd');
  const since = format(new Date(now - 400 * 86_400_000), 'yyyy-MM-dd');
  const logs = useHabitLogs(since);
  if (!habits?.length || !logs) return null;
  const weekStartsOn = profile?.weekStartsOn ?? 1;

  const due = habits.filter((h) => {
    if (h.target.type === 'perWeek') return true;
    return isScheduled(h, today);
  });
  if (!due.length) return null;

  return (
    <section aria-labelledby="habits-heading" className="mb-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="habits-heading" className="text-sm font-semibold">
          Habits today
        </h2>
        <Link to="/habits" className="text-muted hover:text-fg text-xs">
          All habits
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {due.map((h) => {
          const byDate = logsByDate(logs, h.id);
          const s = streak(h, byDate, today, weekStartsOn);
          const wp = weekProgress(h, byDate, today, weekStartsOn);
          return (
            <li
              key={h.id}
              className={cn(
                'border-line flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5',
                h.source === 'gym' && 'sm:col-span-2 lg:col-span-3',
              )}
            >
              <DayCell
                habit={h}
                date={today}
                status={byDate.get(today)?.status}
                scheduled
                isToday
                dayLabel="today"
                large
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.title}</div>
                <div className="text-muted flex items-center gap-2 text-xs">
                  {`${wp.done}/${wp.target} this week`}
                  {s > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Flame className="text-sec-misc size-3" /> {s}
                    </span>
                  )}
                </div>
              </div>
              {h.source === 'gym' && (
                <div className="basis-full">
                  <GymPlanLine habit={h} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
