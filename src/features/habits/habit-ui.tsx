import { Check, Minus, Moon, X } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Textarea } from '@/components/ui';
import { attempt } from '@/app/toast';
import type { Habit, HabitLogStatus, LocalDate } from '@/core/domain/types';
import { setHabitLog } from '@/core/repos/plans';
import { cn } from '@/lib/cn';

/** Click order for a day's check-in: empty → done → skipped → rest (if allowed) → empty. */
export function nextStatus(habit: Habit, cur: HabitLogStatus | undefined): HabitLogStatus | null {
  if (!cur || cur === 'missed') return 'done';
  if (cur === 'done') return 'skipped';
  if (cur === 'skipped') return habit.restDaysAllowed ? 'rest' : null;
  return null;
}

const LABEL: Record<HabitLogStatus, string> = {
  done: 'done',
  skipped: 'skipped',
  rest: 'rest day',
  missed: 'missed',
};

export const QUICK_REASONS = [
  'Busy with work/studies',
  'Not feeling well',
  'Personal commitments',
  'Recovery/rest',
  'Other',
];

/**
 * A reason for a skip (or a missed day), kept in the habit's history and editable later. Quick picks
 * fill the box; you can add your own words. With `optional` (Gym), you can go without one.
 * A skip or a miss never counts as done.
 */
export function SkipReasonSheet({
  habit,
  dayLabel,
  planned,
  initial = '',
  optional,
  missed,
  onSkip,
  onClose,
}: {
  habit: Pick<Habit, 'title'>;
  dayLabel: string;
  /** What was planned that day (e.g. today's workout). */
  planned?: string;
  /** Editing an earlier skip: its reason. */
  initial?: string;
  /** The reason can be left empty. */
  optional?: boolean;
  /** Explaining a missed day (not a skip). */
  missed?: boolean;
  onSkip: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(initial);
  const ok = optional || reason.trim().length > 0;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        initial
          ? `Edit reason: ${habit.title}`
          : missed
            ? `Why was ${habit.title} missed?`
            : `Skip ${habit.title}?`
      }
      description={`${dayLabel}${planned ? ` · ${planned}` : ''}. What got in the way? ${optional ? 'Optional, but' : 'It'} helps you spot patterns later.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              onSkip(reason.trim());
              onClose();
            }}
          >
            {initial || missed
              ? 'Save reason'
              : optional && !reason.trim()
                ? 'Skip without a reason'
                : 'Skip with this reason'}
          </Button>
        </>
      }
    >
      <div role="group" aria-label="Quick reasons" className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_REASONS.map((q) => (
          <button
            key={q}
            type="button"
            aria-pressed={reason.startsWith(q)}
            onClick={() =>
              setReason(reason.trim() && !QUICK_REASONS.some((x) => reason === x) ? `${q}: ${reason}` : q)
            }
            className={cn(
              'min-h-9 rounded-full border px-3 text-sm',
              reason.startsWith(q) ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
            )}
          >
            {q}
          </button>
        ))}
      </div>
      <Field label={optional ? 'Reason (optional)' : 'Reason'} htmlFor="skip-reason">
        <Textarea
          id="skip-reason"
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="In your own words, e.g. slept 4 hours after a deadline"
        />
      </Field>
    </Sheet>
  );
}

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
  const [asking, setAsking] = useState(false);
  return (
    <>
      {asking && (
        <SkipReasonSheet
          habit={habit}
          dayLabel={dayLabel}
          optional={habit.source === 'gym'}
          onSkip={(reason) => void attempt(() => setHabitLog(habit.id, date, 'skipped', reason || undefined))}
          onClose={() => setAsking(false)}
        />
      )}
      <button
        type="button"
        aria-label={`${habit.title}, ${dayLabel}: ${status ? LABEL[status] : 'not checked'}`}
        title={`${dayLabel}: ${status ? LABEL[status] : 'click to mark done'}`}
        onClick={() => {
          const next = nextStatus(habit, status);
          if (next === 'skipped') setAsking(true);
          else void attempt(() => setHabitLog(habit.id, date, next));
        }}
        className={cn(
          'grid place-items-center rounded-lg border transition-colors',
          large ? 'size-9' : 'size-8',
          status === 'done' && 'bg-sec-self text-bg border-transparent',
          (status === 'skipped' || status === 'missed') && 'border-line text-muted border-dashed',
          status === 'rest' && 'border-line bg-surface-2 text-muted',
          !status &&
            (scheduled ? 'border-line hover:border-fg/40' : 'border-line/50 opacity-40 hover:opacity-100'),
          isToday && !status && 'border-fg/50',
        )}
      >
        {status === 'done' && <Check className="size-4" strokeWidth={3} />}
        {status === 'skipped' && <Minus className="size-3.5" />}
        {status === 'missed' && <X className="size-3.5" />}
        {status === 'rest' && <Moon className="size-3.5" />}
      </button>
    </>
  );
}
