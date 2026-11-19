import { Flame, Minus, Pencil, Plus, Sparkles, Target, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { DateButton, DatePicker, dateChipLabel } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import {
  Button,
  EmptyState,
  Field,
  Input,
  Loading,
  ProgressBar,
  Select,
  Textarea,
  SaveHint,
} from '@/components/ui';
import {
  useAllTasks,
  useCollections,
  useFocusSessions,
  useGoals,
  useHabitLogs,
  useHabits,
  useMilestones,
  useProfile,
  useProjects,
  useRecords,
  useWorkouts,
  useWritingLogs,
} from '@/core/hooks';
import { isAutomatic, measuredCurrent, type GoalData } from '@/core/domain/goals';
import { habitConsistency, pct } from '@/core/domain/analytics';
import { goalProgress, logsByDate, projectProgress, streak } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
import type { Goal, GoalStatus } from '@/core/domain/types';
import { createGoal, deleteGoal, updateGoal, updateHabit } from '@/core/repos/plans';
import { restoreFromTrash } from '@/core/repos/trash';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { projectPath } from './ProjectsPage';

const STATUS: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  achieved: 'Achieved',
  dropped: 'Dropped',
};

type Preset = Pick<Goal, 'title' | 'measure'> & { habit: string };
type Editing = { mode: 'create'; preset?: Preset } | { mode: 'edit'; goal: Goal } | null;

/** Small long-term goals that grow out of the suggested habits (each check-in counts one). */
const SUGGESTED: Preset[] = [
  {
    title: 'Read 100 research papers',
    habit: 'Read a research paper',
    measure: { label: 'papers', current: 0, target: 100, fromHabits: true },
  },
  {
    title: '150 days of DSA practice',
    habit: 'DSA practice',
    measure: { label: 'days', current: 0, target: 150, fromHabits: true },
  },
  {
    title: '120 gym sessions this year',
    habit: 'Gym',
    measure: { label: 'sessions', current: 0, target: 120, fromHabits: true },
  },
  {
    title: '100 days of placement prep',
    habit: 'Placement prep',
    measure: { label: 'days', current: 0, target: 100, fromHabits: true },
  },
  { title: 'Finish 12 books', habit: 'Read a book', measure: { label: 'books', current: 0, target: 12 } },
];

type Counts = 'manual' | 'habits' | NonNullable<NonNullable<Goal['measure']>['source']>['kind'];

const COUNTS: { value: Counts; label: string }[] = [
  { value: 'manual', label: 'By hand (+ and −)' },
  { value: 'habits', label: 'Check-ins of the habits below' },
  { value: 'workouts', label: 'Finished workouts' },
  { value: 'words', label: 'Thesis words written' },
  { value: 'focus', label: 'Focus hours' },
  { value: 'list', label: 'Items in a list status' },
];

/** The goal's measure, with `current` filled in when it counts itself. */
function liveMeasure(g: Goal, d: GoalData) {
  if (!g.measure || !isAutomatic(g)) return g.measure;
  return { ...g.measure, current: measuredCurrent(g, d) };
}

function GoalSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const g = editing.mode === 'edit' ? editing.goal : undefined;
  const preset = editing.mode === 'create' ? editing.preset : undefined;
  const src = g ?? preset;
  const profile = useProfile();
  const habits = useHabits();
  const [title, setTitle] = useState(src?.title ?? '');
  const [why, setWhy] = useState(g?.why ?? '');
  const [nodeId, setNodeId] = useState(g?.nodeId);
  const [targetDate, setTargetDate] = useState(g?.targetDate ?? '');
  const [status, setStatus] = useState<GoalStatus>(g?.status ?? 'active');
  const [label, setLabel] = useState(src?.measure?.label ?? '');
  const [current, setCurrent] = useState(String(src?.measure?.current ?? 0));
  const [target, setTarget] = useState(src?.measure?.target ? String(src.measure.target) : '');
  const lists = useCollections();
  const [counts, setCounts] = useState<Counts>(
    src?.measure?.fromHabits ? 'habits' : (src?.measure?.source?.kind ?? 'manual'),
  );
  const srcList = src?.measure?.source?.kind === 'list' ? src.measure.source : undefined;
  const [listId, setListId] = useState(srcList?.collectionId ?? '');
  const [listStatus, setListStatus] = useState(srcList?.status ?? '');
  const list = lists?.find((c) => c.id === listId);
  // Habits that build this goal (the link lives on the habit). Undefined until the user changes it.
  const [picked, setPicked] = useState<Set<string>>();
  const linked =
    picked ??
    new Set(
      (habits ?? [])
        .filter((h) => (g ? h.goalId === g.id : h.title.toLowerCase() === preset?.habit.toLowerCase()))
        .map((h) => h.id),
    );

  const submit = async () => {
    const t = Number(target);
    const measure =
      t > 0
        ? {
            label: label.trim() || 'Progress',
            current: Number(current) || 0,
            target: t,
            ...(counts === 'habits' && { fromHabits: true }),
            ...((counts === 'workouts' || counts === 'words' || counts === 'focus') && {
              source: { kind: counts },
            }),
            ...(counts === 'list' &&
              list && {
                source: {
                  kind: 'list' as const,
                  collectionId: list.id,
                  status: listStatus || list.statusOptions.at(-1)!,
                },
              }),
          }
        : undefined;
    const fields = {
      title,
      why: why.trim() || undefined,
      nodeId,
      targetDate: targetDate || undefined,
      measure,
    };
    const ok = await attempt(async () => {
      const id = g ? (await updateGoal(g.id, { ...fields, status }), g.id) : (await createGoal(fields)).id;
      for (const h of habits ?? []) {
        if (linked.has(h.id) && h.goalId !== id) await updateHabit(h.id, { goalId: id });
        if (!linked.has(h.id) && h.goalId === id) await updateHabit(h.id, { goalId: undefined });
      }
      return true;
    });
    if (ok !== undefined) onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={g ? 'Edit goal' : 'New goal'}
      footer={
        <>
          <SaveHint>{!title.trim() && 'Give it a name'}</SaveHint>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={() => void submit()}>
            {g ? 'Save' : 'Create'}
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
        <Field label="Goal" htmlFor="g-title">
          <Input
            id="g-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Submit a paper to CoRL"
          />
        </Field>
        <Field label="Why it matters (optional)" htmlFor="g-why">
          <Textarea id="g-why" value={why} onChange={(e) => setWhy(e.target.value)} className="min-h-16" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Section" htmlFor="g-node">
            <SectionSelect id="g-node" value={nodeId} onChange={setNodeId} />
          </Field>
          <Field label="Target date">
            <DatePicker value={targetDate} onChange={setTargetDate} weekStartsOn={profile?.weekStartsOn}>
              <DateButton label="Goal target date" value={targetDate} />
            </DatePicker>
          </Field>
        </div>
        <fieldset className="border-line rounded-xl border p-3">
          <legend className="text-muted px-1 text-xs font-medium">Measure it (optional)</legend>
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            <Input
              aria-label="What you count"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Papers read"
            />
            <Input
              aria-label="Current"
              type="number"
              min={0}
              value={current}
              disabled={counts !== 'manual'}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Input
              aria-label="Target"
              type="number"
              min={0}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target"
            />
          </div>
          <Field label="Counts" htmlFor="g-counts" className="mt-2">
            <Select id="g-counts" value={counts} onChange={(e) => setCounts(e.target.value as Counts)}>
              {COUNTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {counts === 'list' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select
                aria-label="List"
                value={listId}
                onChange={(e) => {
                  setListId(e.target.value);
                  setListStatus('');
                }}
              >
                <option value="">Pick a list</option>
                {(lists ?? [])
                  .filter((c) => !c.deletedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <Select
                aria-label="Status"
                value={listStatus || (list?.statusOptions.at(-1) ?? '')}
                disabled={!list}
                onChange={(e) => setListStatus(e.target.value)}
              >
                {(list?.statusOptions ?? []).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {counts !== 'manual' && counts !== 'habits' && counts !== 'list' && (
            <p className="text-muted mt-2 text-xs">Counted from the day you create the goal.</p>
          )}
          <p className="text-muted mt-2 text-xs">
            Without a measure, progress comes from the goal’s projects.
          </p>
        </fieldset>
        {!!habits?.length && (
          <fieldset className="border-line rounded-xl border p-3">
            <legend className="text-muted px-1 text-xs font-medium">Habits that build this goal</legend>
            <div className="flex flex-wrap gap-2">
              {habits.map((h) => {
                const on = linked.has(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = new Set(linked);
                      if (on) next.delete(h.id);
                      else next.add(h.id);
                      setPicked(next);
                    }}
                    className={cn(
                      'min-h-9 rounded-full border px-3 text-sm',
                      on ? 'border-fg bg-fg text-bg' : 'border-line text-muted hover:text-fg',
                    )}
                  >
                    {h.title}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {g && (
          <Field label="Status" htmlFor="g-status">
            <Select id="g-status" value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {(Object.keys(STATUS) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS[s]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

export function GoalsPage() {
  const goals = useGoals();
  const projects = useProjects();
  const tasks = useAllTasks();
  const milestones = useMilestones();
  const habits = useHabits();
  const logs = useHabitLogs('2000-01-01');
  const workouts = useWorkouts();
  const writing = useWritingLogs();
  const focus = useFocusSessions(0);
  const records = useRecords();
  const profile = useProfile();
  const t = useNodeTree();
  const now = useNow();
  const [editing, setEditing] = useState<Editing>(null);

  if (!goals || !projects || !tasks || !milestones || !habits || !logs) return <Loading />;
  if (!workouts || !writing || !focus || !records) return <Loading />;
  const data: GoalData = { habits, habitLogs: logs, workouts, writing, focus, records };
  const today = toLocalDate(now, profile?.timezone);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const thirtyAgo = toLocalDate(now - 29 * 86_400_000, profile?.timezone);
  // Ideas help you start; once you have a goal they stay out of the way.
  const suggestions = goals.length ? [] : SUGGESTED;

  const order: GoalStatus[] = ['active', 'paused', 'achieved', 'dropped'];
  const sorted = [...goals].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <>
      <PageHeader
        title="Goals"
        icon={Target}
        subtitle="Small long-term goals, built by your habits and projects."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: 'create' })}>
            <Plus className="size-4" /> New goal
          </Button>
        }
      />
      {sorted.length === 0 && suggestions.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          action={
            <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
              <Plus className="size-4" /> New goal
            </Button>
          }
        >
          For example “Submit a paper to CoRL” or “Read 30 papers this semester”.
        </EmptyState>
      ) : (
        <ul className="mb-8 space-y-3">
          {sorted.map((g) => {
            const linked = projects.filter((p) => p.goalId === g.id);
            const pcts = linked.map((p) => projectProgress(p, tasks, milestones).pct);
            const measure = liveMeasure(g, data);
            const prog = goalProgress({ ...g, measure }, pcts);
            const linkedHabits = habits.filter((h) => h.goalId === g.id);
            const node = g.nodeId ? t?.byId.get(g.nodeId) : undefined;
            const done = g.status === 'achieved' || g.status === 'dropped';
            return (
              <li key={g.id} className={cn('border-line rounded-xl border p-4', done && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h2 className={cn('text-base font-semibold', g.status === 'dropped' && 'line-through')}>
                        {g.title}
                      </h2>
                      <span className="text-muted text-xs">
                        {STATUS[g.status]}
                        {node ? ` · ${node.title}` : ''}
                        {g.targetDate ? ` · by ${dateChipLabel(g.targetDate, now)}` : ''}
                      </span>
                    </div>
                    {g.why && <p className="text-muted mt-1 text-sm">{g.why}</p>}
                  </div>
                  <Menu
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Options for ${g.title}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                    items={[
                      { label: 'Edit', icon: Pencil, onSelect: () => setEditing({ mode: 'edit', goal: g }) },
                      ...(g.status !== 'achieved'
                        ? [
                            {
                              label: 'Mark achieved',
                              icon: Target,
                              onSelect: () => void attempt(() => updateGoal(g.id, { status: 'achieved' })),
                            },
                          ]
                        : []),
                      null,
                      {
                        label: 'Delete',
                        icon: Trash,
                        danger: true,
                        onSelect: () =>
                          void attempt(async () => {
                            const b = await deleteGoal(g.id);
                            if (b) toast(`Moved “${g.title}” to Trash`, () => restoreFromTrash(b));
                          }),
                      },
                    ]}
                  />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar pct={prog.pct} label={`${g.title} progress`} className="flex-1" />
                  {measure && isAutomatic(g) ? (
                    <span className="min-w-20 text-center text-xs tabular-nums">
                      {measure.current}/{measure.target} {measure.label}
                    </span>
                  ) : g.measure ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Decrease ${g.measure.label}`}
                        onClick={() =>
                          void attempt(() =>
                            updateGoal(g.id, {
                              measure: { ...g.measure!, current: Math.max(0, g.measure!.current - 1) },
                            }),
                          )
                        }
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="min-w-20 text-center text-xs tabular-nums">
                        {g.measure.current}/{g.measure.target} {g.measure.label}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Increase ${g.measure.label}`}
                        onClick={() =>
                          void attempt(() =>
                            updateGoal(g.id, { measure: { ...g.measure!, current: g.measure!.current + 1 } }),
                          )
                        }
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted text-xs tabular-nums">
                      {linked.length
                        ? `${prog.pct}% across ${linked.length} project${linked.length > 1 ? 's' : ''}`
                        : 'Link a project or add a measure'}
                    </span>
                  )}
                </div>

                {(linked.length > 0 || linkedHabits.length > 0) && (
                  <div className="text-muted mt-3 flex flex-wrap gap-2 text-xs">
                    {linked.map((p, i) => (
                      <Link
                        key={p.id}
                        to={projectPath(p.id)}
                        className="border-line hover:text-fg rounded-full border px-2.5 py-1"
                      >
                        {p.title} · {pcts[i]}%
                      </Link>
                    ))}
                    {linkedHabits.map((h) => {
                      const byDate = logsByDate(logs, h.id);
                      const c = habitConsistency(h, byDate, thirtyAgo, today, today, weekStartsOn);
                      const s = streak(h, byDate, today, weekStartsOn);
                      return (
                        <Link
                          key={h.id}
                          to="/habits"
                          className="border-line hover:text-fg inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                        >
                          Habit: {h.title}
                          {c.target > 0 && <span>· {pct(c.done / c.target)} last 30 days</span>}
                          {s > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Flame className="text-warning size-3" /> {s}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {suggestions.length > 0 && (
        <section aria-labelledby="goal-ideas" className="mb-8">
          <h2 id="goal-ideas" className="title-block mb-3 flex items-center gap-2">
            <Sparkles className="text-warning size-4" /> Goal ideas that grow from your habits
          </h2>
          <ul className="border-line divide-line divide-y rounded-xl border">
            {suggestions.map((p) => (
              <li key={p.title} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium md:text-sm">{p.title}</div>
                  <div className="text-muted text-xs">
                    Built by: {p.habit}
                    {p.measure?.fromHabits ? ', each check-in counts' : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  aria-label={`Add goal ${p.title}`}
                  onClick={() => setEditing({ mode: 'create', preset: p })}
                >
                  <Plus className="size-4" /> Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && <GoalSheet editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
