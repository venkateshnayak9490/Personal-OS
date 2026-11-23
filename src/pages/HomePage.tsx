import { endOfDay, format, startOfWeek } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { useNow } from '@/app/use-now';
import { useUIStore } from '@/app/ui-store';
import { PageHeader } from '@/components/PageHeader';
import { BlockHeader, Button, Loading } from '@/components/ui';
import { useAllTasks, useEvents, useProfile } from '@/core/hooks';
import { occurrences } from '@/core/domain/events';
import { isClosed, isOverdue, toLocalDate } from '@/core/domain/tasks';
import type { TreeNode } from '@/core/domain/tree';
import { CheckinCard } from '@/features/life/Checkin';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';
import { SearchButton } from './ListPages';

/** Per section, counting everything nested inside it: open tasks, and tasks finished this week. */
function useSectionCounts(tree: NodeTree | undefined, weekStart: number) {
  const tasks = useAllTasks();
  return useMemo(() => {
    const open = new Map<string, number>();
    const done = new Map<string, number>();
    const add = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
    for (const t of tasks ?? []) {
      if (!t.nodeId || t.parentTaskId) continue;
      if (!isClosed(t.status)) add(open, t.nodeId);
      else if (t.status === 'completed' && (t.completedAt ?? 0) >= weekStart) add(done, t.nodeId);
    }
    const totals = { open: new Map<string, number>(), done: new Map<string, number>() };
    const walk = (n: TreeNode): [number, number] => {
      const sums = n.children.map(walk);
      const o = (open.get(n.node.id) ?? 0) + sums.reduce((a, s) => a + s[0], 0);
      const d = (done.get(n.node.id) ?? 0) + sums.reduce((a, s) => a + s[1], 0);
      totals.open.set(n.node.id, o);
      totals.done.set(n.node.id, d);
      return [o, d];
    };
    tree?.visibleTree.forEach(walk);
    return totals;
  }, [tasks, tree, weekStart]);
}

/** The next timed event today and what is due: a glance, with the work itself on Today. */
function NextUp() {
  const events = useEvents();
  const tasks = useAllTasks();
  const profile = useProfile();
  const now = useNow();
  if (!events || !tasks) return null;
  const today = toLocalDate(now);
  const next = events
    .flatMap((e) => occurrences(e, now, endOfDay(now).getTime()))
    .filter((o) => !o.event.allDay && o.end > now)
    .sort((a, b) => a.start - b.start)[0];
  const open = tasks.filter((t) => !t.parentTaskId && !isClosed(t.status));
  const overdue = open.filter((t) => isOverdue(t, now, profile?.timezone)).length;
  // Same rule as Today: a task that is already overdue is not also "due today".
  const dueToday = open.filter((t) => t.dueDate === today && !isOverdue(t, now, profile?.timezone)).length;
  const mins = next ? Math.max(0, Math.round((next.start - now) / 60_000)) : 0;
  const inLabel = !next
    ? ''
    : next.start <= now
      ? 'now'
      : mins < 60
        ? `in ${mins} m`
        : `in ${Math.floor(mins / 60)} h ${mins % 60} m`;

  return (
    <section aria-labelledby="next-heading" className="mb-10">
      <BlockHeader
        id="next-heading"
        title="Next up"
        action={
          <Link to="/" className="hover:text-fg">
            Open Today
          </Link>
        }
      />
      <ul className="divide-line divide-y">
        <li className="flex items-start gap-4 py-2.5">
          <span className="w-20 shrink-0">
            <span className="block font-semibold">{next ? format(next.start, 'HH:mm') : 'Today'}</span>
            <span className="text-meta text-muted block">{next ? inLabel : 'events'}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {next ? next.event.title : 'No more events today'}
            </span>
            {next?.event.location && (
              <span className="text-meta text-muted block truncate">{next.event.location}</span>
            )}
          </span>
        </li>
        <li>
          <Link to="/" className="hover:bg-surface-2/60 flex items-start gap-4 py-2.5">
            <span className="w-20 shrink-0">
              <span className="block font-semibold">Tasks</span>
              <span className="text-meta text-muted block">today</span>
            </span>
            <span className="min-w-0 flex-1 font-medium">
              {dueToday ? `${dueToday} due today` : 'Nothing due today'}
              {overdue > 0 && <span className="text-danger">, {overdue} overdue</span>}
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/**
 * Home: how you are (check-in), what's next, and your week across every section as one ruled map.
 * Today is where the work happens; Home is the overview. The app opens on Today.
 */
export function HomePage() {
  const tree = useNodeTree();
  const profile = useProfile();
  const now = useNow();
  const weekStart = startOfWeek(now, { weekStartsOn: profile?.weekStartsOn ?? 1 }).getTime();
  const counts = useSectionCounts(tree, weekStart);
  const mapHidden = useUIStore((s) => s.homeMapHidden);
  const toggleMap = useUIStore((s) => s.toggleHomeMap);
  if (!tree) return <Loading />;
  const areas = tree.visibleTree;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={new Date(now).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        actions={
          // Phones: search lives here and on More (desktop has it in the sidebar and Ctrl+K).
          <span className="md:hidden">
            <SearchButton compact />
          </span>
        }
      />

      <section aria-labelledby="checkin-heading" className="mb-10">
        <BlockHeader id="checkin-heading" title="Check-in" />
        <div className="mt-3">
          <CheckinCard />
        </div>
      </section>

      <NextUp />

      <section aria-labelledby="map-heading" className="mb-10">
        <BlockHeader
          id="map-heading"
          title="Your sections this week"
          action={
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={!mapHidden}
              onClick={toggleMap}
              className="-my-1.5"
            >
              <ChevronDown className={cn('size-4 transition-transform', mapHidden && '-rotate-90')} />
              {mapHidden ? 'Show' : 'Hide'}
            </Button>
          }
        />
        {!mapHidden && (
          // A ruled table: one column per area, its head carrying the area's colour as a rule.
          <div className="border-line bg-surface mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border md:grid-cols-4">
            {areas.map(({ node, children }, i) => {
              const c = colorFor(tree.colorOf(node.id));
              const open = counts.open.get(node.id) ?? 0;
              const done = counts.done.get(node.id) ?? 0;
              return (
                <div
                  key={node.id}
                  className={cn(
                    'border-line min-w-0 px-3.5 pt-2.5 pb-3',
                    i % 2 === 1 && 'border-l',
                    i >= 2 && 'max-md:border-t',
                    'md:border-l md:first:border-l-0',
                  )}
                >
                  <Link to={nodePath(node.id)} className="flex items-center gap-2 hover:underline">
                    <NodeIcon name={node.icon} className="text-muted size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-bold">{node.title}</span>
                  </Link>
                  <p className="text-meta text-muted mt-0.5">
                    {open} open{done ? `, ${done} done this week` : ''}
                  </p>
                  <span aria-hidden className={cn('mt-2 block h-0.5', c.dot)} />
                  <ul>
                    {children.map((ch) => (
                      <li key={ch.node.id}>
                        <SectionRow t={ch} counts={counts.open} />
                        {ch.children.map((g) => (
                          <SectionRow key={g.node.id} t={g} counts={counts.open} nested />
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function SectionRow({ t, counts, nested }: { t: TreeNode; counts: Map<string, number>; nested?: boolean }) {
  const n = counts.get(t.node.id) ?? 0;
  return (
    <Link
      to={nodePath(t.node.id)}
      className={cn(
        'border-line hover:bg-surface-2/60 flex min-h-11 items-center gap-2 border-b text-[15px] md:min-h-8 md:text-sm',
        nested && 'text-muted pl-3',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{t.node.title}</span>
      {n > 0 && <span className="text-meta text-muted">{n}</span>}
    </Link>
  );
}
