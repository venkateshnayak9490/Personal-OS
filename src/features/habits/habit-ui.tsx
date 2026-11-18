import { Check, Minus, Moon } from 'lucide-react';
import { attempt } from '@/app/toast';
import type { Habit, HabitLogStatus, LocalDate } from '@/core/domain/types';
import { setHabitLog } from '@/core/repos/plans';
import { cn } from '@/lib/cn';

/** Click order for a day's check-in: empty → done → skipped → rest (if allowed) → empty. */
export function nextStatus(habit: Habit, cur: HabitLogStatus | undefined): HabitLogStatus | null {
  if (!cur) return 'done';
  if (cur === 'done') return 'skipped';
  if (cur === 'skipped') return habit.restDaysAllowed ? 'rest' : null;
  return null;
}

const LABEL: Record<HabitLogStatus, string> = { done: 'done', skipped: 'skipped', rest: 'rest day' };

export function DayCell({
  habit,
  date,
  status,
  scheduled,
  isToday,
  dayLabel,
  large,
}: {
  habit: Habit;
  date: LocalDate;
  status?: HabitLogStatus;
  scheduled: boolean;
  isToday?: boolean;
  dayLabel: string;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`${habit.title}, ${dayLabel}: ${status ? LABEL[status] : 'not checked'}`}
      title={`${dayLabel}: ${status ? LABEL[status] : 'click to mark done'}`}
      onClick={() => void attempt(() => setHabitLog(habit.id, date, nextStatus(habit, status)))}
      className={cn(
        'grid place-items-center rounded-lg border transition-colors',
        large ? 'size-9' : 'size-8',
        status === 'done' && 'bg-sec-self text-bg border-transparent',
        status === 'skipped' && 'border-line text-muted border-dashed',
        status === 'rest' && 'border-line bg-surface-2 text-muted',
        !status &&
          (scheduled ? 'border-line hover:border-fg/40' : 'border-line/50 opacity-40 hover:opacity-100'),
        isToday && !status && 'border-fg/50',
      )}
    >
      {status === 'done' && <Check className="size-4" strokeWidth={3} />}
      {status === 'skipped' && <Minus className="size-3.5" />}
      {status === 'rest' && <Moon className="size-3.5" />}
    </button>
  );
}
