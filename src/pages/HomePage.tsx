import { endOfDay, format } from 'date-fns';
import { CalendarClock, ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { useMediaQuery } from '@/app/use-media-query';
import { useNow } from '@/app/use-now';
import { useUIStore } from '@/app/ui-store';
import { Button, Loading } from '@/components/ui';
import { useAllTasks, useEvents, useProfile } from '@/core/hooks';
import { occurrences } from '@/core/domain/events';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import type { TreeNode } from '@/core/domain/tree';
import { CheckinCard } from '@/features/life/Checkin';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { SearchButton } from './ListPages';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

/** Open tasks per section, counting everything nested inside it. */
function useOpenCounts(tree?: NodeTree) {
  const tasks = useAllTasks();
  return useMemo(() => {
    const direct = new Map<string, number>();
    for (const t of tasks ?? [])
      if (t.nodeId && !t.parentTaskId && !isClosed(t.status))
        direct.set(t.nodeId, (direct.get(t.nodeId) ?? 0) + 1);
    const total = new Map<string, number>();
    const walk = (n: TreeNode): number => {
      const sum = (direct.get(n.node.id) ?? 0) + n.children.reduce((a, c) => a + walk(c), 0);
      total.set(n.node.id, sum);
      return sum;
    };
    tree?.visibleTree.forEach(walk);
    return total;
  }, [tasks, tree]);
}

function Branch({ items, tree, counts }: { items: TreeNode[]; tree: NodeTree; counts: Map<string, number> }) {
  if (!items.length) return null;
  return (
    <ul className="border-line ml-4 border-l">
      {items.map(({ node, children }) => {
        const n = counts.get(node.id) ?? 0;
        return (
          <li
            key={node.id}
            className="before:bg-line relative pl-3 before:absolute before:top-[1.375rem] before:left-0 before:h-px before:w-3"
          >
            <Link
              to={nodePath(node.id)}
              className="hover:bg-surface-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[15px] md:min-h-9 md:text-sm"
            >
              <NodeIcon
                name={node.icon}
                className={cn('size-4 shrink-0', colorFor(tree.colorOf(node.id)).text)}
              />
              <span className="min-w-0 flex-1 truncate">{node.title}</span>
              {n > 0 && <span className="text-muted text-xs tabular-nums">{n}</span>}
            </Link>
            <Branch items={children} tree={tree} counts={counts} />
          </li>
        );
      })}
    </ul>
  );
}

/** The next event today, and today's open tasks: a glance, with the work itself on Today. */
function NextUp() {
  const events = useEvents();
  const tasks = useAllTasks();
  const now = useNow();
  if (!events || !tasks) return null;
  const today = toLocalDate(now);
  const next = events
    .flatMap((e) => occurrences(e, now, endOfDay(now).getTime()))
    .filter((o) => !o.event.allDay)
    .sort((a, b) => a.start - b.start)[0];
  const due = tasks.filter(
    (t) => !t.parentTaskId && !isClosed(t.status) && !!t.dueDate && t.dueDate <= today,
  ).length;
  return (
    <section aria-labelledby="next-heading" className="mb-10">
      <h2 id="next-heading" className="mb-3 text-[15px] font-semibold md:text-sm">
        Next up
      </h2>
      <Link
        to="/"
        className="border-line hover:bg-surface-2 flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3"
      >
        <CalendarClock className="text-muted size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium md:text-sm">
            {next ? `${format(next.start, 'h:mm a')} · ${next.event.title}` : 'No more events today'}
          </span>
          <span className="text-muted block text-xs">
            {due ? `${due} task${due === 1 ? '' : 's'} due today or overdue` : 'No tasks due today'} · Open
            Today
          </span>
        </span>
        <ChevronRight className="text-muted size-4" />
      </Link>
    </section>
  );
}

/**
 * Home: today's check-in and what's next first, then every section as one connected map
 * (you → areas → subsections), which folds away. The app itself opens on Today.
 */
export function HomePage() {
  const tree = useNodeTree();
  const counts = useOpenCounts(tree);
  const profile = useProfile();
  const now = useNow();
  const wide = useMediaQuery('(min-width: 768px)');
  const name = (profile?.settings.displayName as string | undefined) ?? 'You';
  const mapHidden = useUIStore((s) => s.homeMapHidden);
  const toggleMap = useUIStore((s) => s.toggleHomeMap);
  if (!tree) return <Loading />;
  const areas = tree.visibleTree;

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <p className="text-muted flex-1 text-[15px] md:text-sm">
            {new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {/* Phones: search lives here and on More (desktop has it in the sidebar and Ctrl+K). */}
          <span className="-my-2 md:hidden">
            <SearchButton compact />
          </span>
        </div>
        <h1 className="font-display mt-1 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
          Home
        </h1>
      </header>

      <section aria-labelledby="checkin-heading" className="mb-10">
        <h2 id="checkin-heading" className="mb-3 text-[15px] font-semibold md:text-sm">
          Check-in
        </h2>
        <CheckinCard />
      </section>

      <NextUp />

      <section aria-label="Your sections" className="mb-10">
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 text-[15px] font-semibold md:text-sm">Your sections</h2>
          <Button size="sm" variant="ghost" aria-expanded={!mapHidden} onClick={toggleMap}>
            <ChevronDown className={cn('size-4 transition-transform', mapHidden && '-rotate-90')} />
            {mapHidden ? 'Show' : 'Hide'}
          </Button>
        </div>
        {!mapHidden && (
          <>
            {/* Root: you. A line drops to the row of areas. */}
            <div className={cn('flex flex-col', wide ? 'items-center' : 'items-start')}>
              <div className="border-line bg-surface flex items-center gap-2.5 rounded-full border px-4 py-2">
                <Network className="text-muted size-4" />
                <span className="font-medium">{name}</span>
              </div>
              <div className={cn('bg-line h-5 w-px', !wide && 'ml-4')} />
            </div>
            <div
              className={cn('relative grid', wide ? 'gap-4' : 'border-line ml-4 gap-6 border-l')}
              style={{ gridTemplateColumns: wide ? `repeat(${areas.length}, minmax(0, 1fr))` : undefined }}
            >
              {/* Desktop: the bar joining the areas' tops. */}
              {areas.length > 1 && (
                <div
                  aria-hidden
                  className="bg-line absolute top-0 hidden h-px md:block"
                  style={{ left: `${50 / areas.length}%`, right: `${50 / areas.length}%` }}
                />
              )}
              {areas.map(({ node, children }) => {
                const c = colorFor(tree.colorOf(node.id));
                const n = counts.get(node.id) ?? 0;
                return (
                  <div
                    key={node.id}
                    className={cn(
                      'relative min-w-0',
                      // Desktop: a line drops into each column. Phone: a tick joins each area to the trunk.
                      wide
                        ? 'pt-5'
                        : 'before:bg-line pl-3 before:absolute before:top-7 before:left-0 before:h-px before:w-3',
                    )}
                  >
                    <div aria-hidden className="bg-line absolute top-0 left-1/2 hidden h-5 w-px md:block" />
                    <Link
                      to={nodePath(node.id)}
                      className="border-line bg-surface hover:bg-surface-2 relative flex min-h-14 items-center gap-3 overflow-hidden rounded-2xl border px-4"
                    >
                      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', c.dot)} />
                      <NodeIcon name={node.icon} className={cn('size-5 shrink-0', c.text)} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{node.title}</span>
                      <span className="text-muted text-xs tabular-nums">{n ? `${n} open` : ''}</span>
                    </Link>
                    <Branch items={children} tree={tree} counts={counts} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
