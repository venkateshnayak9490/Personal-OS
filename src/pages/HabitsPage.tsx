import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  Bell,
  ChartNoAxesColumn,
  Ellipsis,
  Flame,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  Trash,
} from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { Button, EmptyState, Field, Input, Loading, Select, Textarea } from '@/components/ui';
import { useGoals, useHabitLogs, useHabits, useProfile } from '@/core/hooks';
import { habitConsistency, pct } from '@/core/domain/analytics';
import { isScheduled, logsByDate, streak, targetLabel, weekProgress } from '@/core/domain/progress';
import type { Habit, HabitLog, HabitTarget, LocalDate } from '@/core/domain/types';
import { createHabit, deleteHabit, updateHabit } from '@/core/repos/plans';
import { restoreFromTrash } from '@/core/repos/trash';
import { Heatmap } from '@/features/analytics/Heatmap';
import { DayCell } from '@/features/habits/habit-ui';
import { useNodeTree } from '@/features/structure/use-tree';
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

type Preset = Pick<Habit, 'title' | 'target' | 'remindAt' | 'note' | 'nodeId'> & { section?: string };
type Editing = { mode: 'create'; preset?: Preset } | { mode: 'edit'; habit: Habit } | null;

/** Starter habits for staying consistent (section = the moduleKey of the section they belong in). */
const SUGGESTED: Preset[] = [
  {
    title: 'Gym',
    target: { type: 'perWeek', n: 4 },
    remindAt: '07:00',
    note: 'Strength or cardio.',
    section: 'fitness',
  },
  {
    title: 'Read a book',
    target: { type: 'daily' },
    remindAt: '21:30',
    note: 'Which book:',
    section: 'learning',
  },
  {
    title: 'Read a research paper',
    target: { type: 'daily' },
    remindAt: '10:00',
    note: 'At least one paper.',
    section: 'research',
  },
  {
    title: 'DSA practice',
    target: { type: 'daily' },
    remindAt: '18:00',
    note: 'At least 2 problems.',
    section: 'learning',
  },
  {
    title: 'Placement prep',
    target: { type: 'daily' },
    remindAt: '20:00',
    note: 'Videos, blogs, mock interviews.',
    section: 'learning',
  },
];

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

function HabitSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const h = editing.mode === 'edit' ? editing.habit : undefined;
  const src = h ?? (editing.mode === 'create' ? editing.preset : undefined);
  const goals = useGoals();
  const [title, setTitle] = useState(src?.title ?? '');
  const [kind, setKind] = useState<HabitTarget['type']>(src?.target.type ?? 'daily');
  const [n, setN] = useState(src?.target.type === 'perWeek' ? src.target.n : 3);
  const [days, setDays] = useState<number[]>(src?.target.type === 'days' ? src.target.days : [1, 3, 5]);
  const [nodeId, setNodeId] = useState(src?.nodeId);
  const [remindAt, setRemindAt] = useState(src?.remindAt ?? '');
  const [note, setNote] = useState(src?.note ?? '');
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
    const fields = {
      title,
      target,
      nodeId,
      goalId: goalId || undefined,
      restDaysAllowed: rest,
      remindAt: remindAt || undefined,
      note: note.trim() || undefined,
    };
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
        <Field label="Remind me at" htmlFor="h-remind">
          <Input id="h-remind" type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
        </Field>
        <Field label="What counts (optional)" htmlFor="h-note">
          <Textarea
            id="h-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. which book, or videos, blogs, mock interviews"
          />
        </Field>
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

/** Stats and the last 20 weeks of one habit. */
function HabitDetail({
  habit,
  logs,
  today,
  weekStartsOn,
  onClose,
}: {
  habit: Habit;
  logs: Map<LocalDate, HabitLog>;
  today: LocalDate;
  weekStartsOn: 0 | 1;
  onClose: () => void;
}) {
  const noon = new Date(`${today}T12:00`);
  const since = (days: number) => ymd(addDays(noon, -days));
  const c30 = habitConsistency(habit, logs, since(29), today, today, weekStartsOn);
  const c90 = habitConsistency(habit, logs, since(89), today, today, weekStartsOn);
  const from = ymd(startOfWeek(addDays(noon, -7 * 19), { weekStartsOn }));
  const done = [...logs].filter(([, l]) => l.status === 'done');
  const skips = [...logs]
    .filter(([, l]) => l.status === 'skipped')
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);
  const byDay = new Map(done.map(([d]) => [d, 1]));
  const s = streak(habit, logs, today, weekStartsOn);
  const stats = [
    { label: 'Streak', value: `${s} ${habit.target.type === 'perWeek' ? 'wk' : 'd'}` },
    { label: 'Last 30 days', value: pct(c30.target ? c30.done / c30.target : null) },
    { label: 'Last 90 days', value: pct(c90.target ? c90.done / c90.target : null) },
    { label: 'Done in total', value: String(done.length) },
  ];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={habit.title} description={targetLabel(habit)}>
      {habit.note && <p className="text-muted mb-4 text-sm">{habit.note}</p>}
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="border-line rounded-xl border p-3">
            <dt className="text-muted text-xs">{x.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>
      <Heatmap byDay={byDay} from={from} today={today} label="days done in the last 20 weeks" binary />
      {skips.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Why you skipped</h3>
          <ul className="space-y-1.5 text-sm">
            {skips.map(([d, l]) => (
              <li key={d} className="flex gap-3">
                <span className="text-muted w-24 shrink-0 tabular-nums">
                  {format(parseISO(d), 'EEE d MMM')}
                </span>
                <span>{l.note ?? 'No reason given'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {habit.remindAt && (
        <p className="text-muted mt-4 flex items-center gap-1.5 text-xs">
          <Bell className="size-3.5" /> Reminder at {habit.remindAt} on days it’s due, while the app is open.
        </p>
      )}
    </Sheet>
  );
}

export function HabitsPage() {
  const habits = useHabits();
  const profile = useProfile();
  const tree = useNodeTree();
  const now = useNow();
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const today = format(new Date(now), 'yyyy-MM-dd');
  const start = startOfWeek(new Date(now), { weekStartsOn });
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const since = format(addDays(new Date(now), -400), 'yyyy-MM-dd'); // enough history for streaks
  const logs = useHabitLogs(since);
  const [editing, setEditing] = useState<Editing>(null);
  const [detail, setDetail] = useState<Habit | null>(null);

  if (!habits || !logs) return <Loading />;

  const have = new Set(habits.map((h) => h.title.toLowerCase()));
  const suggestions = SUGGESTED.filter((p) => !have.has(p.title.toLowerCase()));
  const openPreset = (p: Preset) =>
    setEditing({
      mode: 'create',
      preset: { ...p, nodeId: tree?.nodes.find((x) => x.moduleKey === p.section && !x.deletedAt)?.id },
    });
  const thirtyAgo = ymd(addDays(new Date(now), -29));

  return (
    <>
      <PageHeader
        title="Habits"
        icon={Repeat}
        subtitle="Tap a day to check in. Tap again for skipped, then rest day."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: 'create' })}>
            <Plus className="size-4" /> New habit
          </Button>
        }
      />
      {habits.length > 0 && (
        <div className="border-line mb-8 rounded-xl border">
          <div className="border-line text-muted grid grid-cols-1 items-center gap-4 border-b px-4 py-2 text-xs md:grid-cols-[1fr_auto_6rem_2.5rem]">
            <span className="hidden md:block">Habit</span>
            <div className="flex gap-1.5">
              {week.map((d) => (
                <span
                  key={d.toISOString()}
                  className={cn('w-9 text-center', ymd(d) === today && 'text-fg font-semibold')}
                >
                  {format(d, 'EEEEE')}
                  <span className="block tabular-nums">{format(d, 'd')}</span>
                </span>
              ))}
            </div>
            <span className="hidden text-right md:block">This week</span>
            <span className="hidden md:block" />
          </div>
          <ul className="divide-line divide-y">
            {habits.map((h) => {
              const byDate = logsByDate(logs, h.id);
              const s = streak(h, byDate, today, weekStartsOn);
              const wp = weekProgress(h, byDate, today, weekStartsOn);
              const c = habitConsistency(h, byDate, thirtyAgo, today, today, weekStartsOn);
              return (
                <li
                  key={h.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2.5 px-4 py-3 md:grid-cols-[1fr_auto_6rem_2.5rem] md:gap-4"
                >
                  <button type="button" onClick={() => setDetail(h)} className="min-w-0 text-left">
                    <div className="truncate text-[15px] font-medium md:text-sm">{h.title}</div>
                    <div className="text-muted flex flex-wrap items-center gap-x-2 text-xs">
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
                      {c.target > 0 && (
                        <span title="Consistency, last 30 days">{pct(c.done / c.target)} last 30 days</span>
                      )}
                      {h.remindAt && (
                        <span className="inline-flex items-center gap-0.5">
                          <Bell className="size-3" /> {h.remindAt}
                        </span>
                      )}
                      <span className="md:hidden">
                        {wp.done}/{wp.target} this week
                      </span>
                    </div>
                  </button>
                  <div className="col-span-2 row-start-2 flex gap-1.5 md:col-span-1 md:row-start-auto">
                    {week.map((d) => {
                      const date = ymd(d);
                      return (
                        <DayCell
                          key={date}
                          habit={h}
                          date={date}
                          status={byDate.get(date)?.status}
                          scheduled={isScheduled(h, date)}
                          isToday={date === today}
                          dayLabel={format(d, 'EEEE d MMM')}
                          large
                        />
                      );
                    })}
                  </div>
                  <span
                    className={cn(
                      'hidden text-right text-sm tabular-nums md:block',
                      wp.done >= wp.target && 'text-sec-self font-medium',
                    )}
                  >
                    {wp.done}/{wp.target}
                  </span>
                  <div className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
                    <Menu
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Options for ${h.title}`}>
                          <Ellipsis className="size-4" />
                        </Button>
                      }
                      items={[
                        { label: 'History', icon: ChartNoAxesColumn, onSelect: () => setDetail(h) },
                        {
                          label: 'Edit',
                          icon: Pencil,
                          onSelect: () => setEditing({ mode: 'edit', habit: h }),
                        },
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
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {habits.length === 0 && suggestions.length === 0 && (
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
      )}
      {suggestions.length > 0 && (
        <section aria-labelledby="suggested-heading" className="mb-8">
          <h2
            id="suggested-heading"
            className="mb-3 flex items-center gap-2 text-[15px] font-semibold md:text-sm"
          >
            <Sparkles className="text-sec-misc size-4" /> Suggested for you
          </h2>
          <ul className="border-line divide-line divide-y rounded-xl border">
            {suggestions.map((p) => (
              <li key={p.title} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium md:text-sm">{p.title}</div>
                  <div className="text-muted text-xs">
                    {targetLabel({ target: p.target } as Habit)}, reminder at {p.remindAt}. {p.note}
                  </div>
                </div>
                <Button size="sm" onClick={() => openPreset(p)} aria-label={`Add ${p.title}`}>
                  <Plus className="size-4" /> Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && <HabitSheet editing={editing} onClose={() => setEditing(null)} />}
      {detail && (
        <HabitDetail
          habit={detail}
          logs={logsByDate(logs, detail.id)}
          today={today}
          weekStartsOn={weekStartsOn}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
