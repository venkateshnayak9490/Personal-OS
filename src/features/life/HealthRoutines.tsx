import { Check, Ellipsis, Pause, Pencil, Play, Plus, Repeat, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { Menu } from '@/components/Menu';
import { Confirm, Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select } from '@/components/ui';
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
  done: 'bg-success text-bg border-transparent',
  due: 'border-fg text-fg',
  missed: 'border-line text-muted border-dashed',
  upcoming: 'border-line/60 text-muted opacity-60',
};
const STATE_LABEL: Record<SlotState, string> = {
  done: 'done',
  due: 'due now',
  missed: 'missed',
  upcoming: 'later',
};

/**
 * Your own repeating plan items ("Drink water every 2 hours", "Stretch at 11:00 and 16:00"): today's
 * occurrences as done, due, missed or later; tap one to mark it done (or undo). Edit, pause, delete.
 */
export function HealthRoutines({
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
  const [editing, setEditing] = useState<HealthRoutine | 'new' | null>(null);
  const [deleting, setDeleting] = useState<HealthRoutine | null>(null);

  return (
    <section aria-labelledby="health-routines">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="health-routines" className="title-block flex-1">
          Repeating plan items
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setEditing('new')} aria-label="Add a plan item">
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {routines.length === 0 ? (
        <p className="text-muted text-sm">
          Things you do on a rhythm, like “Drink water every 2 hours”, “Walk every 60 minutes” or “Take a
          break every 90 minutes”. Each one reminds you and tracks what you did.
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {routines.map((r) => {
            const states = slotStates(routineSlots(r, today), checkin?.routineDone?.[r.id], nowMin);
            const count = (s: SlotState) => states.filter((x) => x.state === s).length;
            return (
              <li key={r.id} aria-label={r.title} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Repeat className="text-muted mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-medium md:text-sm">
                      <span className="truncate">{r.title}</span>
                      {r.paused && (
                        <span className="bg-surface-2 text-muted rounded-full px-2 py-0.5 text-[11px]">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="text-muted text-xs">
                      {routineLabel(r)}
                      {r.until ? ` · until ${r.until}` : ''}
                      {!r.remind ? ' · no reminders' : ''}
                    </div>
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
                              'flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs tabular-nums',
                              CHIP[state],
                            )}
                          >
                            {state === 'done' && <Check className="size-3" strokeWidth={3} />}
                            {state === 'missed' && <X className="size-3" />}
                            {time}
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="text-muted mt-1.5 pl-8 text-xs tabular-nums">
                      {count('done')} of {states.length} done today
                      {count('missed') ? ` · ${count('missed')} missed` : ''}
                      {count('due') ? ' · 1 due now' : ''}
                      {count('upcoming') ? ` · ${count('upcoming')} later` : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-muted mt-1 pl-8 text-xs">
                    {r.paused ? 'Paused: nothing due.' : 'Nothing due today.'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
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
                'min-h-10 rounded-xl border px-3 text-sm',
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
            <Input
              id="hr-from"
              type="date"
              value={r.from}
              onChange={(e) => e.target.value && set({ from: e.target.value })}
            />
          </Field>
          <Field label="Ending (optional)" htmlFor="hr-until">
            <Input
              id="hr-until"
              type="date"
              value={r.until ?? ''}
              onChange={(e) => set({ until: e.target.value || undefined })}
            />
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
