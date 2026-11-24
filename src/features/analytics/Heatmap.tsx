import { format, parseISO } from 'date-fns';
import { eachDay } from '@/core/domain/analytics';
import { cn } from '@/lib/cn';

/** GitHub-style grid of days; darker = more done. */
export function Heatmap({
  byDay,
  from,
  today,
  label,
  binary,
}: {
  byDay: Map<string, number>;
  from: string;
  today: string;
  /** Read out with the total, e.g. "tasks completed in the last 12 months". */
  label: string;
  /** Done or not (habits): any count shows in full color. */
  binary?: boolean;
}) {
  const days = eachDay(from, today);
  const level = (n: number) => (n === 0 ? 0 : binary ? 4 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  // Ink at four strengths: done is never a colour (Timetable).
  const fill = ['bg-surface-2', 'bg-fg/25', 'bg-fg/45', 'bg-fg/70', 'bg-fg'];
  const weeks: string[][] = [];
  days.forEach((d, i) => (weeks[Math.floor(i / 7)] ??= []).push(d));
  const total = days.reduce((a, d) => a + (byDay.get(d) ?? 0), 0);
  return (
    <div>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${total} ${label}`}
      >
        {weeks.map((w) => (
          <div key={w[0]} className="grid gap-[2px]">
            {w.map((d) => {
              const n = byDay.get(d) ?? 0;
              return (
                <div
                  key={d}
                  title={`${format(parseISO(d), 'EEE d MMM yyyy')}: ${n} completed`}
                  className={cn('aspect-square max-h-3 rounded-[2px]', fill[level(n)])}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="text-muted mt-2 flex items-center gap-1.5 text-xs">
        {total} completed · Less
        {fill.map((f) => (
          <span key={f} className={cn('size-[11px] rounded-[2px]', f)} />
        ))}
        More
      </div>
    </div>
  );
}
