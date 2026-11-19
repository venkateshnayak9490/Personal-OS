import { format, parseISO } from 'date-fns';
import { Dumbbell, Ellipsis, HeartPulse, Pencil, Square, Trash, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState, Input, Loading, Textarea } from '@/components/ui';
import { useProfile, useRoutines, useWorkouts, useWorkoutSets } from '@/core/hooks';
import { bests, CARDIO, exerciseKey, lastTime, prSets } from '@/core/domain/fitness';
import type { RoutineExercise, WorkoutSession, WorkoutSet } from '@/core/domain/types';
import {
  addCardio,
  addSet,
  deleteSet,
  deleteWorkout,
  endWorkout,
  restoreWorkout,
  updateSet,
  updateWorkout,
} from '@/core/repos/life';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';

export const workoutPath = (id: string) => `/workouts/${id}`;
const kg = (w: number) => (w ? `${w} kg` : 'bodyweight');
const cardioLabel = (s: WorkoutSet) => `${s.minutes} min${s.distanceKm ? ` · ${s.distanceKm} km` : ''}`;
const hhmm = (ms: number) => format(ms, 'HH:mm');
export const duration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
/** A time typed for a workout's day, as epoch ms (an end before the start is after midnight). */
const at = (date: string, time: string, after?: number) => {
  const t = new Date(`${date}T${time}`).getTime();
  return after !== undefined && t < after ? t + 86_400_000 : t;
};

/** Recent workouts (each can be deleted, after confirming, with Undo) and best lifts (Gym section). */
export function RecentWorkouts() {
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const [deleting, setDeleting] = useState<WorkoutSession | null>(null);
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
              <li key={w.id} className="flex items-center">
                <Link
                  to={workoutPath(w.id)}
                  className="hover:bg-surface-2/60 flex min-w-0 flex-1 items-center gap-4 py-3 pl-4"
                >
                  <span className="text-muted w-24 shrink-0 text-sm">
                    {format(parseISO(w.date), 'EEE d MMM')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{w.title}</span>
                    {w.startedAt && w.endedAt ? (
                      <span className="text-muted"> · {duration(w.endedAt - w.startedAt)}</span>
                    ) : !w.endedAt && w.startedAt ? (
                      <span className="text-sec-self"> · in progress</span>
                    ) : null}
                    <span className="text-muted"> · {names.join(', ') || 'no sets yet'}</span>
                  </span>
                  {newPrs > 0 && (
                    <span className="text-sec-self flex items-center gap-1 text-xs">
                      <Trophy className="size-3.5" /> {newPrs}
                    </span>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mx-2 shrink-0"
                  aria-label={`Delete ${w.title}, ${format(parseISO(w.date), 'EEE d MMM')}`}
                  onClick={() => setDeleting(w)}
                >
                  <Trash className="size-4" />
                </Button>
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
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ''}”?`}
        description="It moves to Trash with its sets. If it completed your Gym habit that day, the check-in is removed too. You can undo or restore it from Trash."
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => {
          const w = deleting!;
          setDeleting(null);
          void attempt(async () => {
            const b = await deleteWorkout(w.id);
            if (b) toast(`Moved “${w.title}” to Trash`, () => restoreWorkout(b, w.id));
          });
        }}
      />
    </div>
  );
}

/** Logged sets of one exercise, with PR badges; each can be corrected or removed (with Undo). */
function SetList({ sets, prs }: { sets: WorkoutSet[]; prs: Set<string> }) {
  return (
    <ol className="space-y-0.5">
      {sets.map((s, i) => (
        <SetRow key={s.id} s={s} n={i + 1} pr={prs.has(s.id)} />
      ))}
    </ol>
  );
}

function SetRow({ s, n, pr }: { s: WorkoutSet; n: number; pr: boolean }) {
  const cardio = s.kind === 'cardio';
  const name = cardio ? s.exercise : `set ${n} of ${s.exercise}`;
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const open = () => {
    setA(String(cardio ? s.minutes : s.reps));
    setB(cardio ? String(s.distanceKm ?? '') : String(s.weight || ''));
    setEditing(true);
  };
  const save = () =>
    void attempt(async () => {
      await updateSet(
        s.id,
        cardio
          ? { minutes: Number(a), distanceKm: b ? Number(b) : undefined }
          : { reps: Number(a), weight: Number(b || 0) },
      );
      setEditing(false);
    });
  const remove = () =>
    void attempt(async () => {
      const batch = await deleteSet(s.id);
      if (batch) toast(`Removed ${name}`, () => restoreFromTrash(batch));
    });

  if (editing)
    return (
      <li>
        <form
          aria-label={`Edit ${name}`}
          className="bg-surface-2/60 flex flex-wrap items-end gap-2 rounded-xl p-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="flex w-20 flex-col gap-1 text-xs">
            <span className="text-muted">{cardio ? 'Minutes' : 'Reps'}</span>
            <Input type="number" min={1} value={a} onChange={(e) => setA(e.target.value)} autoFocus />
          </label>
          <label className="flex w-24 flex-col gap-1 text-xs">
            <span className="text-muted">{cardio ? 'km' : 'kg'}</span>
            <Input
              type="number"
              min={0}
              step={cardio ? '0.1' : '0.5'}
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder={cardio ? '' : '0'}
            />
          </label>
          <Button type="submit" size="sm" variant="primary" disabled={!(Number(a) >= 1)}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </li>
    );

  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="text-muted w-12 tabular-nums">{cardio ? 'Cardio' : `Set ${n}`}</span>
      <span className="tabular-nums">{cardio ? cardioLabel(s) : `${s.reps} × ${kg(s.weight)}`}</span>
      {pr && (
        <span className="text-sec-self flex items-center gap-1 text-xs font-medium">
          <Trophy className="size-3.5" /> PR
        </span>
      )}
      <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Edit ${name}`} onClick={open}>
        <Pencil className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={remove}>
        <X className="size-4" />
      </Button>
    </li>
  );
}

/** Started / ended, the duration, and End workout. Times can be corrected once it has ended. */
function SessionTimes({ w }: { w: WorkoutSession }) {
  if (!w.endedAt)
    return (
      <div className="border-line mb-6 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3">
        <span className="text-sm">
          {w.startedAt ? (
            <>
              Started <span className="font-medium tabular-nums">{hhmm(w.startedAt)}</span>
            </>
          ) : (
            'Not finished yet'
          )}
        </span>
        <span className="text-muted text-xs">Ending it marks your Gym habit done for the day.</span>
        <Button
          className="ml-auto"
          variant="primary"
          onClick={() =>
            void attempt(async () => {
              await endWorkout(w.id);
              toast('Workout finished');
            })
          }
        >
          <Square className="size-3.5" /> End workout
        </Button>
      </div>
    );
  const set = (field: 'startedAt' | 'endedAt', v: string) =>
    v &&
    void attempt(() =>
      updateWorkout(w.id, {
        [field]: field === 'endedAt' ? at(w.date, v, w.startedAt) : at(w.date, v),
      }),
    );
  return (
    <div className="border-line mb-6 flex flex-wrap items-end gap-3 rounded-2xl border px-4 py-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">Started</span>
        <Input
          type="time"
          aria-label="Start time"
          key={`s${w.startedAt}`}
          defaultValue={w.startedAt ? hhmm(w.startedAt) : ''}
          onBlur={(e) =>
            e.target.value !== (w.startedAt ? hhmm(w.startedAt) : '') && set('startedAt', e.target.value)
          }
          className="w-28"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted">Ended</span>
        <Input
          type="time"
          aria-label="End time"
          key={`e${w.endedAt}`}
          defaultValue={hhmm(w.endedAt)}
          onBlur={(e) => e.target.value !== hhmm(w.endedAt!) && set('endedAt', e.target.value)}
          className="w-28"
        />
      </label>
      <span className="pb-2 text-sm">
        {w.startedAt ? (
          <>
            <span className="font-medium tabular-nums">{duration(w.endedAt - w.startedAt)}</span> · completed
          </>
        ) : (
          'Completed'
        )}
      </span>
      <Button
        className="ml-auto"
        size="sm"
        variant="ghost"
        onClick={() => void attempt(() => updateWorkout(w.id, { endedAt: undefined }))}
      >
        Not finished
      </Button>
    </div>
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
  const wt = weight || String(hint?.weight ?? plan.weight ?? '');
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
            : `${Math.min(done.length, plan.sets)}/${plan.sets} × ${plan.reps}${plan.weight ? ` @ ${plan.weight} kg` : ''}`}
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
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  /** After each log: a PR toast. (The Gym habit is checked in when you end the workout.) */
  const logged = (s: WorkoutSet) => {
    if (s.kind !== 'cardio' && prSets(workouts, [...sets, s]).has(s.id))
      toast(`New personal record: ${s.exercise}, ${s.reps} × ${kg(s.weight)}`);
  };
  const remove = () =>
    void attempt(async () => {
      const b = await deleteWorkout(w.id);
      if (b) toast(`Moved “${w.title}” to Trash`, () => restoreWorkout(b, w.id));
      // Back to the Gym section (not "back", which could leave the app after opening a link).
      navigate(w.nodeId ? nodePath(w.nodeId) : '/', { replace: true });
    });
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
              label: 'Delete workout…',
              icon: Trash,
              danger: true,
              onSelect: () => setConfirmDelete(true),
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
      <SessionTimes w={w} />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${w.title}”?`}
        description={`It moves to Trash with its ${mine.length} logged ${mine.length === 1 ? 'entry' : 'entries'}. If it completed your Gym habit that day, the check-in is removed too. You can undo or restore it from Trash.`}
        confirmLabel="Move to Trash"
        danger
        onConfirm={remove}
      />

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
