import { format, parseISO, subDays } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button, Input } from '@/components/ui';
import { useCheckins, useJournal } from '@/core/hooks';
import { eachDay } from '@/core/domain/analytics';
import { toLocalDate } from '@/core/domain/tasks';
import type { Mood } from '@/core/domain/types';
import { setCheckin } from '@/core/repos/life';
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

  return (
    <div className="border-line grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
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
      <div className="flex gap-6">
        <div className="space-y-1.5">
          <div className="text-muted text-xs">Water (glasses)</div>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="One glass less"
              disabled={!c?.waterGlasses}
              onClick={() => save((x) => ({ waterGlasses: Math.max(0, (x?.waterGlasses ?? 0) - 1) }))}
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
              onClick={() => save((x) => ({ waterGlasses: (x?.waterGlasses ?? 0) + 1 }))}
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
export function HealthSection() {
  const now = useNow();
  const today = toLocalDate(now);
  const from = format(subDays(now, 13), 'yyyy-MM-dd');
  const checkins = useCheckins(from);
  const journal = useJournal();
  if (!checkins || !journal) return null;
  const days = eachDay(from, today).reverse();
  const avg = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => x !== undefined);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '—';
  };
  return (
    <section aria-labelledby="health-heading" className="mb-10">
      <h2 id="health-heading" className="mb-3 text-[15px] font-semibold md:text-sm">
        Daily check-in
      </h2>
      <CheckinCard />
      <p className="text-muted mt-4 mb-2 text-xs">
        Last 14 days: sleep {avg(checkins.map((c) => c.sleepH))} h on average · energy{' '}
        {avg(checkins.map((c) => c.energy))} of 5
      </p>
      <table className="w-full text-sm">
        <thead className="text-muted border-line border-b text-left text-xs">
          <tr>
            <th scope="col" className="py-1.5 font-medium">
              Day
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Mood
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Energy
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Sleep
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Water
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Weight
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {days.map((d) => {
            const c = checkins.find((x) => x.date === d);
            const m = journal.find((e) => e.date === d)?.mood;
            return (
              <tr key={d}>
                <td className="py-1.5">{format(parseISO(d), 'EEE d MMM')}</td>
                <td className="text-muted py-1.5">{MOODS.find((x) => x.value === m)?.label ?? ''}</td>
                <td className="text-muted py-1.5">{c?.energy ? ENERGY[c.energy - 1] : ''}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {c?.sleepH !== undefined ? `${c.sleepH} h` : ''}
                </td>
                <td className="py-1.5 text-right tabular-nums">{c?.waterGlasses ?? ''}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {c?.weightKg !== undefined ? `${c.weightKg} kg` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
