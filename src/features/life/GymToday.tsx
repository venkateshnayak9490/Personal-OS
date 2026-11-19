import { format } from 'date-fns';
import { Check, Dumbbell, Moon, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import { useHabitLogs, useProfile, useRoutines, useWorkouts } from '@/core/hooks';
import { isFinished, plannedOn, todaysDayIndex, WEEKDAYS } from '@/core/domain/fitness';
import { toLocalDate } from '@/core/domain/tasks';
import type { Habit } from '@/core/domain/types';
import { endWorkout, startWorkout } from '@/core/repos/life';
import { setHabitLog } from '@/core/repos/plans';
import { SkipReasonSheet } from '@/features/habits/habit-ui';
import { useNodeTree } from '@/features/structure/use-tree';
import { duration, workoutPath } from './Workouts';

/**
 * The Gym habit's card (Habits, Today): today's planned workout from your routine and what to do
 * about it, right here. Pending: Start workout or Skip. In progress: End workout. Completed: when
 * and how long. Skipped: the reason (editable). Rest day: nothing to do. Start and End work on the
 * real workout session (one per day, kept across reloads); only End completes the habit.
 */
export function GymPlanLine({ habit }: { habit: Habit }) {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const profile = useProfile();
  const tree = useNodeTree();
  const now = useNow();
  const today = toLocalDate(now, profile?.timezone);
  const logs = useHabitLogs(today);
  const [skipping, setSkipping] = useState(false);
  if (!routines || !workouts || !logs) return null;
  const gymNode = tree?.nodes.find((n) => n.moduleKey === 'fitness' && !n.deletedAt);
  const active = routines.find((r) => r.active);
  const todays = workouts.filter((w) => w.date === today);
  const inProgress = todays.find((w) => !isFinished(w));
  const finished = todays.filter(isFinished).sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
  const log = logs.find((l) => l.habitId === habit.id && l.date === today && !l.deletedAt);

  if (!active)
    return (
      <p className="text-muted text-xs">
        Pick a routine in{' '}
        {gymNode ? (
          <Link to={nodePath(gymNode.id)} className="underline">
            Gym & Fitness
          </Link>
        ) : (
          'Gym & Fitness'
        )}{' '}
        to plan each day.
      </p>
    );

  // Today's plan: weekday routines (with this week's own changes), else the next day in order.
  const p = active.byWeekday
    ? plannedOn(active, routines, today)
    : { routine: active, dayIndex: todaysDayIndex(active, workouts, today), changed: false };
  const day = !active.paused && p.routine ? p.routine.days[p.dayIndex] : undefined;
  const from = p.routine && day ? { routineId: p.routine.id, dayIndex: p.dayIndex } : undefined;

  const start = () =>
    void attempt(async () => {
      const w = await startWorkout(today, gymNode?.id, day?.name ?? 'Workout', from);
      toast(`Workout started at ${format(w.startedAt ?? Date.now(), 'HH:mm')}`);
    });
  const end = (id: string) =>
    void attempt(async () => {
      await endWorkout(id);
      toast('Workout finished: Gym done for today');
    });

  const label = day
    ? `${active.byWeekday ? `${WEEKDAYS[new Date(`${today}T12:00`).getDay()]}: ` : ''}${day.name}`
    : active.paused
      ? 'Routine paused: nothing due'
      : 'Rest day';

  let status: React.ReactNode;
  if (inProgress)
    status = (
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span className="text-sec-self font-medium">
          In progress{inProgress.startedAt ? ` since ${format(inProgress.startedAt, 'HH:mm')}` : ''}
        </span>
        <Link to={workoutPath(inProgress.id)} className="text-muted underline">
          Log sets
        </Link>
        <Button size="sm" variant="primary" onClick={() => end(inProgress.id)}>
          <Square className="size-3.5" /> End workout
        </Button>
      </span>
    );
  else if (log?.status === 'done') {
    const w = finished.find((x) => x.id === log.workoutId) ?? finished[0];
    status = (
      <span className="text-sec-self flex items-center gap-1 font-medium">
        <Check className="size-3.5" strokeWidth={3} /> <span>Done</span>
        {w?.startedAt && w.endedAt && (
          <Link to={workoutPath(w.id)} className="text-muted ml-1 font-normal underline">
            {format(w.startedAt, 'HH:mm')}–{format(w.endedAt, 'HH:mm')} · {duration(w.endedAt - w.startedAt)}
          </Link>
        )}
      </span>
    );
  } else if (log?.status === 'skipped')
    status = (
      <span className="text-muted flex items-center gap-2">
        Skipped{log.note ? `: ${log.note}` : ''}
        <Button size="sm" variant="ghost" onClick={() => setSkipping(true)}>
          Edit reason
        </Button>
      </span>
    );
  else if (!day)
    status = (
      <span className="ml-auto flex items-center gap-2">
        <span className="text-muted">No workout due</span>
        <Button size="sm" variant="ghost" onClick={start}>
          Train anyway
        </Button>
      </span>
    );
  else
    status = (
      <span className="ml-auto flex gap-1">
        <Button size="sm" variant="primary" onClick={start} aria-label={`Start workout: ${day.name}`}>
          <Play className="size-3.5" /> Start workout
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSkipping(true)}>
          Skip
        </Button>
      </span>
    );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      {day ? <Dumbbell className="text-muted size-3.5" /> : <Moon className="text-muted size-3.5" />}
      <span className="font-medium">{label}</span>
      {p.changed && <span className="text-muted">(this week)</span>}
      {(day?.muscles ?? []).map((m) => (
        <span key={m} className="bg-surface-2 rounded-full px-2 py-0.5">
          {m}
        </span>
      ))}
      {status}
      {skipping && (
        <SkipReasonSheet
          habit={habit}
          dayLabel="Today"
          planned={day?.name}
          initial={log?.status === 'skipped' ? (log.note ?? '') : ''}
          optional
          onSkip={(reason) =>
            void attempt(() =>
              setHabitLog(habit.id, today, 'skipped', reason || undefined, day ? { planned: day.name } : {}),
            )
          }
          onClose={() => setSkipping(false)}
        />
      )}
    </div>
  );
}
