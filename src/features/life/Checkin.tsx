import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Minus, Plus, Sun, Utensils } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button, Input } from '@/components/ui';
import { useCheckins, useJournal, useProfile } from '@/core/hooks';
import { toLocalDate } from '@/core/domain/tasks';
import { MEAL_LABEL, MEALS } from '@/core/domain/health';
import type { HealthEvent, Mood } from '@/core/domain/types';
import { addWater, logHealthEvent, setCheckin, undoHealthEvent } from '@/core/repos/life';
import { setMood } from '@/core/repos/notes';
import { MOODS } from '@/pages/JournalPage';
import { cn } from '@/lib/cn';

const ENERGY = ['Drained', 'Low', 'Okay', 'Good', 'Full'];

function Choice<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value?: T;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
          className={cn(
            'h-8 rounded-full border px-3 text-xs font-medium',
            value === o.value ? 'bg-fg text-bg border-transparent' : 'border-line text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Today's check-in: each part optional, saved as you tap. */
export function CheckinCard() {
  const now = useNow();
  const today = toLocalDate(now);
  const checkins = useCheckins(today);
  const journal = useJournal();
  if (!checkins || !journal) return null;
  const c = checkins.find((x) => x.date === today);
  const mood = journal.find((e) => e.date === today)?.mood;
  const save = (v: Parameters<typeof setCheckin>[1]) => void attempt(() => setCheckin(today, v));
  const num = (s: string) => (s === '' ? undefined : Number(s));
  // The same one-tap logs as Health (device time, Undo), so the morning needs one screen.
  const tap = (event: HealthEvent, label: string) =>
    void attempt(async () => {
      const r = await logHealthEvent(event);
      if (r.logged) toast(`${label} at ${r.stamp.time}`, () => undoHealthEvent(r.date, event, r.stamp.at));
    });
  const nextMeal = MEALS.find((m) => !c?.meals?.[m]);

  return (
    <div className="border-line grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
      <div role="group" aria-label="Quick log" className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {c?.wakeTime ? (
          <span className="text-muted text-sm">Up at {c.wakeTime}</span>
        ) : (
          <Button size="sm" onClick={() => tap('wake', 'Woke up')}>
            <Sun className="size-4" /> I’m up
          </Button>
        )}
        {nextMeal && (
          <Button size="sm" onClick={() => tap(nextMeal, MEAL_LABEL[nextMeal])}>
            <Utensils className="size-4" /> Ate {MEAL_LABEL[nextMeal].toLowerCase()}
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="text-muted text-xs">Mood</div>
        <Choice<Mood>
          label="Mood"
          options={MOODS}
          value={mood}
          onChange={(m) => void attempt(() => setMood(today, m))}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-muted text-xs">Energy</div>
        <Choice
          label="Energy"
          options={ENERGY.map((l, i) => ({ value: i + 1, label: l }))}
          value={c?.energy}
          onChange={(energy) => save({ energy })}
        />
      </div>
      {c?.bedTime && c.wakeTime ? (
        // One source: with bed and wake times logged on Health, sleep comes from them.
        <div className="space-y-1.5">
          <div className="text-muted text-xs">Sleep last night</div>
          <p className="text-sm">
            {c.sleepH} h{' '}
            <span className="text-muted text-xs">
              (bed {c.bedTime}, up {c.wakeTime})
            </span>
          </p>
        </div>
      ) : (
        <label className="space-y-1.5">
          <span className="text-muted block text-xs">Sleep last night (hours)</span>
          <Input
            type="number"
            min={0}
            max={24}
            step="0.5"
            key={c?.sleepH ?? ''}
            defaultValue={c?.sleepH ?? ''}
            onBlur={(e) => num(e.target.value) !== c?.sleepH && save({ sleepH: num(e.target.value) })}
            className="w-28"
          />
        </label>
      )}
      <div className="flex gap-6">
        <div className="space-y-1.5">
          <div className="text-muted text-xs">Water (glasses)</div>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="One glass less"
              disabled={!c?.waterGlasses}
              onClick={() => void attempt(() => addWater(today, -1))}
            >
              <Minus className="size-4" />
            </Button>
            <span
              aria-label="Glasses of water"
              className="w-6 text-center text-lg font-semibold tabular-nums"
            >
              {c?.waterGlasses ?? 0}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="One more glass"
              // One water count: the same glasses (with their times) as on Health.
              onClick={() => void attempt(() => addWater(today))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <label className="space-y-1.5">
          <span className="text-muted block text-xs">Weight (kg)</span>
          <Input
            type="number"
            min={0}
            step="0.1"
            key={c?.weightKg ?? ''}
            defaultValue={c?.weightKg ?? ''}
            onBlur={(e) => num(e.target.value) !== c?.weightKg && save({ weightKg: num(e.target.value) })}
            className="w-24"
          />
        </label>
      </div>
    </div>
  );
}

/** Health section: today's check-in and the last two weeks. */
/** Mood, energy, sleep, water and weight, one week at a time (Health). */
export function CheckinHistory() {
  const now = useNow();
  const profile = useProfile();
  const [offset, setOffset] = useState(0);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const start = addWeeks(startOfWeek(new Date(now), { weekStartsOn }), offset);
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  const checkins = useCheckins(days[0]!);
  const journal = useJournal();
  if (!checkins || !journal) return null;
  const today = toLocalDate(now);
  const byDate = new Map(checkins.filter((c) => c.date <= days[6]!).map((c) => [c.date, c]));
  const moodOf = (d: string) => journal.find((e) => e.date === d)?.mood;
  const avg = (xs: (number | undefined)[], digits = 1) => {
    const v = xs.filter((x): x is number => x !== undefined);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(digits) : '—';
  };
  const rows: { label: string; cell: (d: string) => string; summary: string }[] = [
    {
      label: 'Mood',
      cell: (d) => MOODS.find((x) => x.value === moodOf(d))?.label ?? '',
      summary: avg(days.map(moodOf)) === '—' ? '—' : `${avg(days.map(moodOf))} / 5`,
    },
    {
      label: 'Energy',
      cell: (d) => (byDate.get(d)?.energy ? ENERGY[byDate.get(d)!.energy! - 1]! : ''),
      summary:
        avg(days.map((d) => byDate.get(d)?.energy)) === '—'
          ? '—'
          : `${avg(days.map((d) => byDate.get(d)?.energy))} / 5`,
    },
    {
      label: 'Sleep',
      cell: (d) => (byDate.get(d)?.sleepH !== undefined ? `${byDate.get(d)!.sleepH}h` : ''),
      summary: `${avg(days.map((d) => byDate.get(d)?.sleepH))} h`,
    },
    {
      label: 'Water',
      cell: (d) => String(byDate.get(d)?.waterGlasses ?? ''),
      summary: `${avg(
        days.map((d) => byDate.get(d)?.waterGlasses),
        0,
      )} glasses`,
    },
    {
      label: 'Weight',
      cell: (d) => (byDate.get(d)?.weightKg !== undefined ? String(byDate.get(d)!.weightKg) : ''),
      summary:
        avg(days.map((d) => byDate.get(d)?.weightKg)) === '—'
          ? '—'
          : `${avg(days.map((d) => byDate.get(d)?.weightKg))} kg`,
    },
  ];
  return (
    <section aria-labelledby="health-heading">
      <div className="mb-3 flex items-center gap-1">
        <h2 id="health-heading" className="title-block flex-1">
          Check-ins by week
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous week"
          onClick={() => setOffset(offset - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-32 text-center text-sm tabular-nums">
          {format(start, 'd MMM')} – {format(addDays(start, 6), 'd MMM')}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next week"
          disabled={offset >= 0}
          onClick={() => setOffset(offset + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="border-line overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[22rem] table-fixed text-center text-xs md:text-sm">
          <thead className="text-muted border-line border-b">
            <tr>
              <th scope="col" className="w-16 py-2 pl-3 text-left font-medium md:w-20">
                <span className="sr-only">Measure</span>
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={cn('py-2 font-medium', d === today && 'text-fg font-semibold')}
                >
                  {format(parseISO(d), 'EEEEE')}
                  <span className="block tabular-nums">{format(parseISO(d), 'd')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="text-muted py-2 pl-3 text-left font-medium">
                  {r.label}
                </th>
                {days.map((d) => (
                  <td key={d} className={cn('truncate px-0.5 py-2 tabular-nums', d > today && 'opacity-30')}>
                    {d > today ? '' : r.cell(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-2 text-xs">
        Week average: sleep {rows[2]!.summary}, energy {rows[1]!.summary}, mood {rows[0]!.summary}, water{' '}
        {rows[3]!.summary}.
      </p>
    </section>
  );
}
