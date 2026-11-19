import { addDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns';
import { BookOpen, ChartColumn, ChevronLeft, ChevronRight, Dumbbell, HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNow } from '@/app/use-now';
import { PageHeader } from '@/components/PageHeader';
import { Button, Loading, ProgressBar, Segmented } from '@/components/ui';
import { db } from '@/core/db';
import {
  useAllTasks,
  useChapters,
  useCheckins,
  useFocusSessions,
  useHabitLogs,
  useHabits,
  useProfile,
  useWorkouts,
  useWorkoutSets,
  useWritingLogs,
} from '@/core/hooks';
import { planOf } from '@/core/domain/health';
import { gymStats, healthStats, thesisStats } from '@/core/domain/life-stats';
import {
  closedTasks,
  completionsByDay,
  eachDay,
  habitConsistency,
  pct,
  periodLabel,
  periodOf,
  taskStats,
  type PeriodKind,
} from '@/core/domain/analytics';
import { focusMinutes, hm } from '@/core/domain/focus';
import { logsByDate, streak } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
import { descendantIds, type TreeNode } from '@/core/domain/tree';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { Heatmap } from '@/features/analytics/Heatmap';

const KINDS: { value: Exclude<PeriodKind, 'day'>; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const HEAT_WEEKS = 53;

export function AnalyticsPage() {
  const now = useNow();
  const profile = useProfile();
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const [kind, setKind] = useState<Exclude<PeriodKind, 'day'>>('week');
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState<string | null>(null);
  const period = periodOf(kind, new Date(now), offset, weekStartsOn);
  const heatFrom = format(startOfWeek(subWeeks(now, HEAT_WEEKS - 1), { weekStartsOn }), 'yyyy-MM-dd');
  const since = period.from < heatFrom ? period.from : heatFrom;

  const tasks = useAllTasks();
  const habits = useHabits();
  const habitLogs = useHabitLogs(since);
  const sessions = useFocusSessions(parseISO(since).getTime());
  const skips = useLiveQuery(() => db.activityLog.where('action').equals('skipped').toArray(), []);
  const t = useNodeTree();
  // Life sections: Gym, Health, Thesis (shown when there's something to show).
  const workouts = useWorkouts();
  const workoutSets = useWorkoutSets();
  const checkins = useCheckins(period.from);
  const chapters = useChapters();
  const writing = useWritingLogs();

  const closed = useMemo(() => (tasks && skips ? closedTasks(tasks, skips) : []), [tasks, skips]);

  if (!tasks || !habits || !habitLogs || !sessions || !skips || !t) return <Loading />;

  const today = toLocalDate(now);
  const ids = (id: string) => new Set([id, ...descendantIds(t.nodes, id)]);
  const scopeIds = scope ? ids(scope) : null;
  const inScope = (nodeId?: string) => !scopeIds || (!!nodeId && scopeIds.has(nodeId));

  const sTasks = tasks.filter((x) => inScope(x.nodeId));
  const sClosed = closed.filter((c) => inScope(c.task.nodeId));
  const sHabits = habits.filter((h) => inScope(h.nodeId));
  const sSessions = sessions.filter((s) => inScope(s.nodeId));
  const stats = taskStats(sTasks, sClosed, period.from, period.to, today);
  const start = parseISO(period.from).getTime();
  const end = addDays(parseISO(period.to), 1).getTime();
  const focus = focusMinutes(sSessions, start, end);
  const habitRows = sHabits.map((h) => {
    const logs = logsByDate(habitLogs, h.id);
    return {
      h,
      ...habitConsistency(h, logs, period.from, period.to, today, weekStartsOn),
      streak: streak(h, logs, today, weekStartsOn),
    };
  });
  const hDone = habitRows.reduce((a, r) => a + r.done, 0);
  const hTarget = habitRows.reduce((a, r) => a + r.target, 0);

  // Bars: per day (week, month) or per month (year).
  const byDay = completionsByDay(sClosed);
  const barsOf = (byDay: Map<string, number>) =>
    kind === 'year'
      ? Array.from({ length: 12 }, (_, m) => {
          const key = `${period.from.slice(0, 4)}-${String(m + 1).padStart(2, '0')}`;
          let n = 0;
          for (const [d, c] of byDay) if (d.startsWith(key)) n += c;
          return {
            key,
            label: format(parseISO(`${key}-01`), 'MMM'),
            tip: format(parseISO(`${key}-01`), 'MMMM'),
            n,
          };
        })
      : eachDay(period.from, period.to).map((d) => ({
          key: d,
          label: kind === 'week' ? format(parseISO(d), 'EEE') : format(parseISO(d), 'd'),
          tip: format(parseISO(d), 'EEE d MMM'),
          n: byDay.get(d) ?? 0,
        }));
  const bars = barsOf(byDay);

  // Life sections, in scope (everything, or a scope that contains them).
  const nodeOf = (key: string) => t.nodes.find((n) => n.moduleKey === key && !n.deletedAt);
  const shows = (key: string) => {
    const n = nodeOf(key);
    return !!n && (!scopeIds || scopeIds.has(n.id));
  };
  const gymHabit = habits.find((h) => h.source === 'gym' && !h.deletedAt);
  const gym =
    shows('fitness') && workouts && workoutSets
      ? gymStats(workouts, workoutSets, gymHabit, habitLogs, period.from, period.to, today)
      : null;
  const plan = planOf(profile?.settings);
  const health =
    shows('health') && checkins && plan ? healthStats(plan, checkins, period.from, period.to) : null;
  const thesis =
    shows('thesis') && chapters?.some((c) => !c.deletedAt) && writing
      ? thesisStats(writing, chapters, period.from, period.to)
      : null;
  const pctOf = (n: number, of: number) => (of ? pct(n / of) : '—');

  // Drill-down rows: the sections inside the current scope.
  const children: TreeNode[] = scope ? (find(t.tree, scope)?.children ?? []) : t.visibleTree;
  const rows = children.map(({ node }) => {
    const set = ids(node.id);
    const s = taskStats(
      tasks.filter((x) => x.nodeId && set.has(x.nodeId)),
      closed.filter((c) => c.task.nodeId && set.has(c.task.nodeId)),
      period.from,
      period.to,
      today,
    );
    const f = focusMinutes(
      sessions.filter((x) => x.nodeId && set.has(x.nodeId)),
      start,
      end,
    );
    return { node, s, f };
  });

  return (
    <>
      <PageHeader
        title="Analytics"
        icon={ChartColumn}
        subtitle="Only completed counts as done. Skipped and missed are shown, never hidden."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented
          as="tabs"
          full
          label="Period"
          options={KINDS}
          value={kind}
          onChange={(v) => {
            setKind(v);
            setOffset(0);
          }}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Previous period"
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium max-md:flex-1">
            {periodLabel(period)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-md:size-10"
            aria-label="Next period"
            disabled={offset >= 0}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {offset !== 0 && (
          <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
            Back to now
          </Button>
        )}
      </div>

      <nav aria-label="Scope" className="text-muted mb-6 flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setScope(null)}
          className={cn('hover:text-fg', !scope && 'text-fg font-medium')}
        >
          Everything
        </button>
        {scope &&
          t.path(scope).map((n, i, a) => (
            <span key={n.id} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <button
                type="button"
                onClick={() => setScope(n.id)}
                className={cn('hover:text-fg', i === a.length - 1 && 'text-fg font-medium')}
              >
                {n.title}
              </button>
            </span>
          ))}
      </nav>

      <dl className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Completed" value={String(stats.completed)} />
        <Tile
          label="Completion rate"
          value={pct(stats.rate)}
          hint={`${stats.skipped} skipped · ${stats.missed} missed`}
        />
        <Tile label="Deep work" value={hm(focus)} />
        <Tile
          label="Habits"
          value={hTarget ? pct(hDone / hTarget) : '—'}
          hint={hTarget ? `${hDone} of ${hTarget} done` : 'No habits here'}
        />
      </dl>

      <section aria-labelledby="an-bars" className="mb-10">
        <h2 id="an-bars" className="title-block mb-3">
          Tasks completed per {kind === 'year' ? 'month' : 'day'}
        </h2>
        <Bars bars={bars} />
      </section>

      <section aria-labelledby="an-heat" className="mb-10">
        <h2 id="an-heat" className="title-block mb-3">
          Last 12 months
        </h2>
        <Heatmap byDay={byDay} from={heatFrom} today={today} label="tasks completed in the last 12 months" />
      </section>

      {rows.length > 0 && (
        <section aria-labelledby="an-sections" className="mb-10">
          <h2 id="an-sections" className="title-block mb-3">
            By section
          </h2>
          <table className="w-full text-sm">
            <thead className="text-muted border-line border-b text-left text-xs">
              <tr>
                <th scope="col" className="py-2 font-medium">
                  Section
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Completed
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Deep work
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {rows.map(({ node, s, f }) => (
                <tr key={node.id}>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => setScope(node.id)}
                      className="font-medium hover:underline"
                    >
                      {node.title}
                    </button>
                  </td>
                  <td className="py-2 text-right tabular-nums">{s.completed}</td>
                  <td className="py-2 text-right tabular-nums">{pct(s.rate)}</td>
                  <td className="py-2 text-right tabular-nums">{f ? hm(f) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(gym || health || thesis) && (
        <div className="mb-10 grid gap-4 lg:grid-cols-2">
          {gym && (gym.workouts > 0 || gym.plan?.planned) ? (
            <LifeCard title="Gym" icon={Dumbbell} to={nodePath(nodeOf('fitness')!.id)}>
              <dl className="grid grid-cols-2 gap-3">
                <Tile label="Workouts" value={String(gym.workouts)} />
                <Tile
                  label="Planned days done"
                  value={gym.plan?.pct === null || !gym.plan ? '—' : `${gym.plan.pct}%`}
                  hint={
                    gym.plan
                      ? `${gym.plan.done} of ${gym.plan.planned} · ${gym.plan.skipped} skipped · ${gym.plan.missed} missed`
                      : 'No Gym habit'
                  }
                />
                {/* Tiles for things you haven't logged in this period stay hidden. */}
                {gym.minutes > 0 && <Tile label="Time trained" value={hm(gym.minutes)} />}
                {gym.cardio.minutes > 0 && (
                  <Tile
                    label="Cardio"
                    value={`${gym.cardio.minutes} min`}
                    hint={gym.cardio.km ? `${gym.cardio.km} km` : undefined}
                  />
                )}
              </dl>
              <h3 className="mt-4 mb-2 text-xs font-medium">
                Workouts per {kind === 'year' ? 'month' : 'day'}
              </h3>
              <Bars bars={barsOf(gym.perDay)} unit="workouts" empty="No workouts in this period." />
            </LifeCard>
          ) : null}
          {health && health.days > 0 ? (
            <LifeCard title="Health" icon={HeartPulse} to={nodePath(nodeOf('health')!.id)}>
              <dl className="grid grid-cols-2 gap-3">
                {health.sleepAvg !== null && (
                  <Tile
                    label="Average sleep"
                    value={`${health.sleepAvg} h`}
                    hint={`${health.days} day${health.days === 1 ? '' : 's'} logged`}
                  />
                )}
                {health.onTime.wake.logged > 0 && (
                  <Tile
                    label="Up on time"
                    value={pctOf(health.onTime.wake.onTime, health.onTime.wake.logged)}
                    hint={`${health.onTime.wake.logged} logged`}
                  />
                )}
                {health.onTime.bed.logged > 0 && (
                  <Tile
                    label="Bed on time"
                    value={pctOf(health.onTime.bed.onTime, health.onTime.bed.logged)}
                    hint={`${health.onTime.bed.logged} logged`}
                  />
                )}
                {health.meals.logged > 0 && (
                  <Tile
                    label="Meals on time"
                    value={pctOf(health.meals.onTime, health.meals.logged)}
                    hint={`${health.meals.logged} logged`}
                  />
                )}
                {health.onTime.water.logged > 0 && (
                  <Tile
                    label="Water goal met"
                    value={pctOf(health.onTime.water.onTime, health.onTime.water.logged)}
                    hint={`${health.onTime.water.onTime} of ${health.onTime.water.logged} days`}
                  />
                )}
                {health.routines.due > 0 && (
                  <Tile
                    label="Plan items done"
                    value={pctOf(health.routines.marked, health.routines.due)}
                    hint={`${health.routines.marked} of ${health.routines.due}`}
                  />
                )}
              </dl>
            </LifeCard>
          ) : null}
          {thesis ? (
            <LifeCard title="Thesis" icon={BookOpen} to={nodePath(nodeOf('thesis')!.id)}>
              <dl className="grid grid-cols-2 gap-3">
                <Tile
                  label="Words written"
                  value={`${thesis.words > 0 ? '+' : ''}${thesis.words.toLocaleString()}`}
                  hint="Net change (edits that cut words count too)"
                />
                <Tile
                  label="Writing sessions"
                  value={String(thesis.sessions)}
                  hint={`on ${thesis.days} day${thesis.days === 1 ? '' : 's'}`}
                />
                {thesis.minutes > 0 && <Tile label="Writing time" value={hm(thesis.minutes)} />}
                <Tile
                  label="Overall"
                  value={pctOf(thesis.current, thesis.target)}
                  hint={`${thesis.current.toLocaleString()} of ${thesis.target.toLocaleString()} words`}
                />
              </dl>
            </LifeCard>
          ) : null}
        </div>
      )}

      {habitRows.length > 0 && (
        <section aria-labelledby="an-habits">
          <h2 id="an-habits" className="title-block mb-3">
            Habits
          </h2>
          <ul className="space-y-3">
            {habitRows.map((r) => (
              <li key={r.h.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{r.h.title}</span>
                  <span className="text-muted text-xs tabular-nums">
                    {r.target ? `${r.done} of ${r.target}` : 'Nothing due yet'}
                    {r.streak > 0 && ` · streak ${r.streak}`}
                  </span>
                </div>
                <ProgressBar
                  pct={r.target ? Math.round((r.done / r.target) * 100) : 0}
                  label={`${r.h.title} consistency`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function find(tree: TreeNode[], id: string): TreeNode | undefined {
  for (const n of tree) {
    if (n.node.id === id) return n;
    const hit = find(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-line rounded-2xl border px-4 py-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-muted text-xs">{hint}</dd>}
    </div>
  );
}

/** A life section's numbers for the period, with a link to the section. */
function LifeCard({
  title,
  icon: Icon,
  to,
  children,
}: {
  title: string;
  icon: typeof Dumbbell;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={`${title} analytics`} className="border-line rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="text-muted size-4" />
        <h2 className="title-block flex-1">{title}</h2>
        <Link to={to} className="text-muted text-xs hover:underline">
          Open {title}
        </Link>
      </div>
      {children}
    </section>
  );
}

/** One series: no legend, the heading names it. Hover a bar for its value. */
function Bars({
  bars,
  unit = 'completed',
  empty = 'Nothing completed in this period.',
}: {
  bars: { key: string; label: string; tip: string; n: number }[];
  unit?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.n));
  const dense = bars.length > 12;
  return (
    <div role="img" aria-label={bars.map((b) => `${b.tip}: ${b.n}`).join(', ')}>
      <div className="border-line flex h-36 items-end gap-0.5 border-b">
        {bars.map((b) => (
          <div key={b.key} title={`${b.tip}: ${b.n} ${unit}`} className="group flex h-full flex-1 items-end">
            <div
              className={cn('w-full rounded-t-[4px]', b.n ? 'bg-success group-hover:opacity-80' : '')}
              style={{ height: b.n ? `${(b.n / max) * 100}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {bars.map((b, i) => (
          <span key={b.key} className="text-muted flex-1 text-center text-[10px] tabular-nums">
            {!dense || i % 5 === 0 || i === bars.length - 1 ? b.label : ''}
          </span>
        ))}
      </div>
      {bars.some((b) => b.n) ? (
        <p className="text-muted mt-1 text-xs">Highest: {max}</p>
      ) : (
        <p className="text-muted mt-1 text-xs">{empty}</p>
      )}
    </div>
  );
}

/** GitHub-style year of completions: one hue, light to dark. */
