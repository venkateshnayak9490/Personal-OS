import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { Button } from '@/components/ui';
import { useHabitLogs } from '@/core/hooks';
import { adherence, logsByDate } from '@/core/domain/progress';
import type { Habit, HabitLog, LocalDate } from '@/core/domain/types';
import { setHabitLog } from '@/core/repos/plans';
import { SkipReasonSheet } from '@/features/habits/habit-ui';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * How the plan went: planned workout days (rest days don't count), done, skipped, missed, as this
 * week and this month; then the skips with their reasons (editable).
 */
export function GymConsistency({
  habit,
  today,
  weekStartsOn,
}: {
  habit: Habit;
  today: LocalDate;
  weekStartsOn: 0 | 1;
}) {
  const noon = parseISO(`${today}T12:00:00`);
  const monthStart = ymd(startOfMonth(noon));
  const logs = useHabitLogs(ymd(addDays(noon, -120)));
  const [editing, setEditing] = useState<HabitLog | null>(null);
  if (!logs) return null;
  const byDate = logsByDate(logs, habit.id);
  const weekStart = ymd(startOfWeek(noon, { weekStartsOn }));
  const periods = [
    {
      label: 'This week',
      s: adherence(habit, byDate, weekStart, ymd(addDays(parseISO(weekStart), 6)), today),
    },
    { label: 'This month', s: adherence(habit, byDate, monthStart, ymd(endOfMonth(noon)), today) },
  ];
  const skips = [...byDate.values()]
    .filter((l) => l.status === 'skipped')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <section aria-labelledby="gym-consistency" className="space-y-4">
      <h2 id="gym-consistency" className="text-[15px] font-semibold md:text-sm">
        Consistency
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {periods.map(({ label, s }) => (
          <div key={label} className="border-line rounded-2xl border p-4" aria-label={`${label} consistency`}>
            <div className="flex items-baseline justify-between">
              <span className="text-muted text-xs">{label}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {s.pct === null ? '—' : `${s.pct}%`}
              </span>
            </div>
            <p className="text-muted mt-1 text-xs tabular-nums">
              {s.done} of {s.planned} planned done · {s.skipped} skipped · {s.missed} missed · {s.rest} rest
              {s.extra ? ` · ${s.extra} extra` : ''}
            </p>
          </div>
        ))}
      </div>
      {skips.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Skipped workouts</h3>
          <ul className="border-line divide-line divide-y rounded-2xl border">
            {skips.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted w-24 shrink-0 tabular-nums">
                  {format(parseISO(l.date), 'EEE d MMM')}
                </span>
                <span className="min-w-0 flex-1">
                  {l.note ?? 'No reason given'}
                  {l.planned && <span className="text-muted block text-xs">Planned: {l.planned}</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && (
        <SkipReasonSheet
          habit={habit}
          dayLabel={format(parseISO(editing.date), 'EEEE d MMM')}
          planned={editing.planned}
          initial={editing.note ?? ''}
          onSkip={(reason) =>
            void attempt(() =>
              setHabitLog(habit.id, editing.date, 'skipped', reason, { planned: editing.planned }),
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
