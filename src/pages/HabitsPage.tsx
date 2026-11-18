import { addDays, format, startOfWeek } from 'date-fns';
import { Ellipsis, Flame, Pencil, Plus, Repeat, Trash } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { Button, EmptyState, Field, Input, Loading, Select } from '@/components/ui';
import { useGoals, useHabitLogs, useHabits, useProfile } from '@/core/hooks';
import { isScheduled, logsByDate, streak, targetLabel, weekProgress } from '@/core/domain/progress';
import type { Habit, HabitTarget } from '@/core/domain/types';
import { createHabit, deleteHabit, updateHabit } from '@/core/repos/plans';
import { restoreFromTrash } from '@/core/repos/trash';
import { DayCell } from '@/features/habits/habit-ui';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { cn } from '@/lib/cn';

const DAYS = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 0, label: 'Sun' },
];

type Editing = { mode: 'create' } | { mode: 'edit'; habit: Habit } | null;

function HabitSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const h = editing.mode === 'edit' ? editing.habit : undefined;
  const goals = useGoals();
  const [title, setTitle] = useState(h?.title ?? '');
  const [kind, setKind] = useState<HabitTarget['type']>(h?.target.type ?? 'daily');
  const [n, setN] = useState(h?.target.type === 'perWeek' ? h.target.n : 3);
  const [days, setDays] = useState<number[]>(h?.target.type === 'days' ? h.target.days : [1, 3, 5]);
  const [nodeId, setNodeId] = useState(h?.nodeId);
  const [goalId, setGoalId] = useState(h?.goalId ?? '');
  const [rest, setRest] = useState(h?.restDaysAllowed ?? true);

  const target: HabitTarget =
    kind === 'perWeek'
      ? { type: 'perWeek', n }
      : kind === 'days'
        ? { type: 'days', days }
        : { type: 'daily' };
  const valid = title.trim() && (kind !== 'days' || days.length > 0);

  const submit = async () => {
    if (!valid) return;
    const fields = { title, target, nodeId, goalId: goalId || undefined, restDaysAllowed: rest };
    const ok = await attempt(async () => {
      if (h) await updateHabit(h.id, fields);
      else await createHabit(fields);
      return true;
    });
    if (ok !== undefined) onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={h ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => void submit()}>
            {h ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Habit" htmlFor="h-title">
          <Input
            id="h-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gym, Read 20 pages, Meditate"
          />
        </Field>
        <Field label="How often" htmlFor="h-kind">
          <Select id="h-kind" value={kind} onChange={(e) => setKind(e.target.value as HabitTarget['type'])}>
            <option value="daily">Every day</option>
            <option value="perWeek">A number of times a week</option>
            <option value="days">On specific days</option>
          </Select>
        </Field>
        {kind === 'perWeek' && (
          <Field label="Times a week" htmlFor="h-n">
            <Input
              id="h-n"
              type="number"
              min={1}
              max={7}
              value={n}
              onChange={(e) => setN(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
        )}
        {kind === 'days' && (
          <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
            {DAYS.map(({ d, label }) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cn(
                    'h-9 w-12 rounded-lg border text-xs font-medium',
                    on ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Section" htmlFor="h-node">
            <SectionSelect id="h-node" value={nodeId} onChange={setNodeId} />
          </Field>
          <Field label="Counts toward goal" htmlFor="h-goal">
            <Select id="h-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">No goal</option>
              {(goals ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rest}
            onChange={(e) => setRest(e.target.checked)}
            className="accent-[var(--fg)]"
          />
          Allow rest days (they don’t break your streak)
        </label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

export function HabitsPage() {
  const habits = useHabits();
  const profile = useProfile();
  const now = useNow();
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const today = format(new Date(now), 'yyyy-MM-dd');
  const start = startOfWeek(new Date(now), { weekStartsOn });
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const since = format(addDays(new Date(now), -400), 'yyyy-MM-dd'); // enough history for streaks
  const logs = useHabitLogs(since);
  const [editing, setEditing] = useState<Editing>(null);

  if (!habits || !logs) return <Loading />;

  return (
    <>
      <PageHeader
        title="Habits"
        icon={Repeat}
        subtitle="Click a day to check in. Click again for skipped, then rest day."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: 'create' })}>
            <Plus className="size-4" /> New habit
          </Button>
        }
      />
      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          action={
            <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
              <Plus className="size-4" /> New habit
            </Button>
          }
        >
          Gym 4× a week, reading every day, yoga on Mon/Wed/Fri. Streaks are gentle: rest days never break
          them.
        </EmptyState>
      ) : (
        <div className="border-line rounded-xl border">
          <div className="border-line text-muted grid grid-cols-[1fr_auto_6rem_2.5rem] items-center gap-4 border-b px-4 py-2 text-xs">
            <span>Habit</span>
            <div className="flex gap-1.5">
              {week.map((d) => (
                <span
                  key={d.toISOString()}
                  className={cn(
                    'w-8 text-center',
                    format(d, 'yyyy-MM-dd') === today && 'text-fg font-semibold',
                  )}
                >
                  {format(d, 'EEEEE')}
                  <span className="block tabular-nums">{format(d, 'd')}</span>
                </span>
              ))}
            </div>
            <span className="text-right">This week</span>
            <span />
          </div>
          <ul className="divide-line divide-y">
            {habits.map((h) => {
              const byDate = logsByDate(logs, h.id);
              const s = streak(h, byDate, today, weekStartsOn);
              const wp = weekProgress(h, byDate, today, weekStartsOn);
              return (
                <li key={h.id} className="grid grid-cols-[1fr_auto_6rem_2.5rem] items-center gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{h.title}</div>
                    <div className="text-muted flex items-center gap-2 text-xs">
                      {targetLabel(h)}
                      {s > 0 && (
                        <span className="text-fg inline-flex items-center gap-0.5" title="Current streak">
                          <Flame className="text-sec-misc size-3.5" /> {s}{' '}
                          {h.target.type === 'perWeek'
                            ? s === 1
                              ? 'week'
                              : 'weeks'
                            : s === 1
                              ? 'day'
                              : 'days'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {week.map((d) => {
                      const date = format(d, 'yyyy-MM-dd');
                      return (
                        <DayCell
                          key={date}
                          habit={h}
                          date={date}
                          status={byDate.get(date)?.status}
                          scheduled={isScheduled(h, date)}
                          isToday={date === today}
                          dayLabel={format(d, 'EEEE d MMM')}
                        />
                      );
                    })}
                  </div>
                  <span
                    className={cn(
                      'text-right text-sm tabular-nums',
                      wp.done >= wp.target && 'text-sec-self font-medium',
                    )}
                  >
                    {wp.done}/{wp.target}
                  </span>
                  <Menu
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Options for ${h.title}`}>
                        <Ellipsis className="size-4" />
                      </Button>
                    }
                    items={[
                      { label: 'Edit', icon: Pencil, onSelect: () => setEditing({ mode: 'edit', habit: h }) },
                      null,
                      {
                        label: 'Delete',
                        icon: Trash,
                        danger: true,
                        onSelect: () =>
                          void attempt(async () => {
                            const b = await deleteHabit(h.id);
                            if (b) toast(`Moved “${h.title}” to Trash`, () => restoreFromTrash(b));
                          }),
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {editing && <HabitSheet editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
