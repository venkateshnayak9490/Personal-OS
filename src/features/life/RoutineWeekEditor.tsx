import { ArrowDown, ArrowUp, Moon, Plus, X } from 'lucide-react';
import { Button, Input, Select, StatusMark } from '@/components/ui';
import { WEEKDAYS } from '@/core/domain/fitness';
import type { Routine, RoutineExercise } from '@/core/domain/types';
import { cn } from '@/lib/cn';

type Day = Routine['days'][number];

export const MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Core',
  'Cardio',
  'Full body',
];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

const move = <T,>(xs: T[], i: number, by: number) => {
  const j = i + by;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
};

/**
 * A weekly routine, one row per weekday: a workout (muscle groups, exercises with sets, reps and target
 * weight, or cardio) or an explicit rest day. A day can be copied or moved to another weekday.
 */
export function RoutineWeekEditor({ days, onChange }: { days: Day[]; onChange: (days: Day[]) => void }) {
  const at = (w: number) => days.find((d) => d.weekday === w);
  const put = (w: number, d: Day | null) =>
    onChange([...days.filter((x) => x.weekday !== w), ...(d ? [{ ...d, weekday: w }] : [])]);

  return (
    <ol className="border-line divide-line divide-y border-y" aria-label="Week">
      {WEEK.map((w) => {
        const d = at(w);
        const label = WEEKDAYS[w]!;
        if (!d)
          return (
            <li key={w} className="flex items-center gap-3 py-2">
              <span className="w-10 font-semibold">{label}</span>
              <StatusMark mark="rest" className="w-4" />
              <span className="text-muted flex-1 text-sm">Rest day</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Add a workout on ${label}`}
                onClick={() => put(w, { name: 'Workout', exercises: [], muscles: [] })}
              >
                <Plus className="size-4" /> Workout
              </Button>
            </li>
          );
        const setEx = (k: number, e: RoutineExercise) =>
          put(w, { ...d, exercises: d.exercises.map((x, j) => (j === k ? e : x)) });
        return (
          <li key={w} className="py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="w-10 font-semibold">{label}</span>
              <Input
                aria-label={`${label} workout name`}
                value={d.name}
                onChange={(e) => put(w, { ...d, name: e.target.value })}
                className="min-w-40 flex-1 font-medium"
              />
              <Select
                aria-label={`Copy ${label} to`}
                value=""
                onChange={(e) => e.target.value && put(Number(e.target.value), { ...d })}
                className="w-28"
              >
                <option value="">Copy…</option>
                {WEEK.filter((x) => x !== w).map((x) => (
                  <option key={x} value={x}>
                    {WEEKDAYS[x]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`Move ${label} to`}
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const x = Number(e.target.value);
                  const other = at(x);
                  // Moving onto a planned day swaps the two.
                  onChange([
                    ...days.filter((y) => y.weekday !== w && y.weekday !== x),
                    { ...d, weekday: x },
                    ...(other ? [{ ...other, weekday: w }] : []),
                  ]);
                }}
                className="w-28"
              >
                <option value="">Move…</option>
                {WEEK.filter((x) => x !== w).map((x) => (
                  <option key={x} value={x}>
                    {WEEKDAYS[x]}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Make ${label} a rest day`}
                onClick={() => put(w, null)}
              >
                <Moon className="size-4" /> Rest
              </Button>
            </div>
            <div role="group" aria-label={`${label} muscle groups`} className="mb-2 flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => {
                const on = (d.muscles ?? []).includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      put(w, {
                        ...d,
                        muscles: on ? (d.muscles ?? []).filter((x) => x !== m) : [...(d.muscles ?? []), m],
                      })
                    }
                    className={cn(
                      'min-h-11 rounded-sm border px-2.5 text-[13px] md:min-h-8 md:text-xs',
                      on ? 'border-fg bg-fg text-bg' : 'border-line-strong text-muted hover:text-fg',
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <ul className="space-y-1.5">
              {d.exercises.map((e, k) => (
                <li key={k} className="flex flex-wrap items-center gap-1.5">
                  <Input
                    aria-label={`${label} exercise ${k + 1}`}
                    value={e.name}
                    onChange={(ev) => setEx(k, { ...e, name: ev.target.value })}
                    placeholder={e.cardio ? 'e.g. Running' : 'e.g. Bench press'}
                    className="min-w-32 flex-1"
                  />
                  {e.cardio ? (
                    <Input
                      aria-label={`${label} exercise ${k + 1} minutes`}
                      type="number"
                      min={1}
                      value={e.minutes ?? ''}
                      onChange={(ev) => {
                        const m = Number(ev.target.value) || 0;
                        setEx(k, { ...e, minutes: m, reps: `${m} min` });
                      }}
                      placeholder="min"
                      className="w-20"
                    />
                  ) : (
                    <>
                      <Input
                        aria-label={`${label} exercise ${k + 1} sets`}
                        type="number"
                        min={1}
                        value={e.sets}
                        onChange={(ev) => setEx(k, { ...e, sets: Math.max(1, Number(ev.target.value) || 1) })}
                        className="w-16"
                      />
                      <Input
                        aria-label={`${label} exercise ${k + 1} reps`}
                        value={e.reps}
                        onChange={(ev) => setEx(k, { ...e, reps: ev.target.value })}
                        placeholder="8-12"
                        className="w-20"
                      />
                      <Input
                        aria-label={`${label} exercise ${k + 1} target kg`}
                        type="number"
                        min={0}
                        step="0.5"
                        value={e.weight ?? ''}
                        onChange={(ev) =>
                          setEx(k, { ...e, weight: ev.target.value ? Number(ev.target.value) : undefined })
                        }
                        placeholder="kg"
                        className="w-20"
                      />
                    </>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${e.name || 'exercise'} up`}
                    disabled={k === 0}
                    onClick={() => put(w, { ...d, exercises: move(d.exercises, k, -1) })}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${e.name || 'exercise'} down`}
                    disabled={k === d.exercises.length - 1}
                    onClick={() => put(w, { ...d, exercises: move(d.exercises, k, 1) })}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${e.name || 'exercise'}`}
                    onClick={() => put(w, { ...d, exercises: d.exercises.filter((_, j) => j !== k) })}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Add an exercise on ${label}`}
                onClick={() =>
                  put(w, { ...d, exercises: [...d.exercises, { name: '', sets: 3, reps: '8-12' }] })
                }
              >
                <Plus className="size-4" /> Exercise
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Add cardio on ${label}`}
                onClick={() =>
                  put(w, {
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
          </li>
        );
      })}
    </ol>
  );
}
