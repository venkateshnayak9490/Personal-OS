import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { Button } from '@/components/ui';
import { useHabitLogs } from '@/core/hooks';
import { adherence, isScheduled, logsByDate, streak, targetOn } from '@/core/domain/progress';
import type { Habit, HabitLog, LocalDate, Routine } from '@/core/domain/types';
import { setHabitLog } from '@/core/repos/plans';
import { SkipReasonSheet } from '@/features/habits/habit-ui';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/** A day you didn't train: skipped (you said so), or missed (the day passed); the reason is optional. */
type Off = { date: LocalDate; status: 'skipped' | 'missed'; note?: string; planned?: string };

/**
 * How the plan went: planned workout days (rest days don't count), done, skipped, missed, as this
 * week and this month; then the skipped and missed days of the last 4 weeks, each with an
 * optional reason you can add or edit.
 */
export function GymConsistency({
  habit,
  routine,
  today,
  weekStartsOn,
}: {
  habit: Habit;
  routine?: Routine;
  today: LocalDate;
  weekStartsOn: 0 | 1;
}) {
  const noon = parseISO(`${today}T12:00:00`);
  const monthStart = ymd(startOfMonth(noon));
  const logs = useHabitLogs(ymd(addDays(noon, -120)));
  const [editing, setEditing] = useState<Off | null>(null);
  if (!logs) return null;
  const byDate = logsByDate(logs, habit.id);
  const weekStart = ymd(startOfWeek(noon, { weekStartsOn }));
  const periods = [
    {
      label: 'This week',
      s: adherence(habit, byDate, weekStart, ymd(addDays(parseISO(weekStart), 6)), today, weekStartsOn),
    },
    {
      label: 'This month',
      s: adherence(habit, byDate, monthStart, ymd(endOfMonth(noon)), today, weekStartsOn),
    },
  ];
  const plannedOn = (date: LocalDate) =>
    routine?.byWeekday ? routine.days.find((d) => d.weekday === parseISO(date).getDay())?.name : undefined;
  const since = ymd(
    new Date(Math.max(addDays(noon, -28).getTime(), new Date(habit.createdAt).setHours(0, 0, 0, 0))),
  );
  const off: Off[] = [];
  for (let d = parseISO(since); ymd(d) < today; d = addDays(d, 1)) {
    const day = ymd(d);
    const l: HabitLog | undefined = byDate.get(day);
    if (l?.status === 'skipped' || l?.status === 'missed')
      off.push({ date: day, status: l.status, note: l.note, planned: l.planned });
    else if (!l && targetOn(habit, day).type !== 'perWeek' && isScheduled(habit, day))
      off.push({ date: day, status: 'missed', planned: plannedOn(day) });
  }
  const todayLog = byDate.get(today);
  if (todayLog?.status === 'skipped')
    off.push({ date: today, status: 'skipped', note: todayLog.note, planned: todayLog.planned });
  const skips = off.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <section aria-labelledby="gym-consistency" className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 id="gym-consistency" className="flex-1 text-[15px] font-semibold md:text-sm">
          Consistency
        </h2>
        <span className="text-muted text-xs tabular-nums">
          Streak: {streak(habit, byDate, today, weekStartsOn)}{' '}
          {habit.target.type === 'perWeek' ? 'weeks' : 'planned days'} in a row
        </span>
      </div>
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
          <h3 className="mb-2 text-sm font-semibold">Skipped and missed</h3>
          <ul
            aria-label="Skipped and missed workouts"
            className="border-line divide-line divide-y rounded-2xl border"
          >
            {skips.map((l) => (
              <li
                key={l.date}
                aria-label={`${format(parseISO(l.date), 'EEEE d MMM')}: ${l.status}`}
                className="flex items-start gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-muted w-24 shrink-0 tabular-nums">
                  {format(parseISO(l.date), 'EEE d MMM')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted mr-1.5 text-xs">
                    {l.status === 'skipped' ? 'Skipped' : 'Missed'}
                  </span>
                  {l.note ?? <span className="text-muted">No reason given</span>}
                  {l.planned && <span className="text-muted block text-xs">Planned: {l.planned}</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                  {l.note ? 'Edit' : 'Add reason'}
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
          optional
          missed={editing.status === 'missed'}
          onSkip={(reason) =>
            void attempt(() =>
              setHabitLog(habit.id, editing.date, editing.status, reason || undefined, {
                ...(editing.planned ? { planned: editing.planned } : {}),
              }),
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
