import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button, Field, StatusMark, Textarea } from '@/components/ui';
import { attempt } from '@/app/toast';
import type { Habit, HabitLogStatus, LocalDate } from '@/core/domain/types';
import { setHabitLog } from '@/core/repos/plans';
import { cn } from '@/lib/cn';

/** A tap toggles done; skip, rest and clear are in the day's options (long press or right-click). */
export const tapStatus = (cur: HabitLogStatus | undefined): HabitLogStatus | null =>
  cur === 'done' ? null : 'done';

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
              'min-h-9 rounded-md border px-3 text-sm',
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
  missedByPlan,
}: {
  habit: Habit;
  date: LocalDate;
  status?: HabitLogStatus;
  scheduled: boolean;
  isToday?: boolean;
  dayLabel: string;
  large?: boolean;
  /** A planned day in the past with nothing logged: shown as missed (as consistency counts it). */
  missedByPlan?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [options, setOptions] = useState(false);
  const set = (next: HabitLogStatus | null) => void attempt(() => setHabitLog(habit.id, date, next));
  const label = `${habit.title}, ${dayLabel}`;
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
      <Sheet open={options} onOpenChange={setOptions} title={label}>
        <div role="group" aria-label="Day options" className="flex flex-wrap gap-2">
          {(
            [
              ['done', 'Done'],
              ['skipped', 'Skip…'],
              ...(habit.restDaysAllowed ? [['rest', 'Rest day']] : []),
              [null, 'Clear'],
            ] as [HabitLogStatus | null, string][]
          ).map(([next, text]) => (
            <Button
              key={text}
              variant={next === (status ?? null) ? 'primary' : 'secondary'}
              onClick={() => {
                setOptions(false);
                if (next === 'skipped') setAsking(true);
                else set(next);
              }}
            >
              {text}
            </Button>
          ))}
        </div>
      </Sheet>
      <button
        type="button"
        aria-label={`${label}: ${status ? LABEL[status] : missedByPlan ? 'missed' : 'not checked'}`}
        title={`${dayLabel}: ${status ? LABEL[status] : 'not checked'}. Tap: done. Long press or right-click: skip, rest, clear.`}
        onClick={() => set(tapStatus(status))}
        onContextMenu={(e) => {
          e.preventDefault();
          setOptions(true);
        }}
        className={cn(
          // A register cell: one mark per state (✓ S R –), readable without colour.
          'grid place-items-center rounded-sm border transition-colors select-none [-webkit-touch-callout:none]',
          large ? 'h-11 min-w-0 flex-1 md:size-9 md:flex-none' : 'size-8',
          status === 'done' && 'border-fg/60 bg-surface',
          (status === 'skipped' || status === 'rest') && 'border-line bg-surface-2',
          (status === 'missed' || (!status && missedByPlan)) && 'border-danger/50',
          !status &&
            (scheduled ? 'border-line-strong hover:border-fg/60' : 'border-line/60 hover:border-line-strong'),
          isToday && 'ring-fg ring-1',
        )}
      >
        <StatusMark
          mark={
            status === 'done'
              ? 'done'
              : status === 'skipped'
                ? 'skipped'
                : status === 'rest'
                  ? 'rest'
                  : status === 'missed' || missedByPlan
                    ? 'missed'
                    : isToday && scheduled
                      ? 'due'
                      : 'none'
          }
        />
      </button>
    </>
  );
}
