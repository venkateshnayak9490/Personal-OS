import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  ChevronDown,
  Dumbbell,
  Ellipsis,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Star,
  Trash,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Menu } from '@/components/Menu';
import { Card } from '@/components/PageHeader';
import { Confirm, Sheet } from '@/components/Sheet';
import {
  Badge,
  BlockHeader,
  Button,
  Field,
  Input,
  Select,
  SaveHint,
  Segmented,
  StatusMark,
  type Mark,
} from '@/components/ui';
import { useHabitLogs, useHabits, useProfile, useRoutines, useWorkouts, useWorkoutSets } from '@/core/hooks';
import { setHabitLog } from '@/core/repos/plans';
import { SkipReasonSheet } from '@/features/habits/habit-ui';
import {
  cardioTotals,
  exerciseKey,
  isFinished,
  LEVELS,
  PROGRAMS,
  plannedOn,
  todaysDayIndex,
  weekDates,
  weekPlan,
  WEEKDAYS,
  weekdayOrder,
  type Program,
} from '@/core/domain/fitness';
import { logsByDate } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
import type { FitnessLevel, Routine, RoutineExercise } from '@/core/domain/types';
import { updateProfileSettings } from '@/core/repos/profile';
import {
  deleteRoutine,
  endWorkout,
  followRoutineForWeek,
  changeWeek,
  resetWeek,
  startWorkout,
  restoreRoutine,
  saveRoutine,
  setActiveRoutine,
  setRoutinePaused,
} from '@/core/repos/life';
import { GymConsistency } from './GymConsistency';
import { cn } from '@/lib/cn';
import { RoutineWeekEditor } from './RoutineWeekEditor';
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
  const [toWeekdays, setToWeekdays] = useState(false);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [pickDay, setPickDay] = useState<number | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [showRoutines, setShowRoutines] = useState(false);
  const habits = useHabits();
  // Eight days back covers this week's marks (skipped days) as well as today's log.
  const habitLogs = useHabitLogs(toLocalDate(now - 8 * 86_400_000, profile?.timezone));
  if (!routines || !workouts || !sets) return null;

  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const today = toLocalDate(now, profile?.timezone);
  const active = routines.find((r) => r.active);
  // Weekday routines: what's planned on a date, this week's own changes included.
  const planOf = (d: string) => (active?.byWeekday ? plannedOn(active, routines, d) : undefined);
  const todayPlan = planOf(today);
  const todays = active ? (todayPlan ? todayPlan.dayIndex : todaysDayIndex(active, workouts, today)) : 0;
  const dayIndex = active ? (pickDay ?? todays) : 0;
  // The routine today's workout comes from (another one, if this week follows it).
  const from = pickDay === null && todayPlan?.routine ? todayPlan.routine : active;
  const restDay = !!active && dayIndex < 0;
  const day = from && dayIndex >= 0 ? from.days[dayIndex % from.days.length] : undefined;
  // The next training day after a rest day (weekday routines).
  const nextUp = restDay
    ? [1, 2, 3, 4, 5, 6]
        .map((k) => {
          const d = format(addDays(parseISO(today), k), 'yyyy-MM-dd');
          const p = planOf(d);
          return p?.routine
            ? { name: p.routine.days[p.dayIndex]!.name, weekday: parseISO(d).getDay() }
            : undefined;
        })
        .find(Boolean)
    : undefined;
  const isPlanned = (d: string) => !!planOf(d)?.routine;
  const gymHabit =
    habits?.find((h) => h.source === 'gym') ?? habits?.find((h) => /^gym\b/i.test(h.title.trim()));
  const paused = !!active?.paused;
  const gymLog = gymHabit ? logsByDate(habitLogs ?? [], gymHabit.id).get(today) : undefined;
  const weekStart = startOfWeek(parseISO(today), { weekStartsOn });
  const week = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  // Days you said you'd skip (the Gym habit's log), for this week's marks.
  const gymLogs = gymHabit ? logsByDate(habitLogs ?? [], gymHabit.id) : undefined;
  // Trained = a finished workout, or the Gym habit ticked on Habits (one answer on every screen).
  const trained = new Set([
    ...workouts.filter(isFinished).map((w) => w.date),
    ...[...(gymLogs ?? [])].filter(([, l]) => l.status === 'done').map(([d]) => d),
  ]);
  const inProgress = workouts.find((w) => w.date === today && !isFinished(w));
  const doneThisWeek = week.filter((d) => trained.has(d)).length;
  const cardio = cardioTotals(sets, workouts, week[0]!, week[6]!);
  const doneToday = active && workouts.some((w) => w.date === today && isFinished(w));
  // This week's target: the planned days (rest days don't count), or the routine's N a week.
  const weekTarget = active?.byWeekday ? week.filter(isPlanned).length : active?.perWeek;

  const start = (from?: { routine: Routine; dayIndex: number }) =>
    void attempt(async () => {
      const w = await startWorkout(
        today,
        nodeId,
        from ? from.routine.days[from.dayIndex]!.name : 'Workout',
        from ? { routineId: from.routine.id, dayIndex: from.dayIndex } : undefined,
      );
      navigate(workoutPath(w.id));
    });

  const skippedOn = (d: string) => gymLogs?.get(d)?.status === 'skipped';
  // This week's count and cardio, shown beside the week.
  const summary = (
    <span className="flex flex-wrap items-baseline justify-end gap-x-2 tabular-nums">
      <span className="text-fg font-medium">
        {doneThisWeek}
        {weekTarget !== undefined ? ` of ${weekTarget}` : ''} workouts
      </span>
      {cardio.minutes > 0 && (
        <span>
          Cardio {cardio.minutes} min{cardio.km ? ` · ${cardio.km} km` : ''}
        </span>
      )}
    </span>
  );
  const dayOptions = active?.days.map((d, i) => (
    <option key={i} value={i}>
      {d.weekday !== undefined ? `${WEEKDAYS[d.weekday]}: ` : ''}
      {d.name}
    </option>
  ));

  return (
    <section aria-label="Gym" className="mb-10 space-y-8">
      {/* 1. Today's workout */}
      <Card className="md:p-5">
        {inProgress && (
          <div className="border-line mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
            <span className="min-w-0 flex-1 text-[15px] md:text-sm">
              <span className="font-medium">{inProgress.title}</span> in progress
              {inProgress.startedAt ? ` since ${format(inProgress.startedAt, 'HH:mm')}` : ''}
            </span>
            <Button onClick={() => navigate(workoutPath(inProgress.id))}>Continue</Button>
            <Button
              variant="primary"
              onClick={() =>
                void attempt(async () => {
                  await endWorkout(inProgress.id);
                  toast('Workout finished');
                })
              }
            >
              End workout
            </Button>
          </div>
        )}
        <p className="text-meta text-muted">{doneToday ? 'Done today. Next up' : 'Today’s workout'}</p>
        {paused ? (
          <>
            <h2 className="title-page mt-1">Routine paused</h2>
            <p className="text-muted mt-1 text-[15px] md:text-sm">
              {active!.title}: no workouts due and no reminders until you resume it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={inProgress ? 'secondary' : 'primary'}
                onClick={() => void attempt(() => setRoutinePaused(active!.id, false))}
              >
                <Play className="size-4" /> Resume
              </Button>
              <Button variant="ghost" onClick={() => start()}>
                Free workout
              </Button>
            </div>
          </>
        ) : restDay ? (
          <>
            <h2 className="title-page mt-1">Rest day</h2>
            <p className="text-muted mt-1 text-[15px] md:text-sm">
              {active.title}
              {todayPlan?.changed ? ' · changed this week' : ''}
              {nextUp ? ` · next: ${WEEKDAYS[nextUp.weekday!]}, ${nextUp.name}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Select
                aria-label="Do a different day"
                value=""
                onChange={(e) => e.target.value && setPickDay(Number(e.target.value))}
                className="w-auto max-w-full"
              >
                <option value="">Train anyway…</option>
                {dayOptions}
              </Select>
              <Button variant="ghost" onClick={() => start()}>
                Free workout
              </Button>
            </div>
          </>
        ) : active && from && day ? (
          <>
            <h2 className="title-page mt-1">{day.name}</h2>
            <p className="text-muted mt-1 text-[15px] md:text-sm">
              {from.title} ·{' '}
              {active.byWeekday
                ? `${WEEKDAYS[pickDay === null ? parseISO(today).getDay() : (day.weekday ?? 0)]}${todayPlan?.changed && pickDay === null ? ' (changed this week)' : ''}`
                : `day ${dayIndex + 1} of ${active.days.length}`}{' '}
              · about {minutesOf(day)} min
            </p>
            {day.exercises.length > 0 && (
              <ul className="mt-3 grid gap-x-6 text-[15px] md:grid-cols-2 md:text-sm">
                {day.exercises.map((e) => (
                  <li key={e.name} className="border-line flex justify-between gap-3 border-b py-1.5">
                    <span className="min-w-0 truncate">{e.name}</span>
                    <span className="text-muted shrink-0 tabular-nums">
                      {e.cardio ? `${e.minutes} min` : `${e.sets}×${e.reps}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                // Done for today: the next workout is still offered, but no longer as the main action.
                variant={inProgress || doneToday ? 'secondary' : 'primary'}
                onClick={() => start({ routine: from, dayIndex })}
              >
                <Play className="size-4" /> Start {day.name}
              </Button>
              {active.days.length > 1 && (
                <Select
                  aria-label="Do a different day"
                  value={from === active ? dayIndex : ''}
                  onChange={(e) => setPickDay(Number(e.target.value))}
                  className="w-auto max-w-full"
                >
                  {from !== active && <option value="">{day.name} (this week)</option>}
                  {dayOptions}
                </Select>
              )}
              <Button variant="ghost" onClick={() => start()}>
                Free workout
              </Button>
              {gymHabit && pickDay === null && !doneToday && !gymLog && (
                <Button variant="ghost" onClick={() => setSkipping(true)}>
                  Skip today
                </Button>
              )}
              {gymLog?.status === 'skipped' && (
                <span className="text-muted inline-flex items-center gap-1.5 text-[15px] md:text-sm">
                  <StatusMark mark="skipped" />
                  <span>Skipped today: {gymLog.note ?? 'no reason given'}</span>
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="title-page mt-1">Pick a routine</h2>
            <p className="text-muted mt-1 text-[15px] md:text-sm">
              Choose a program for your level and the app tells you what to do each day.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant={inProgress ? 'secondary' : 'primary'} onClick={() => setBrowsing(true)}>
                <Star className="size-4" /> Choose a routine
              </Button>
              <Button variant="ghost" onClick={() => start()}>
                <Dumbbell className="size-4" /> Log a free workout
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* 2. The week: the weekday schedule with its marks, or (routines in order) the week's register. */}
      {active?.byWeekday ? (
        <WeekSchedule
          routine={active}
          routines={routines}
          today={today}
          trained={trained}
          skippedOn={skippedOn}
          summary={summary}
          onEdit={() => setEditing(active)}
        />
      ) : (
        <section aria-labelledby="gym-week">
          <BlockHeader id="gym-week" title="This week" action={summary} />
          <ol className="flex gap-1.5" aria-label="This week">
            {week.map((d) => {
              const mark: Mark = trained.has(d)
                ? 'done'
                : skippedOn(d)
                  ? 'skipped'
                  : isPlanned(d) && d < today
                    ? 'missed'
                    : isPlanned(d) && d === today
                      ? 'due'
                      : 'none';
              return (
                <li
                  key={d}
                  aria-label={`${format(parseISO(d), 'EEEE')}: ${mark === 'done' ? 'trained' : mark === 'skipped' ? 'skipped' : mark === 'missed' ? 'missed' : isPlanned(d) ? 'training day' : 'no workout'}`}
                  className="flex w-10 flex-col items-center gap-1"
                >
                  <span className={cn('text-meta', d === today ? 'text-fg font-bold' : 'text-muted')}>
                    {format(parseISO(d), 'EEEEE')}
                  </span>
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-sm border',
                      d === today ? 'border-fg' : 'border-line-strong',
                    )}
                  >
                    <StatusMark mark={mark} />
                  </span>
                </li>
              );
            })}
          </ol>
          {active && (
            <div className="border-line mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
              <span className="text-meta text-muted min-w-0 flex-1">
                This routine goes in order (day 1, 2, …) with no fixed weekdays.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setToWeekdays(true);
                  setEditing(active);
                }}
              >
                Assign to weekdays
              </Button>
            </div>
          )}
        </section>
      )}

      {/* 3. Consistency */}
      {gymHabit && (
        <GymConsistency habit={gymHabit} routine={active} today={today} weekStartsOn={weekStartsOn} />
      )}

      {/* 4. Recent workouts */}
      <RecentWorkouts />

      {/* 5. Routines, collapsed: Programs and Create stay in the header. */}
      <section aria-labelledby="gym-routines">
        <BlockHeader
          id="gym-routines"
          title="Your routines"
          count={routines.length}
          action={
            <>
              <Button size="sm" variant="ghost" onClick={() => setBrowsing(true)}>
                <Star className="size-4" /> Programs
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
                <Plus className="size-4" /> Create
              </Button>
              {routines.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={showRoutines}
                  aria-controls="gym-routine-list"
                  aria-label={showRoutines ? 'Hide routines' : 'Show routines'}
                  onClick={() => setShowRoutines(!showRoutines)}
                >
                  {showRoutines ? 'Hide' : 'Show'}
                  <ChevronDown className={cn('size-4 transition-transform', showRoutines && 'rotate-180')} />
                </Button>
              )}
            </>
          }
        />
        {routines.length === 0 ? (
          <p className="text-muted text-[15px] md:text-sm">
            None yet. Pick a program for your level, or create your own routine.
          </p>
        ) : !showRoutines ? (
          <p className="text-meta text-muted">
            {active ? `Active: ${active.title}${active.paused ? ' (paused)' : ''}` : 'No active routine'}
          </p>
        ) : (
          <ul id="gym-routine-list" className="divide-line divide-y">
            {routines.map((r) => (
              <li key={r.id} className="flex min-h-14 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium md:text-sm">
                    <span className="truncate">{r.title}</span>
                    {r.active && <Badge>Active</Badge>}
                    {r.paused && <Badge>Paused</Badge>}
                  </div>
                  <div className="text-meta text-muted truncate">
                    {r.level ? `${LEVELS.find((l) => l.value === r.level)?.label} · ` : ''}
                    {r.byWeekday
                      ? weekPlan(r)
                      : `${r.perWeek}× a week · ${r.days.map((d) => d.name).join(', ')}`}
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
                            label: 'Make active from today',
                            icon: Star,
                            onSelect: () => {
                              setPickDay(null);
                              void attempt(async () => {
                                await setActiveRoutine(r.id);
                                toast(
                                  `“${r.title}” is your routine from today. Past workouts keep their history.`,
                                );
                              });
                            },
                          },
                          ...(active?.byWeekday && !active.paused
                            ? [
                                {
                                  label: 'Follow this week only',
                                  icon: Repeat,
                                  onSelect: () =>
                                    void attempt(async () => {
                                      await followRoutineForWeek(active.id, r.id, today);
                                      toast(
                                        `Following “${r.title}” this week; “${active.title}” stays your routine`,
                                      );
                                    }),
                                },
                              ]
                            : []),
                        ]
                      : []),
                    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(r) },
                    r.paused
                      ? {
                          label: 'Resume',
                          icon: Play,
                          onSelect: () => void attempt(() => setRoutinePaused(r.id, false)),
                        }
                      : {
                          label: 'Pause',
                          icon: Pause,
                          onSelect: () => void attempt(() => setRoutinePaused(r.id, true)),
                        },
                    null,
                    {
                      label: 'Delete…',
                      icon: Trash,
                      danger: true,
                      onSelect: () => setDeleting(r),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {browsing && (
        <ProgramsSheet
          level={profile?.settings.fitnessLevel as FitnessLevel | undefined}
          onClose={() => setBrowsing(false)}
          onPicked={() => setPickDay(null)}
        />
      )}
      {skipping && gymHabit && (
        <SkipReasonSheet
          habit={gymHabit}
          dayLabel="Today"
          planned={day?.name}
          optional
          onSkip={(reason) =>
            void attempt(() =>
              setHabitLog(gymHabit.id, today, 'skipped', reason || undefined, { planned: day?.name }),
            )
          }
          onClose={() => setSkipping(false)}
        />
      )}
      {editing && (
        <RoutineSheet
          routine={editing === 'new' ? undefined : editing}
          weekdays={toWeekdays}
          onClose={() => {
            setEditing(null);
            setToWeekdays(false);
          }}
        />
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ''}”?`}
        description={
          deleting?.active
            ? 'It’s your active routine: no workouts will be due until you pick another. Past workouts and your Gym history stay. You can undo or restore it from Trash.'
            : 'Past workouts stay. You can undo or restore it from Trash.'
        }
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => {
          const r = deleting!;
          setDeleting(null);
          void attempt(async () => {
            const b = await deleteRoutine(r.id);
            if (b) toast(`Moved “${r.title}” to Trash`, () => restoreRoutine(b, r.id));
          });
        }}
      />
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
        {
          title: p.title,
          level: p.level,
          perWeek: p.perWeek,
          days: p.days,
          programKey: p.programKey,
          byWeekday: p.byWeekday,
        },
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
              'min-h-11 rounded-md border px-3 py-2.5 text-left',
              level === l.value ? 'border-fg bg-surface-2' : 'border-line hover:border-fg/40',
            )}
          >
            <div className="text-sm font-medium">{l.label}</div>
            <div className="text-muted text-xs">{l.who}</div>
          </button>
        ))}
      </div>
      <ul className="divide-line border-line divide-y border-y">
        {ordered.map((p) => (
          <li key={p.programKey} className="py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  {p.level === level && <Badge>Recommended for you</Badge>}
                </div>
                <p className="text-muted mt-0.5 text-sm">
                  {LEVELS.find((l) => l.value === p.level)?.label}. {p.summary}
                </p>
              </div>
            </div>
            {open === p.programKey && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {programDays(p).map((d) => (
                  <div key={d.key}>
                    <div className={cn('text-sm font-medium', !d.exercises.length && 'text-muted')}>
                      {d.name}
                    </div>
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
function RoutineSheet({
  routine,
  weekdays,
  onClose,
}: {
  routine?: Routine;
  /** Open with fixed weekdays switched on (each day gets Mon, Tue, … in order). */
  weekdays?: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(routine?.title ?? '');
  const [perWeek, setPerWeek] = useState(routine?.perWeek ?? 3);
  const [days, setDays] = useState<Routine['days']>(() => {
    const d: Routine['days'] = routine?.days ?? [blankDay(1)];
    return weekdays ? d.map((x, i) => ({ ...x, weekday: x.weekday ?? (i + 1) % 7 })) : d;
  });
  const [byWeekday, setByWeekday] = useState(weekdays || (routine?.byWeekday ?? false));
  const setDay = (i: number, d: (typeof days)[number]) => setDays(days.map((x, j) => (j === i ? d : x)));

  const save = () =>
    void attempt(async () => {
      const clean = days.map((d) => ({ ...d, exercises: d.exercises.filter((e) => e.name.trim()) }));
      await saveRoutine(
        {
          title,
          perWeek: byWeekday ? clean.length : perWeek,
          days: clean,
          level: routine?.level,
          programKey: routine?.programKey,
          byWeekday,
        },
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
          <SaveHint>{!title.trim() && 'Give it a name'}</SaveHint>
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
            // With fixed weekdays the count is the week you build (rest days don't count).
            value={byWeekday ? days.filter((d) => d.weekday !== undefined).length : perWeek}
            readOnly={byWeekday}
            aria-describedby={byWeekday ? 'r-week-hint' : undefined}
            onChange={(e) => setPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
          />
          {byWeekday && (
            <span id="r-week-hint" className="text-muted text-xs">
              From the days below
            </span>
          )}
        </Field>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={byWeekday}
          onChange={(e) => {
            setByWeekday(e.target.checked);
            // Turning weekdays on: give each day a weekday in order (Mon, Tue, …).
            if (e.target.checked) setDays(days.map((d, i) => ({ ...d, weekday: d.weekday ?? (i + 1) % 7 })));
          }}
          className="accent-[var(--fg)]"
        />
        Fixed weekdays (e.g. Monday: chest, triceps, shoulders). Your Gym habit follows these days.
      </label>
      {byWeekday ? (
        <RoutineWeekEditor days={days} onChange={setDays} />
      ) : (
        <>
          <div className="space-y-4">
            {days.map((d, i) => (
              <fieldset key={i} className="border-line rounded-md border p-3">
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
                              onChange={(ev) =>
                                setEx({ ...e, sets: Math.max(1, Number(ev.target.value) || 1) })
                              }
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
                          onClick={() =>
                            setDay(i, { ...d, exercises: d.exercises.filter((_, j) => j !== k) })
                          }
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
          <Button
            className="mt-3"
            variant="ghost"
            onClick={() => setDays([...days, blankDay(days.length + 1)])}
          >
            <Plus className="size-4" /> Add a day
          </Button>
        </>
      )}
    </Sheet>
  );
}

/** A program's days for "See the days": weekday programs go Mon to Sun, with rest days shown. */
function programDays(p: Program) {
  if (!p.byWeekday) return p.days.map((d) => ({ ...d, key: d.name }));
  return weekdayOrder(1).map((wd) => {
    const d = p.days.find((x) => x.weekday === wd);
    return d
      ? { ...d, key: String(wd), name: `${WEEKDAYS[wd]}: ${d.name}` }
      : { key: String(wd), name: `${WEEKDAYS[wd]}: Rest`, exercises: [] };
  });
}

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const slotKey = (routineId: string, dayIndex: number) => `${routineId}:${dayIndex}`;

/**
 * The active weekday routine, Monday to Sunday: each day's workout (with muscles) or Rest, today
 * highlighted. Changes go to **this week (or next) only**, leaving the routine as it is, or to
 * **every week** (the routine itself). Days already gone can't be changed.
 */
function WeekSchedule({
  routine,
  routines,
  today,
  trained,
  skippedOn,
  summary,
  onEdit,
}: {
  routine: Routine;
  routines: Routine[];
  today: string;
  /** Dates with a finished workout. */
  trained: Set<string>;
  /** Dates the Gym habit was skipped. */
  skippedOn: (date: string) => boolean;
  /** This week's count (and cardio). */
  summary: ReactNode;
  onEdit: () => void;
}) {
  const [scope, setScope] = useState<'week' | 'always'>('week');
  const [weekOf, setWeekOf] = useState(today);
  const nextWeek = format(addDays(parseISO(today), 7), 'yyyy-MM-dd');
  const shownWeek = weekOf === today ? today : nextWeek;
  const dates = weekDates(shownWeek);
  const changedWeek = !!routine.weeks?.[dates[0]!];
  const others = routines.filter((r) => r.id !== routine.id && !r.deletedAt);
  // The routine's distinct workouts (a workout on two weekdays is listed once).
  const choices = new Map<string, { key: string; name: string }>();
  routine.days.forEach((d, i) => {
    if (!choices.has(exerciseKey(d.name)))
      choices.set(exerciseKey(d.name), { key: slotKey(routine.id, i), name: d.name });
  });
  const slotOf = (key: string) => {
    const [routineId, dayIndex] = key.split(':');
    return { routineId: routineId!, dayIndex: Number(dayIndex) };
  };

  const assignAlways = (wd: number, key: string) =>
    void attempt(async () => {
      const others = routine.days.filter((d) => d.weekday !== wd);
      const pick = key === 'rest' ? undefined : routine.days[slotOf(key).dayIndex];
      const days = pick
        ? [...others, { ...pick, exercises: pick.exercises.map((e) => ({ ...e })), weekday: wd }]
        : others;
      if (!days.length) throw new Error('Keep at least one workout day, or pause the routine instead');
      days.sort((a, b) => ((a.weekday! + 6) % 7) - ((b.weekday! + 6) % 7));
      await saveRoutine(
        { title: routine.title, perWeek: days.length, days, byWeekday: true },
        { id: routine.id },
      );
      toast(`${LONG_DAYS[wd]} changed for every week`);
    });
  const assignWeek = (wd: number, date: string, key: string) =>
    void attempt(() =>
      changeWeek(routine.id, date, {
        [wd]: key === 'rest' ? null : key === 'plan' ? undefined : slotOf(key),
      }),
    );

  const rows = MON_FIRST.map((wd, i) => {
    const date = dates[i]!;
    const p =
      scope === 'week'
        ? plannedOn(routine, routines, date)
        : (() => {
            const k = routine.days.findIndex((d) => d.weekday === wd);
            return { routine: k >= 0 ? routine : undefined, dayIndex: k, changed: false };
          })();
    const d = p.routine?.days[p.dayIndex];
    const known = d && choices.get(exerciseKey(d.name));
    const value = !d
      ? 'rest'
      : known && p.routine === routine
        ? known.key
        : slotKey(p.routine!.id, p.dayIndex);
    return {
      wd,
      date,
      d,
      p,
      value,
      extra: d && value !== known?.key ? { key: value, name: `${d.name} (${p.routine!.title})` } : undefined,
    };
  });
  const training = rows.filter((r) => r.d).length;

  return (
    <section aria-labelledby="gym-week">
      <BlockHeader
        id="gym-week"
        title="Weekly schedule"
        action={
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="size-4" /> Edit workouts
          </Button>
        }
      />
      <div className="text-meta text-muted mb-3">{summary}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Apply changes to"
          options={[
            { value: 'week' as const, label: 'One week only' },
            { value: 'always' as const, label: 'Every week' },
          ]}
          value={scope}
          onChange={setScope}
        />
        {scope === 'week' && (
          <Select
            aria-label="Week"
            value={weekOf === today ? 'this' : 'next'}
            onChange={(e) => setWeekOf(e.target.value === 'this' ? today : nextWeek)}
            className="w-auto"
          >
            <option value="this">This week</option>
            <option value="next">Next week</option>
          </Select>
        )}
      </div>
      <p className="text-meta text-muted mb-3">
        {scope === 'week'
          ? `${format(parseISO(dates[0]!), 'd MMM')}–${format(parseISO(dates[6]!), 'd MMM')} only: “${routine.title}” stays as it is for other weeks.`
          : `Changes “${routine.title}” for every week from today. Past weeks keep their history.`}{' '}
        {training} workout day{training === 1 ? '' : 's'}, {7 - training} rest day
        {7 - training === 1 ? '' : 's'}.
      </p>
      <ul aria-label="Weekly schedule" className="border-line divide-line divide-y border-y">
        {rows.map(({ wd, date, d, p, value, extra }) => {
          const isToday = scope === 'week' ? date === today : wd === parseISO(today).getDay();
          const gone = scope === 'week' && date < today;
          // The register mark: planned vs done, readable without colour. "Every week" shows rest days only.
          const mark: Mark =
            scope === 'week' && trained.has(date)
              ? 'done'
              : scope === 'week' && skippedOn(date)
                ? 'skipped'
                : !d
                  ? 'rest'
                  : scope !== 'week' || date > today
                    ? 'none'
                    : date < today
                      ? 'missed'
                      : 'due';
          return (
            <li
              key={wd}
              aria-label={`${LONG_DAYS[wd]}: ${d ? d.name : 'Rest'}${isToday ? ' (today)' : ''}${p.changed ? ' (changed this week)' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                // Phone: the picker (which shows the workout) gets its own row; desktop: one row.
                'grid grid-cols-[1.75rem_2.5rem_1fr] items-center gap-x-3 gap-y-1.5 px-2 py-2.5 md:grid-cols-[1.75rem_2.5rem_1fr_auto]',
                isToday && 'bg-surface-2/70',
              )}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-sm border',
                  isToday ? 'border-fg' : 'border-line-strong',
                )}
              >
                <StatusMark mark={mark} />
              </span>
              <span className={cn('text-sm', isToday ? 'font-semibold' : 'text-muted')}>
                {WEEKDAYS[wd]}
                {scope === 'week' && (
                  <span className="text-muted block text-[11px] font-normal">
                    {format(parseISO(date), 'd MMM')}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <div className={cn('flex items-center gap-2 text-sm', !d && 'text-muted')}>
                  <span className="hidden truncate font-medium md:inline">{d ? d.name : 'Rest'}</span>
                  {!d && <span className="md:hidden">Rest day</span>}
                  {isToday && <Badge>Today</Badge>}
                  {p.changed && <Badge tone="warning">This week</Badge>}
                </div>
                {d && (
                  <div className="text-meta text-muted truncate">
                    {d.muscles?.length
                      ? d.muscles.join(', ')
                      : `${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'}`}
                  </div>
                )}
              </div>
              <Select
                aria-label={`${WEEKDAYS[wd]} workout`}
                value={value}
                disabled={gone}
                onChange={(e) =>
                  scope === 'week' ? assignWeek(wd, date, e.target.value) : assignAlways(wd, e.target.value)
                }
                className="col-start-3 w-full md:col-start-auto md:w-auto md:max-w-[12rem]"
              >
                <option value="rest">Rest</option>
                {[...choices.values()].map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
                {extra && <option value={extra.key}>{extra.name}</option>}
                {scope === 'week' && p.changed && <option value="plan">As in the routine</option>}
              </Select>
            </li>
          );
        })}
      </ul>
      {scope === 'week' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {others.length > 0 && (
            <Select
              aria-label="Follow another routine for this week"
              value=""
              onChange={(e) =>
                e.target.value &&
                void attempt(async () => {
                  await followRoutineForWeek(routine.id, e.target.value, shownWeek);
                  toast(
                    `Following “${others.find((r) => r.id === e.target.value)?.title}” for that week only`,
                  );
                })
              }
              className="w-auto"
            >
              <option value="">Follow another routine that week…</option>
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          )}
          {changedWeek && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void attempt(() => resetWeek(routine.id, shownWeek))}
            >
              Back to “{routine.title}”
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
