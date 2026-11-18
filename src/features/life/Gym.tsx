import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Check, Dumbbell, Ellipsis, Pencil, Play, Plus, Star, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Menu } from '@/components/Menu';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select } from '@/components/ui';
import { useProfile, useRoutines, useWorkouts, useWorkoutSets } from '@/core/hooks';
import { cardioTotals, LEVELS, nextDayIndex, PROGRAMS, type Program } from '@/core/domain/fitness';
import { toLocalDate } from '@/core/domain/tasks';
import type { FitnessLevel, Routine, RoutineExercise } from '@/core/domain/types';
import { updateProfileSettings } from '@/core/repos/profile';
import { createWorkout, deleteRoutine, saveRoutine, setActiveRoutine } from '@/core/repos/life';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';
import { RecentWorkouts, workoutPath } from './Workouts';

const minutesOf = (day: Routine['days'][number]) =>
  Math.round(day.exercises.reduce((m, e) => m + (e.cardio ? (e.minutes ?? 10) : e.sets * 2.5), 0) / 5) * 5;

/** Gym & Fitness section: today's workout from your routine, the week, routines and programs. */
export function GymSection({ nodeId }: { nodeId: string }) {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const profile = useProfile();
  const now = useNow();
  const navigate = useNavigate();
  const [browsing, setBrowsing] = useState(false);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [pickDay, setPickDay] = useState<number | null>(null);
  if (!routines || !workouts || !sets) return null;

  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const today = toLocalDate(now, profile?.timezone);
  const active = routines.find((r) => r.active);
  const dayIndex = active ? (pickDay ?? nextDayIndex(active, workouts)) % active.days.length : 0;
  const day = active?.days[dayIndex];
  const weekStart = startOfWeek(parseISO(today), { weekStartsOn });
  const week = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  const trained = new Set(workouts.map((w) => w.date));
  const doneThisWeek = week.filter((d) => trained.has(d)).length;
  const cardio = cardioTotals(sets, workouts, week[0]!, week[6]!);
  const doneToday = active && workouts.some((w) => w.date === today && w.routineId === active.id);

  const start = (from?: { routine: Routine; dayIndex: number }) =>
    void attempt(async () => {
      const w = await createWorkout(
        today,
        nodeId,
        from ? from.routine.days[from.dayIndex]!.name : 'Workout',
        from ? { routineId: from.routine.id, dayIndex: from.dayIndex } : undefined,
      );
      navigate(workoutPath(w.id));
    });

  return (
    <section aria-label="Gym" className="mb-10 space-y-8">
      {/* Today's workout */}
      <div className="bg-surface border-line overflow-hidden rounded-3xl border">
        <div className="p-5 md:p-6">
          <p className="text-muted text-[13px] font-medium md:text-xs">
            {doneToday ? 'Done today. Next up' : 'Today’s workout'}
          </p>
          {active && day ? (
            <>
              <h2 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
                {day.name}
              </h2>
              <p className="text-muted mt-1 text-sm">
                {active.title} · day {dayIndex + 1} of {active.days.length} · about {minutesOf(day)} min
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {day.exercises.map((e) => (
                  <li key={e.name} className="bg-bg/60 rounded-full px-3 py-1 text-[13px]">
                    {e.name}{' '}
                    <span className="text-muted">
                      {e.cardio ? `${e.minutes} min` : `${e.sets}×${e.reps}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => start({ routine: active, dayIndex })}>
                  <Play className="size-4" /> Start {day.name}
                </Button>
                {active.days.length > 1 && (
                  <Select
                    aria-label="Do a different day"
                    value={dayIndex}
                    onChange={(e) => setPickDay(Number(e.target.value))}
                    className="w-auto"
                  >
                    {active.days.map((d, i) => (
                      <option key={i} value={i}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Button variant="ghost" onClick={() => start()}>
                  Free workout
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight">
                Pick a routine
              </h2>
              <p className="text-muted mt-1 text-sm">
                Choose a program for your level and the app tells you what to do each day.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setBrowsing(true)}>
                  <Star className="size-4" /> Choose a routine
                </Button>
                <Button variant="ghost" onClick={() => start()}>
                  <Dumbbell className="size-4" /> Log a free workout
                </Button>
              </div>
            </>
          )}
        </div>
        {/* The week */}
        <div className="border-line flex items-center gap-4 border-t px-5 py-3 md:px-6">
          <ol className="flex gap-1.5" aria-label="This week">
            {week.map((d) => (
              <li
                key={d}
                aria-label={`${format(parseISO(d), 'EEEE')}: ${trained.has(d) ? 'trained' : 'no workout'}`}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-[11px] font-medium',
                  trained.has(d) ? 'bg-sec-self text-bg' : 'bg-surface-2 text-muted',
                  d === today && !trained.has(d) && 'ring-fg/50 ring-1',
                )}
              >
                {trained.has(d) ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  format(parseISO(d), 'EEEEE')
                )}
              </li>
            ))}
          </ol>
          <div className="text-muted ml-auto text-right text-xs">
            <div className="text-fg text-sm font-medium tabular-nums">
              {doneThisWeek}
              {active ? ` of ${active.perWeek}` : ''} workouts
            </div>
            {cardio.minutes > 0 && (
              <div className="tabular-nums">
                Cardio {cardio.minutes} min{cardio.km ? ` · ${cardio.km} km` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Routines */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-semibold md:text-sm">Your routines</h2>
          <Button size="sm" variant="ghost" onClick={() => setBrowsing(true)}>
            <Star className="size-4" /> Programs
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Create
          </Button>
        </div>
        {routines.length === 0 ? (
          <p className="text-muted text-sm">
            None yet. Pick a program for your level, or create your own routine.
          </p>
        ) : (
          <ul className="border-line divide-line divide-y rounded-2xl border">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium md:text-sm">
                    <span className="truncate">{r.title}</span>
                    {r.active && (
                      <span className="bg-sec-self/20 text-sec-self rounded-full px-2 py-0.5 text-[11px]">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-muted truncate text-xs">
                    {r.level ? `${LEVELS.find((l) => l.value === r.level)?.label} · ` : ''}
                    {r.perWeek}× a week · {r.days.map((d) => d.name).join(', ')}
                  </div>
                </div>
                <Menu
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Options for ${r.title}`}>
                      <Ellipsis className="size-4" />
                    </Button>
                  }
                  items={[
                    ...(!r.active
                      ? [
                          {
                            label: 'Make active',
                            icon: Star,
                            onSelect: () => {
                              setPickDay(null);
                              void attempt(() => setActiveRoutine(r.id));
                            },
                          },
                        ]
                      : []),
                    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(r) },
                    null,
                    {
                      label: 'Delete',
                      icon: Trash,
                      danger: true,
                      onSelect: () =>
                        void attempt(async () => {
                          const b = await deleteRoutine(r.id);
                          if (b) toast(`Moved “${r.title}” to Trash`, () => restoreFromTrash(b));
                        }),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecentWorkouts />

      {browsing && (
        <ProgramsSheet
          level={profile?.settings.fitnessLevel as FitnessLevel | undefined}
          onClose={() => setBrowsing(false)}
          onPicked={() => setPickDay(null)}
        />
      )}
      {editing && (
        <RoutineSheet routine={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

/** Built-in programs, recommended by your level. */
function ProgramsSheet({
  level,
  onClose,
  onPicked,
}: {
  level?: FitnessLevel;
  onClose: () => void;
  onPicked: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ordered = [...PROGRAMS].sort((a, b) => Number(b.level === level) - Number(a.level === level));
  const use = (p: Program) =>
    void attempt(async () => {
      await saveRoutine(
        { title: p.title, level: p.level, perWeek: p.perWeek, days: p.days, programKey: p.programKey },
        { active: true },
      );
      toast(`“${p.title}” is your routine now`);
      onPicked();
      onClose();
    });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Programs"
      description="Pick your level for a recommendation."
    >
      <div role="radiogroup" aria-label="Your level" className="mb-5 grid grid-cols-2 gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={level === l.value}
            onClick={() => void attempt(() => updateProfileSettings({ fitnessLevel: l.value }))}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left',
              level === l.value ? 'border-fg bg-surface-2' : 'border-line hover:border-fg/40',
            )}
          >
            <div className="text-sm font-medium">{l.label}</div>
            <div className="text-muted text-xs">{l.who}</div>
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {ordered.map((p) => (
          <li key={p.programKey} className="border-line rounded-2xl border p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.level === level && (
                    <span className="bg-sec-self/20 text-sec-self rounded-full px-2 py-0.5 text-[11px] font-medium">
                      Recommended for you
                    </span>
                  )}
                </div>
                <p className="text-muted mt-0.5 text-sm">
                  {LEVELS.find((l) => l.value === p.level)?.label}. {p.summary}
                </p>
              </div>
            </div>
            {open === p.programKey && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {p.days.map((d) => (
                  <div key={d.name}>
                    <div className="text-sm font-medium">{d.name}</div>
                    <ul className="text-muted text-[13px]">
                      {d.exercises.map((e) => (
                        <li key={e.name}>
                          {e.name} · {e.cardio ? `${e.minutes} min` : `${e.sets} × ${e.reps}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={p.level === level ? 'primary' : 'secondary'}
                onClick={() => use(p)}
                aria-label={`Use ${p.title}`}
              >
                Use this routine
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(open === p.programKey ? null : p.programKey)}
              >
                {open === p.programKey ? 'Hide days' : 'See the days'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

const blankDay = (n: number) => ({ name: `Day ${n}`, exercises: [] as RoutineExercise[] });

/** Create or edit a routine: named days, each a list of exercises (sets × reps) or cardio minutes. */
function RoutineSheet({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const [title, setTitle] = useState(routine?.title ?? '');
  const [perWeek, setPerWeek] = useState(routine?.perWeek ?? 3);
  const [days, setDays] = useState(routine?.days ?? [blankDay(1)]);
  const setDay = (i: number, d: (typeof days)[number]) => setDays(days.map((x, j) => (j === i ? d : x)));

  const save = () =>
    void attempt(async () => {
      const clean = days.map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.name.trim()) }));
      await saveRoutine(
        { title, perWeek, days: clean, level: routine?.level, programKey: routine?.programKey },
        { id: routine?.id, active: routine ? undefined : true },
      );
      onClose();
    });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={routine ? 'Edit routine' : 'New routine'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Routine" htmlFor="r-title">
          <Input
            id="r-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My push/pull"
          />
        </Field>
        <Field label="Days a week" htmlFor="r-week">
          <Input
            id="r-week"
            type="number"
            min={1}
            max={7}
            value={perWeek}
            onChange={(e) => setPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>
      <div className="space-y-4">
        {days.map((d, i) => (
          <fieldset key={i} className="border-line rounded-2xl border p-3">
            <legend className="sr-only">Day {i + 1}</legend>
            <div className="mb-2 flex items-center gap-2">
              <Input
                aria-label={`Day ${i + 1} name`}
                value={d.name}
                onChange={(e) => setDay(i, { ...d, name: e.target.value })}
                className="font-medium"
              />
              {days.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => setDays(days.filter((_, j) => j !== i))}
                >
                  <Trash className="size-4" />
                </Button>
              )}
            </div>
            <ul className="space-y-1.5">
              {d.exercises.map((e, k) => {
                const setEx = (next: RoutineExercise) =>
                  setDay(i, { ...d, exercises: d.exercises.map((x, j) => (j === k ? next : x)) });
                return (
                  <li key={k} className="grid grid-cols-[1fr_3.5rem_4.5rem_2.5rem] items-center gap-1.5">
                    <Input
                      aria-label={`Day ${i + 1} exercise ${k + 1}`}
                      value={e.name}
                      onChange={(ev) => setEx({ ...e, name: ev.target.value })}
                      placeholder={e.cardio ? 'e.g. Running' : 'e.g. Bench press'}
                    />
                    {e.cardio ? (
                      <>
                        <span className="text-muted text-center text-xs">cardio</span>
                        <Input
                          aria-label={`Day ${i + 1} exercise ${k + 1} minutes`}
                          type="number"
                          min={1}
                          value={e.minutes ?? ''}
                          onChange={(ev) => {
                            const m = Number(ev.target.value) || 0;
                            setEx({ ...e, minutes: m, reps: `${m} min` });
                          }}
                          placeholder="min"
                        />
                      </>
                    ) : (
                      <>
                        <Input
                          aria-label={`Day ${i + 1} exercise ${k + 1} sets`}
                          type="number"
                          min={1}
                          value={e.sets}
                          onChange={(ev) => setEx({ ...e, sets: Math.max(1, Number(ev.target.value) || 1) })}
                        />
                        <Input
                          aria-label={`Day ${i + 1} exercise ${k + 1} reps`}
                          value={e.reps}
                          onChange={(ev) => setEx({ ...e, reps: ev.target.value })}
                          placeholder="8-12"
                        />
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${e.name || 'exercise'}`}
                      onClick={() => setDay(i, { ...d, exercises: d.exercises.filter((_, j) => j !== k) })}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDay(i, { ...d, exercises: [...d.exercises, { name: '', sets: 3, reps: '8-12' }] })
                }
              >
                <Plus className="size-4" /> Exercise
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDay(i, {
                    ...d,
                    exercises: [
                      ...d.exercises,
                      { name: '', sets: 1, reps: '20 min', cardio: true, minutes: 20 },
                    ],
                  })
                }
              >
                <Plus className="size-4" /> Cardio
              </Button>
            </div>
          </fieldset>
        ))}
      </div>
      <Button className="mt-3" variant="ghost" onClick={() => setDays([...days, blankDay(days.length + 1)])}>
        <Plus className="size-4" /> Add a day
      </Button>
    </Sheet>
  );
}
