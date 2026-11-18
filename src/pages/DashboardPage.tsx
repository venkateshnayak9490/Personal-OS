import { ChevronRight, DatabaseBackup } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button, Loading } from '@/components/ui';
import { downloadBackup, LAST_BACKUP_KEY } from '@/core/backup';
import { useAllTasks, useMeta, useProfile } from '@/core/hooks';
import { descendantIds } from '@/core/domain/tree';
import { isClosed, isOverdue, toLocalDate } from '@/core/domain/tasks';
import { HabitsToday } from '@/features/habits/HabitsToday';
import { SetupChecklist, useSetupSteps } from '@/features/setup/SetupChecklist';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { TaskComposer } from '@/features/tasks/TaskComposer';
import { TaskList } from '@/features/tasks/TaskList';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';

function greeting(hour: number): string {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function summary(due: number, overdue: number, inProgress: number): string {
  if (!due && !overdue && !inProgress) return 'Nothing is due today. A good day to get ahead.';
  const parts: string[] = [];
  if (due) parts.push(`${due} ${due === 1 ? 'task' : 'tasks'} for today`);
  if (overdue) parts.push(`${overdue} overdue`);
  if (inProgress) parts.push(`${inProgress} in progress`);
  const last = parts.pop()!;
  return `${parts.length ? `${parts.join(', ')} and ${last}` : last.charAt(0).toUpperCase() + last.slice(1)}.`;
}

const BACKUP_REMINDER_DAYS = 7;

export function DashboardPage() {
  const profile = useProfile();
  const tasks = useAllTasks();
  const t = useNodeTree();
  const setup = useSetupSteps();
  const lastBackup = useMeta<number>(LAST_BACKUP_KEY);
  const nowMs = useNow();
  useComposerContext({ due: 'today' });
  const now = new Date(nowMs);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = profile?.settings.displayName as string | undefined;

  // Due today or overdue, plus anything in progress.
  const today = toLocalDate(nowMs);
  const tz = profile?.timezone;
  const { todays, counts } = useMemo(() => {
    const open = (tasks ?? []).filter((x) => !isClosed(x.status) && !x.parentTaskId);
    const overdue = open.filter((x) => isOverdue(x, nowMs, tz));
    const dueToday = open.filter((x) => x.dueDate === today && !isOverdue(x, nowMs, tz));
    const inProgress = open.filter(
      (x) => x.status === 'in_progress' && !overdue.includes(x) && !dueToday.includes(x),
    );
    const todays = (tasks ?? []).filter(
      (x) =>
        !isClosed(x.status) &&
        (x.status === 'in_progress' || (!!x.dueDate && x.dueDate <= today) || isOverdue(x, nowMs, tz)),
    );
    return {
      todays,
      counts: { due: dueToday.length, overdue: overdue.length, inProgress: inProgress.length },
    };
  }, [tasks, today, nowMs, tz]);

  if (!tasks || !t) return <Loading />;

  const hasData = tasks.length > 0;
  const backupDue =
    !setup?.visible &&
    (lastBackup !== undefined
      ? nowMs - lastBackup > BACKUP_REMINDER_DAYS * 86_400_000
      : hasData && tasks.length >= 5);

  return (
    <>
      <header className="mb-8 md:mb-10">
        <p className="text-muted text-[15px] md:text-sm">{dateLabel}</p>
        <h1 className="mt-1 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
          {greeting(now.getHours())}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="text-muted mt-3 text-[15px] md:text-base">
          {summary(counts.due, counts.overdue, counts.inProgress)}
        </p>
      </header>

      <SetupChecklist />

      {backupDue && (
        <div className="border-line mb-8 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <DatabaseBackup className="text-sec-misc size-5 shrink-0" />
          <p className="flex-1 text-[15px] md:text-sm">
            {lastBackup
              ? `Your last backup was over ${BACKUP_REMINDER_DAYS} days ago.`
              : 'You haven’t backed up yet.'}{' '}
            <span className="text-muted">Your data lives only on this device until sync arrives.</span>
          </p>
          <Button size="sm" variant="primary" onClick={() => void attempt(downloadBackup)}>
            Download backup
          </Button>
        </div>
      )}

      <section aria-labelledby="today-heading" className="mb-10">
        <h2 id="today-heading" className="mb-3 text-[15px] font-semibold md:text-sm">
          Today
        </h2>
        <div className="mb-4">
          <TaskComposer variant="inline" dueToday placeholder="Add a task for today" />
        </div>
        <TaskList
          tasks={todays}
          hideFilters
          showSection
          emptyText="Nothing due today. Tasks with today’s date, overdue ones and anything in progress show up here."
        />
      </section>

      <HabitsToday />

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="mb-3 text-[15px] font-semibold md:text-sm">
          Your areas
        </h2>
        <ul className="border-line divide-line divide-y rounded-2xl border md:grid md:grid-cols-4 md:divide-x md:divide-y-0">
          {t.visibleTree.map(({ node, children }) => {
            const c = colorFor(t.colorOf(node.id));
            const ids = new Set([node.id, ...descendantIds(t.nodes, node.id)]);
            const open = tasks.filter(
              (x) => x.nodeId && ids.has(x.nodeId) && !x.parentTaskId && !isClosed(x.status),
            ).length;
            return (
              <li key={node.id}>
                <Link
                  to={nodePath(node.id)}
                  className="hover:bg-surface-2/60 flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors md:min-h-28 md:flex-col md:items-start md:justify-between md:gap-4"
                >
                  <NodeIcon name={node.icon} className={cn('size-6 shrink-0 md:size-5', c.text)} />
                  <div className="min-w-0 flex-1 md:flex-none">
                    <div className="truncate text-base font-medium md:text-sm">{node.title}</div>
                    <div className="text-muted text-[13px] md:text-xs">
                      {open ? `${open} open` : 'Nothing open'}
                      {children.length > 0 ? `, ${children.length} inside` : ''}
                    </div>
                  </div>
                  <ChevronRight className="text-muted size-4 md:hidden" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
