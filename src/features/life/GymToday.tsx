import { Dumbbell, Play } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import { useHabitLogs, useProfile, useRoutines, useWorkouts } from '@/core/hooks';
import { todaysDayIndex, WEEKDAYS } from '@/core/domain/fitness';
import { toLocalDate } from '@/core/domain/tasks';
import type { Habit } from '@/core/domain/types';
import { createWorkout } from '@/core/repos/life';
import { setHabitLog } from '@/core/repos/plans';
import { SkipReasonSheet } from '@/features/habits/habit-ui';
import { useNodeTree } from '@/features/structure/use-tree';
import { workoutPath } from './Workouts';

/**
 * Under the Gym habit (Habits, Today): today's planned workout from your weekday routine, with
 * Start and Skip. The routine is the plan; the habit just shows and tracks it.
 */
export function GymPlanLine({ habit }: { habit: Habit }) {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const profile = useProfile();
  const tree = useNodeTree();
  const now = useNow();
  const navigate = useNavigate();
  const today = toLocalDate(now, profile?.timezone);
  const logs = useHabitLogs(today);
  const [skipping, setSkipping] = useState(false);
  if (!routines || !workouts || !logs) return null;
  const gymNode = tree?.nodes.find((n) => n.moduleKey === 'fitness' && !n.deletedAt);
  const routine = routines.find((r) => r.active && r.byWeekday);
  const log = logs.find((l) => l.habitId === habit.id && l.date === today && !l.deletedAt);

  if (!routine)
    return (
      <p className="text-muted text-xs">
        Pick a weekday routine in{' '}
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
  if (routine.paused) return <p className="text-muted text-xs">Routine paused: nothing due.</p>;

  const i = todaysDayIndex(routine, workouts, today);
  const day = routine.days[i];
  if (!day) return <p className="text-muted text-xs">Today: rest day.</p>;

  const start = () =>
    void attempt(async () => {
      const w = await createWorkout(today, gymNode?.id, day.name, { routineId: routine.id, dayIndex: i });
      navigate(workoutPath(w.id));
    });

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <Dumbbell className="text-muted size-3.5" />
      <span className="font-medium">
        {WEEKDAYS[day.weekday ?? 0]}: {day.name}
      </span>
      {(day.muscles ?? []).map((m) => (
        <span key={m} className="bg-surface-2 rounded-full px-2 py-0.5">
          {m}
        </span>
      ))}
      {log?.status === 'done' ? (
        <span className="text-sec-self font-medium">Done</span>
      ) : log?.status === 'skipped' ? (
        <span className="text-muted">Skipped: {log.note ?? 'no reason'}</span>
      ) : (
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="primary" onClick={start} aria-label={`Start ${day.name}`}>
            <Play className="size-3.5" /> Start
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSkipping(true)}>
            Skip
          </Button>
        </span>
      )}
      {skipping && (
        <SkipReasonSheet
          habit={habit}
          dayLabel="Today"
          planned={day.name}
          onSkip={(reason) =>
            void attempt(() => setHabitLog(habit.id, today, 'skipped', reason, { planned: day.name }))
          }
          onClose={() => setSkipping(false)}
        />
      )}
    </div>
  );
}
