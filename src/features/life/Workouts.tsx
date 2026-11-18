import { format, parseISO } from 'date-fns';
import { Dumbbell, Ellipsis, HeartPulse, Trash, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { Button, EmptyState, Input, Loading, Textarea } from '@/components/ui';
import { useProfile, useRoutines, useWorkouts, useWorkoutSets } from '@/core/hooks';
import { bests, CARDIO, exerciseKey, lastTime, prSets } from '@/core/domain/fitness';
import type { RoutineExercise, WorkoutSession, WorkoutSet } from '@/core/domain/types';
import { addCardio, addSet, checkInGym, deleteSet, deleteWorkout, updateWorkout } from '@/core/repos/life';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';

export const workoutPath = (id: string) => `/workouts/${id}`;
const kg = (w: number) => (w ? `${w} kg` : 'bodyweight');
const cardioLabel = (s: WorkoutSet) => `${s.minutes} min${s.distanceKm ? ` · ${s.distanceKm} km` : ''}`;

/** Recent workouts and best lifts (Gym section). */
export function RecentWorkouts() {
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  if (!workouts || !sets || workouts.length === 0) return null;
  const prs = prSets(workouts, sets);
  const best = [...bests(sets).values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
      <div>
        <h2 className="mb-3 text-[15px] font-semibold md:text-sm">Recent workouts</h2>
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {workouts.slice(0, 8).map((w) => {
            const mine = sets.filter((s) => s.sessionId === w.id);
            const names = [...new Set(mine.map((s) => s.exercise))];
            const newPrs = mine.filter((s) => prs.has(s.id)).length;
            return (
              <li key={w.id}>
                <Link
                  to={workoutPath(w.id)}
                  className="hover:bg-surface-2/60 flex items-center gap-4 px-4 py-3"
                >
                  <span className="text-muted w-24 shrink-0 text-sm">
                    {format(parseISO(w.date), 'EEE d MMM')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{w.title}</span>
                    <span className="text-muted"> · {names.join(', ') || 'no sets yet'}</span>
                  </span>
                  {newPrs > 0 && (
                    <span className="text-sec-self flex items-center gap-1 text-xs">
                      <Trophy className="size-3.5" /> {newPrs}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {best.length > 0 && (
        <div>
          <h2 className="mb-3 text-[15px] font-semibold md:text-sm">Best lifts</h2>
          <ul className="space-y-1 text-sm">
            {best.map((b) => (
              <li key={b.name} className="flex justify-between gap-3">
                <span className="truncate">{b.name}</span>
                <span className="text-muted tabular-nums">{kg(b.heaviest)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Logged sets of one exercise, with PR badges and remove buttons. */
function SetList({ sets, prs }: { sets: WorkoutSet[]; prs: Set<string> }) {
  return (
    <ol className="space-y-0.5">
      {sets.map((s, i) => (
        <li key={s.id} className="flex items-center gap-3 text-sm">
          <span className="text-muted w-12 tabular-nums">
            {s.kind === 'cardio' ? 'Cardio' : `Set ${i + 1}`}
          </span>
          <span className="tabular-nums">
            {s.kind === 'cardio' ? cardioLabel(s) : `${s.reps} × ${kg(s.weight)}`}
          </span>
          {prs.has(s.id) && (
            <span className="text-sec-self flex items-center gap-1 text-xs font-medium">
              <Trophy className="size-3.5" /> PR
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={`Remove ${s.kind === 'cardio' ? '' : `set ${i + 1} of `}${s.exercise}`}
            onClick={() => void attempt(() => deleteSet(s.id))}
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
    </ol>
  );
}

/** One planned exercise: target, what you did last time, and a one-tap "log set" pre-filled from it. */
function PlannedExercise({
  plan,
  w,
  done,
  last,
  prs,
  onLogged,
}: {
  plan: RoutineExercise;
  w: WorkoutSession;
  done: WorkoutSet[];
  last: WorkoutSet[];
  prs: Set<string>;
  onLogged: (s: WorkoutSet) => void;
}) {
  // Pre-fill: the matching set from last time, else the set just logged.
  const hint = last[Math.min(done.length, last.length - 1)] ?? done.at(-1);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const complete = plan.cardio ? done.length > 0 : done.length >= plan.sets;
  const r = reps || String(hint?.reps ?? (parseInt(plan.reps) || ''));
  const wt = weight || String(hint?.weight ?? '');
  const mins = minutes || String(plan.minutes ?? hint?.minutes ?? '');

  const log = () =>
    void attempt(async () => {
      const s = plan.cardio
        ? await addCardio(w.id, plan.name, Number(mins), km ? Number(km) : undefined)
        : await addSet(w.id, plan.name, Number(r), Number(wt || 0));
      setReps('');
      setWeight('');
      onLogged(s);
    });

  return (
    <section
      aria-label={plan.name}
      className={cn('border-line rounded-2xl border p-4', complete && 'border-sec-self/50')}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="flex-1 font-semibold">{plan.name}</h2>
        <span className={cn('text-sm tabular-nums', complete ? 'text-sec-self font-medium' : 'text-muted')}>
          {plan.cardio
            ? `${plan.minutes} min`
            : `${Math.min(done.length, plan.sets)}/${plan.sets} × ${plan.reps}`}
        </span>
      </div>
      {last.length > 0 && (
        <p className="text-muted mb-2 text-xs">
          Last time:{' '}
          {last
            .map((s) => (s.kind === 'cardio' ? cardioLabel(s) : `${s.reps}×${s.weight || 'bw'}`))
            .join(', ')}
        </p>
      )}
      {done.length > 0 && (
        <div className="mb-2">
          <SetList sets={done} prs={prs} />
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          log();
        }}
      >
        {plan.cardio ? (
          <>
            <label className="flex w-24 flex-col gap-1 text-xs">
              <span className="text-muted">Minutes</span>
              <Input type="number" min={1} value={mins} onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs">
              <span className="text-muted">km (optional)</span>
              <Input type="number" min={0} step="0.1" value={km} onChange={(e) => setKm(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="flex w-20 flex-col gap-1 text-xs">
              <span className="text-muted">Reps</span>
              <Input type="number" min={1} value={r} onChange={(e) => setReps(e.target.value)} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs">
              <span className="text-muted">kg</span>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={wt}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
              />
            </label>
          </>
        )}
        <Button
          type="submit"
          variant={complete ? 'secondary' : 'primary'}
          disabled={plan.cardio ? !(Number(mins) > 0) : !(Number(r) >= 1)}
          aria-label={plan.cardio ? `Log ${plan.name}` : `Log a set of ${plan.name}`}
        >
          {plan.cardio ? 'Log cardio' : 'Log set'}
        </Button>
      </form>
    </section>
  );
}

/** One workout: the plan from your routine (if any), extra exercises, cardio and notes. */
export function WorkoutPage() {
  const { workoutId = '' } = useParams();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const routines = useRoutines();
  const profile = useProfile();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState('');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');

  if (!workouts || !sets || !routines) return <Loading />;
  const w = workouts.find((x) => x.id === workoutId);
  if (!w)
    return (
      <EmptyState title="This workout doesn’t exist">
        It may have been deleted.{' '}
        <Link to="/trash" className="font-medium hover:underline">
          Open Trash
        </Link>
      </EmptyState>
    );

  const prs = prSets(workouts, sets);
  const mine = sets.filter((s) => s.sessionId === w.id);
  const plan = routines.find((r) => r.id === w.routineId)?.days[w.dayIndex ?? 0]?.exercises ?? [];
  const planned = new Set(plan.map((p) => exerciseKey(p.name)));
  const extra = new Map<string, WorkoutSet[]>();
  for (const s of mine)
    if (!planned.has(exerciseKey(s.exercise)))
      extra.set(exerciseKey(s.exercise), [...(extra.get(exerciseKey(s.exercise)) ?? []), s]);
  const known = [...bests(sets).values()].map((b) => b.name);

  /** After each log: PR toast, and the first entry checks in your gym habit for the day. */
  const logged = (s: WorkoutSet) => {
    if (s.kind !== 'cardio' && prSets(workouts, [...sets, s]).has(s.id))
      toast(`New personal record: ${s.exercise}, ${s.reps} × ${kg(s.weight)}`);
    if (!mine.length) void attempt(() => checkInGym(w.date, w.nodeId));
  };
  const addExtra = () =>
    void attempt(async () => {
      const s = await addSet(w.id, exercise, Number(reps), Number(weight || 0));
      logged(s);
    });
  const addCardioEntry = () =>
    void attempt(async () => {
      const s = await addCardio(w.id, activity, Number(minutes), km ? Number(km) : undefined);
      setMinutes('');
      setKm('');
      logged(s);
    });

  return (
    <>
      <header className="mb-6 flex items-start gap-3">
        <Dumbbell className="text-muted mt-2 size-7 shrink-0" />
        <input
          aria-label="Workout name"
          key={w.title}
          defaultValue={w.title}
          onBlur={(e) =>
            e.target.value.trim() !== w.title &&
            void attempt(() => updateWorkout(w.id, { title: e.target.value.trim() || 'Workout' }))
          }
          className="min-w-0 flex-1 bg-transparent text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] outline-none md:text-4xl"
        />
        <Menu
          trigger={
            <Button variant="ghost" size="icon" aria-label="Workout options">
              <Ellipsis className="size-5" />
            </Button>
          }
          items={[
            {
              label: 'Delete workout',
              icon: Trash,
              danger: true,
              onSelect: () =>
                void attempt(async () => {
                  const b = await deleteWorkout(w.id);
                  if (b) toast(`Moved “${w.title}” to Trash`, () => restoreFromTrash(b));
                  navigate(-1);
                }),
            },
          ]}
        />
      </header>
      <div className="mb-6 w-52">
        <DatePicker
          value={w.date}
          weekStartsOn={profile?.weekStartsOn}
          onChange={(v) => v && void attempt(() => updateWorkout(w.id, { date: v }))}
        >
          <DateButton label="Workout date" value={w.date} />
        </DatePicker>
      </div>

      {plan.length > 0 && (
        <div className="mb-8 space-y-3">
          {plan.map((p) => (
            <PlannedExercise
              key={p.name}
              plan={p}
              w={w}
              done={mine.filter((s) => exerciseKey(s.exercise) === exerciseKey(p.name))}
              last={lastTime(p.name, sets, workouts, w.id)}
              prs={prs}
              onLogged={logged}
            />
          ))}
        </div>
      )}

      <h2 className="mb-2 text-[15px] font-semibold md:text-sm">
        {plan.length ? 'Another exercise' : 'Add a set'}
      </h2>
      <form
        className="border-line mb-6 flex flex-wrap items-end gap-2 rounded-2xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (exercise.trim() && reps) addExtra();
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted">Exercise</span>
          <Input
            list="exercises"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="e.g. Bench press"
          />
          <datalist id="exercises">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="text-muted">Reps</span>
          <Input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs">
          <span className="text-muted">Weight (kg)</span>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
          />
        </label>
        <Button type="submit" variant="primary" disabled={!exercise.trim() || !reps}>
          Add set
        </Button>
      </form>

      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold md:text-sm">
        <HeartPulse className="text-sec-personal size-4" /> Cardio
      </h2>
      <form
        className="border-line mb-6 flex flex-wrap items-end gap-2 rounded-2xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (activity.trim() && Number(minutes) > 0) addCardioEntry();
        }}
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted">Activity</span>
          <Input
            list="cardio"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="e.g. Running"
          />
          <datalist id="cardio">
            {CARDIO.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="text-muted">Minutes</span>
          <Input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="flex w-24 flex-col gap-1 text-xs">
          <span className="text-muted">km (optional)</span>
          <Input type="number" min={0} step="0.1" value={km} onChange={(e) => setKm(e.target.value)} />
        </label>
        <Button type="submit" variant="primary" disabled={!activity.trim() || !(Number(minutes) > 0)}>
          Log cardio
        </Button>
      </form>

      {extra.size > 0 && (
        <div className="mb-6 space-y-5">
          {[...extra.values()].map((g) => (
            <section key={g[0]!.id} aria-label={g[0]!.exercise}>
              <h2 className="mb-1 text-sm font-semibold">{g[0]!.exercise}</h2>
              <SetList sets={g} prs={prs} />
            </section>
          ))}
        </div>
      )}
      {mine.length === 0 && plan.length === 0 && (
        <p className="text-muted mb-6 text-sm">No sets yet. Add your first one above.</p>
      )}

      <Textarea
        aria-label="Workout notes"
        key={w.notes ?? ''}
        defaultValue={w.notes ?? ''}
        placeholder="How did it feel?"
        onBlur={(e) =>
          e.target.value !== (w.notes ?? '') &&
          void attempt(() => updateWorkout(w.id, { notes: e.target.value || undefined }))
        }
        className="min-h-20"
      />
    </>
  );
}
