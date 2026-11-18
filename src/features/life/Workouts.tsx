import { format, parseISO } from 'date-fns';
import { Dumbbell, Ellipsis, Plus, Trash, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { Button, EmptyState, Input, Loading, Textarea } from '@/components/ui';
import { useProfile, useWorkouts, useWorkoutSets } from '@/core/hooks';
import { bests, exerciseKey, prSets } from '@/core/domain/fitness';
import { toLocalDate } from '@/core/domain/tasks';
import type { WorkoutSet } from '@/core/domain/types';
import { addSet, createWorkout, deleteSet, deleteWorkout, updateWorkout } from '@/core/repos/life';
import { restoreFromTrash } from '@/core/repos/trash';

export const workoutPath = (id: string) => `/workouts/${id}`;
const kg = (w: number) => (w ? `${w} kg` : 'bodyweight');

/** Recent workouts and best lifts. Shown on the fitness section. */
export function WorkoutsSection({ nodeId }: { nodeId: string }) {
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const now = useNow();
  const navigate = useNavigate();
  if (!workouts || !sets) return null;
  const prs = prSets(workouts, sets);
  const best = [...bests(sets).values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);
  const start = () =>
    void attempt(async () => {
      const w = await createWorkout(toLocalDate(now), nodeId);
      navigate(workoutPath(w.id));
    });

  return (
    <section aria-labelledby="workouts-heading" className="mb-10">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="workouts-heading" className="flex-1 text-[15px] font-semibold md:text-sm">
          Workouts
        </h2>
        <Button size="sm" variant="ghost" onClick={start}>
          <Plus className="size-4" /> Log a workout
        </Button>
      </div>
      {workouts.length === 0 ? (
        <p className="text-muted text-sm">
          Log sets, reps and weights. New personal records are spotted for you.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
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
          {best.length > 0 && (
            <div>
              <h3 className="text-muted mb-2 text-xs font-medium">Best lifts</h3>
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
      )}
    </section>
  );
}

/** One workout: sets grouped by exercise, a quick "add set" row. */
export function WorkoutPage() {
  const { workoutId = '' } = useParams();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const profile = useProfile();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  if (!workouts || !sets) return <Loading />;
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
  const groups = new Map<string, WorkoutSet[]>();
  for (const s of mine)
    groups.set(exerciseKey(s.exercise), [...(groups.get(exerciseKey(s.exercise)) ?? []), s]);
  const known = [...bests(sets).values()].map((b) => b.name);
  const current = exercise || mine.at(-1)?.exercise || '';

  const add = () =>
    void attempt(async () => {
      const s = await addSet(w.id, current, Number(reps), Number(weight || 0));
      const all = prSets(workouts, [...sets, s]);
      if (all.has(s.id)) toast(`New personal record: ${s.exercise}, ${s.reps} × ${kg(s.weight)}`);
      setExercise(s.exercise);
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

      <form
        className="border-line mb-6 flex flex-wrap items-end gap-2 rounded-2xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (current && reps) add();
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs">
          <span className="text-muted">Exercise</span>
          <Input
            list="exercises"
            value={current}
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
        <Button type="submit" variant="primary" disabled={!current.trim() || !reps}>
          Add set
        </Button>
      </form>

      {groups.size === 0 ? (
        <p className="text-muted mb-6 text-sm">No sets yet. Add your first one above.</p>
      ) : (
        <div className="mb-6 space-y-5">
          {[...groups.values()].map((g) => (
            <section key={g[0]!.id} aria-label={g[0]!.exercise}>
              <h2 className="mb-1 text-sm font-semibold">{g[0]!.exercise}</h2>
              <ol className="space-y-0.5">
                {g.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted w-12 tabular-nums">Set {i + 1}</span>
                    <span className="tabular-nums">
                      {s.reps} × {kg(s.weight)}
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
                      aria-label={`Remove set ${i + 1} of ${s.exercise}`}
                      onClick={() => void attempt(() => deleteSet(s.id))}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
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
