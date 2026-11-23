import { ChevronDown, Ellipsis, Pause, Pencil, Play, Plus, Repeat, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { Menu } from '@/components/Menu';
import { Confirm, Sheet } from '@/components/Sheet';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Badge, BlockHeader, Button, Field, Input, Select, StatusMark, type Mark } from '@/components/ui';
import {
  routineLabel,
  routineProblem,
  routineSlots,
  slotStates,
  toMin,
  UNIT_LABEL,
  type HealthRoutine,
  type SlotState,
} from '@/core/domain/health';
import type { Checkin, LocalDate } from '@/core/domain/types';
import {
  deleteHealthRoutine,
  markRoutineSlot,
  restoreHealthRoutine,
  saveHealthRoutine,
  setHealthRoutinePaused,
} from '@/core/repos/life';
import { cn } from '@/lib/cn';

const SUGGESTIONS = [
  'Drink water',
  'Walk',
  'Take a break',
  'Stretch',
  'Eye rest (20-20-20)',
  'Take medicine',
];

const CHIP: Record<SlotState, string> = {
  done: 'border-line-strong text-fg',
  due: 'border-fg text-fg font-semibold',
  missed: 'border-line-strong text-muted',
  upcoming: 'border-line text-muted',
};
const CHIP_MARK: Record<SlotState, Mark> = { done: 'done', due: 'due', missed: 'missed', upcoming: 'none' };
const STATE_LABEL: Record<SlotState, string> = {
  done: 'done',
  due: 'due now',
  missed: 'missed',
  upcoming: 'later',
};

/**
 * Today's occurrences of your reminders through the day ("Drink water every 2 hours"), on Health's
 * Today: each as done, due, missed or later; tap one to mark it done (or undo).
 */
export function HealthRemindersToday({
  routines,
  today,
  checkin,
  nowMin,
}: {
  routines: HealthRoutine[];
  today: LocalDate;
  checkin?: Checkin;
  /** Minutes since midnight now (local). */
  nowMin: number;
}) {
  if (!routines.length) return null;
  return (
    <section aria-labelledby="health-reminders-today" className="mt-6">
      <h3 id="health-reminders-today" className="mb-1 text-[15px] font-semibold md:text-sm">
        Reminders through the day
      </h3>
      <ul className="border-line divide-line divide-y border-y">
        {routines.map((r) => {
          const states = slotStates(routineSlots(r, today), checkin?.routineDone?.[r.id], nowMin);
          const count = (s: SlotState) => states.filter((x) => x.state === s).length;
          return (
            <li key={r.id} aria-label={r.title} className="py-3">
              <div className="flex items-start gap-3">
                <Repeat aria-hidden className="text-muted mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium md:text-sm">
                    <span className="truncate">{r.title}</span>
                    {r.paused && <Badge>Paused</Badge>}
                  </div>
                  <div className="text-meta text-muted">
                    {routineLabel(r)}
                    {r.until ? ` · until ${r.until}` : ''}
                    {!r.remind ? ' · no reminders' : ''}
                  </div>
                </div>
              </div>
              {states.length > 0 ? (
                <>
                  <ol aria-label={`${r.title} today`} className="mt-2 flex flex-wrap gap-1.5 pl-8">
                    {states.map(({ time, state }) => (
                      <li key={time}>
                        <button
                          type="button"
                          disabled={state === 'upcoming'}
                          aria-label={`${r.title} at ${time}: ${STATE_LABEL[state]}`}
                          aria-pressed={state === 'done'}
                          onClick={() =>
                            void attempt(() => markRoutineSlot(today, r.id, time, state !== 'done'))
                          }
                          className={cn(
                            'flex min-h-11 items-center gap-1.5 rounded-sm border px-2.5 text-[13px] tabular-nums md:min-h-8 md:text-xs',
                            CHIP[state],
                          )}
                        >
                          {state !== 'upcoming' && <StatusMark mark={CHIP_MARK[state]} className="w-4" />}
                          {time}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <p className="text-meta text-muted mt-1.5 pl-8 tabular-nums">
                    {count('done')} of {states.length} done today
                    {count('missed') ? ` · ${count('missed')} missed` : ''}
                    {count('due') ? ' · 1 due now' : ''}
                    {count('upcoming') ? ` · ${count('upcoming')} later` : ''}
                  </p>
                </>
              ) : (
                <p className="text-meta text-muted mt-1 pl-8">
                  {r.paused ? 'Paused: nothing due.' : 'Nothing due today.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Managing your reminders through the day: add, edit, pause, delete. Collapsed by default; today's
 * occurrences are on Today (HealthRemindersToday).
 */
export function HealthRoutines({ routines, today }: { routines: HealthRoutine[]; today: LocalDate }) {
  const [editing, setEditing] = useState<HealthRoutine | 'new' | null>(null);
  const [deleting, setDeleting] = useState<HealthRoutine | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="health-routines">
      <BlockHeader
        id="health-routines"
        title="Manage reminders through the day"
        count={routines.length}
        action={
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing('new')} aria-label="Add a plan item">
              <Plus className="size-4" /> Add
            </Button>
            {routines.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={open}
                aria-controls="health-routine-list"
                aria-label={open ? 'Hide reminders through the day' : 'Show reminders through the day'}
                onClick={() => setOpen(!open)}
              >
                {open ? 'Hide' : 'Show'}
                <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
              </Button>
            )}
          </>
        }
      />
      {routines.length === 0 ? (
        <p className="text-muted text-[15px] md:text-sm">
          Things you do on a rhythm, like “Drink water every 2 hours”, “Walk every 60 minutes” or “Take a
          break every 90 minutes”. Each one reminds you and tracks what you did.
        </p>
      ) : (
        open && (
          <ul id="health-routine-list" className="divide-line divide-y">
            {routines.map((r) => (
              <li key={r.id} className="flex min-h-14 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium md:text-sm">
                    <span className="truncate">{r.title}</span>
                    {r.paused && <Badge>Paused</Badge>}
                  </div>
                  <div className="text-meta text-muted">{routineLabel(r)}</div>
                </div>
                <Menu
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Options for ${r.title}`}>
                      <Ellipsis className="size-4" />
                    </Button>
                  }
                  items={[
                    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(r) },
                    r.paused
                      ? {
                          label: 'Resume',
                          icon: Play,
                          onSelect: () => void attempt(() => setHealthRoutinePaused(r.id, false)),
                        }
                      : {
                          label: 'Pause',
                          icon: Pause,
                          onSelect: () => void attempt(() => setHealthRoutinePaused(r.id, true)),
                        },
                    null,
                    { label: 'Delete…', icon: Trash, danger: true, onSelect: () => setDeleting(r) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )
      )}
      {editing && (
        <HealthRoutineSheet
          routine={editing === 'new' ? undefined : editing}
          today={today}
          onClose={() => setEditing(null)}
        />
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ''}”?`}
        description="Its reminders stop. What you marked done stays in your check-ins. You can undo this."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const r = deleting!;
          setDeleting(null);
          void attempt(async () => {
            const removed = await deleteHealthRoutine(r.id);
            if (removed) toast(`Deleted “${r.title}”`, () => restoreHealthRoutine(removed));
          });
        }}
      />
    </section>
  );
}

/** Add or edit a plan item: repeat every N minutes / hours / days, or at exact times. */
function HealthRoutineSheet({
  routine,
  today,
  onClose,
}: {
  routine?: HealthRoutine;
  today: LocalDate;
  onClose: () => void;
}) {
  const [r, setR] = useState<Omit<HealthRoutine, 'id'>>(
    routine ?? {
      title: '',
      mode: 'interval',
      every: 2,
      unit: 'h',
      start: '08:00',
      end: '20:00',
      times: ['09:00'],
      from: today,
      remind: true,
    },
  );
  const set = (changes: Partial<HealthRoutine>) => setR({ ...r, ...changes });
  const problem = routineProblem(r);
  const preview = routineSlots({ ...r, id: '', paused: false }, r.from > today ? r.from : today);
  const save = () =>
    void attempt(async () => {
      // Keep only what the chosen kind uses.
      const clean =
        r.mode === 'times'
          ? {
              ...r,
              times: [...new Set(r.times)].sort(),
              every: undefined,
              unit: undefined,
              start: undefined,
              end: undefined,
            }
          : { ...r, times: undefined, end: r.unit === 'd' ? undefined : r.end || undefined };
      await saveHealthRoutine(clean, routine?.id);
      onClose();
    });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={routine ? 'Edit plan item' : 'New plan item'}
      description="Repeat on an interval, or at times you choose. You’re reminded at each one until you mark it done."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!!problem} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What" htmlFor="hr-title">
          <Input
            id="hr-title"
            autoFocus
            list="hr-suggestions"
            value={r.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Drink water"
          />
          <datalist id="hr-suggestions">
            {SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        <div role="radiogroup" aria-label="When" className="grid grid-cols-2 gap-2">
          {(
            [
              ['interval', 'Repeat every…'],
              ['times', 'At exact times'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={r.mode === v}
              onClick={() =>
                // Switching kinds starts from something sensible (an edited item has only its own fields).
                set(
                  v === 'times'
                    ? { mode: v, times: r.times?.length ? r.times : [r.start ?? '09:00'] }
                    : {
                        mode: v,
                        every: r.every ?? 2,
                        unit: r.unit ?? 'h',
                        start: r.start ?? r.times?.[0] ?? '08:00',
                      },
                )
              }
              className={cn(
                'min-h-11 rounded-md border px-3 text-sm md:min-h-10',
                r.mode === v
                  ? 'border-fg bg-surface-2 font-medium'
                  : 'border-line text-muted hover:border-fg/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {r.mode === 'interval' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Every" htmlFor="hr-every">
              <Input
                id="hr-every"
                type="number"
                min={1}
                value={r.every ?? ''}
                onChange={(e) => set({ every: Number(e.target.value) || undefined })}
              />
            </Field>
            <Field label="Unit" htmlFor="hr-unit">
              <Select
                id="hr-unit"
                value={r.unit ?? 'h'}
                onChange={(e) => set({ unit: e.target.value as HealthRoutine['unit'] })}
              >
                {(['min', 'h', 'd'] as const).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={r.unit === 'd' ? 'At' : 'From'} htmlFor="hr-start">
              <Input
                id="hr-start"
                type="time"
                value={r.start ?? ''}
                onChange={(e) => set({ start: e.target.value })}
              />
            </Field>
            {r.unit !== 'd' && (
              <Field label="Until (optional)" htmlFor="hr-end">
                <Input
                  id="hr-end"
                  type="time"
                  value={r.end ?? ''}
                  onChange={(e) => set({ end: e.target.value || undefined })}
                />
              </Field>
            )}
          </div>
        ) : (
          <fieldset>
            <legend className="text-muted mb-1.5 text-xs font-medium">Times</legend>
            <ul className="flex flex-wrap gap-2">
              {(r.times ?? []).map((t, i) => (
                <li key={i} className="flex items-center gap-1">
                  <Input
                    type="time"
                    aria-label={`Time ${i + 1}`}
                    value={t}
                    onChange={(e) =>
                      set({ times: (r.times ?? []).map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    className="w-28"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove time ${i + 1}`}
                    onClick={() => set({ times: (r.times ?? []).filter((_, j) => j !== i) })}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                const last = r.times?.length ? Math.max(...r.times.map(toMin)) : 8 * 60;
                const m = Math.min(23 * 60, last + 60);
                set({ times: [...(r.times ?? []), `${String(Math.floor(m / 60)).padStart(2, '0')}:00`] });
              }}
            >
              <Plus className="size-4" /> Add a time
            </Button>
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting" htmlFor="hr-from">
            <DatePicker value={r.from} onChange={(v) => v && set({ from: v })}>
              <DateButton id="hr-from" label="Starting date" value={r.from} />
            </DatePicker>
          </Field>
          <Field label="Ending (optional)" htmlFor="hr-until">
            <DatePicker value={r.until ?? ''} onChange={(v) => set({ until: v || undefined })}>
              <DateButton id="hr-until" label="Ending date" value={r.until ?? ''} />
            </DatePicker>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.remind}
            onChange={(e) => set({ remind: e.target.checked })}
            className="accent-[var(--fg)]"
          />
          Remind me at each one
        </label>

        {problem ? (
          <p role="status" className="text-warning text-sm">
            {problem}
          </p>
        ) : (
          <p className="text-muted text-sm">
            {preview.length
              ? `${preview.length} a day: ${preview.slice(0, 8).join(', ')}${preview.length > 8 ? ', …' : ''}`
              : 'Nothing that day: it repeats every few days.'}
          </p>
        )}
      </div>
    </Sheet>
  );
}
