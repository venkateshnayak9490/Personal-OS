import { Check, Minus, Moon } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Textarea } from '@/components/ui';
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

/** Skipping is allowed, but only with an honest reason (it's kept in the habit's history). */
export function SkipReasonSheet({
  habit,
  dayLabel,
  onSkip,
  onClose,
}: {
  habit: Pick<Habit, 'title'>;
  dayLabel: string;
  onSkip: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= 3;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Skip ${habit.title}?`}
      description={`${dayLabel}. Be honest with yourself: what got in the way?`}
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
            Skip with this reason
          </Button>
        </>
      }
    >
      <Field label="Reason" htmlFor="skip-reason">
        <Textarea
          id="skip-reason"
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Slept 4 hours, lab deadline ran late, felt unwell"
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
          onSkip={(reason) => void attempt(() => setHabitLog(habit.id, date, 'skipped', reason))}
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
    </>
  );
}
