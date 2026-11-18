import { Minus, Pencil, Plus, Target, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { DateButton, DatePicker, dateChipLabel } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { Button, EmptyState, Field, Input, Loading, ProgressBar, Select, Textarea } from '@/components/ui';
import { useAllTasks, useGoals, useHabits, useMilestones, useProfile, useProjects } from '@/core/hooks';
import { goalProgress, projectProgress } from '@/core/domain/progress';
import type { Goal, GoalStatus } from '@/core/domain/types';
import { createGoal, deleteGoal, updateGoal } from '@/core/repos/plans';
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

type Editing = { mode: 'create' } | { mode: 'edit'; goal: Goal } | null;

function GoalSheet({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const g = editing.mode === 'edit' ? editing.goal : undefined;
  const profile = useProfile();
  const [title, setTitle] = useState(g?.title ?? '');
  const [why, setWhy] = useState(g?.why ?? '');
  const [nodeId, setNodeId] = useState(g?.nodeId);
  const [targetDate, setTargetDate] = useState(g?.targetDate ?? '');
  const [status, setStatus] = useState<GoalStatus>(g?.status ?? 'active');
  const [label, setLabel] = useState(g?.measure?.label ?? '');
  const [current, setCurrent] = useState(String(g?.measure?.current ?? 0));
  const [target, setTarget] = useState(g?.measure?.target ? String(g.measure.target) : '');

  const submit = async () => {
    const t = Number(target);
    const measure =
      t > 0 ? { label: label.trim() || 'Progress', current: Number(current) || 0, target: t } : undefined;
    const fields = {
      title,
      why: why.trim() || undefined,
      nodeId,
      targetDate: targetDate || undefined,
      measure,
    };
    const ok = await attempt(async () => {
      if (g) await updateGoal(g.id, { ...fields, status });
      else await createGoal(fields);
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
          <p className="text-muted mt-2 text-xs">
            Without a measure, progress comes from the goal’s projects.
          </p>
        </fieldset>
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
  const t = useNodeTree();
  const now = useNow();
  const [editing, setEditing] = useState<Editing>(null);

  if (!goals || !projects || !tasks || !milestones || !habits) return <Loading />;

  const order: GoalStatus[] = ['active', 'paused', 'achieved', 'dropped'];
  const sorted = [...goals].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <>
      <PageHeader
        title="Goals"
        icon={Target}
        subtitle="What you’re working toward. Projects and habits can count toward a goal."
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: 'create' })}>
            <Plus className="size-4" /> New goal
          </Button>
        }
      />
      {sorted.length === 0 ? (
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
        <ul className="space-y-3">
          {sorted.map((g) => {
            const linked = projects.filter((p) => p.goalId === g.id);
            const pcts = linked.map((p) => projectProgress(p, tasks, milestones).pct);
            const prog = goalProgress(g, pcts);
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
                  {g.measure ? (
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
                    {linkedHabits.map((h) => (
                      <Link
                        key={h.id}
                        to="/habits"
                        className="border-line hover:text-fg rounded-full border px-2.5 py-1"
                      >
                        Habit: {h.title}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <GoalSheet editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
