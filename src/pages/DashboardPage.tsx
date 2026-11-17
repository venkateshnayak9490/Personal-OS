import {
  CalendarClock,
  CircleAlert,
  DatabaseBackup,
  FolderKanban,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Card, MilestoneBadge } from '@/components/PageHeader';
import { Button } from '@/components/ui';
import { downloadBackup, LAST_BACKUP_KEY } from '@/core/backup';
import { useAllTasks, useMeta, useProfile } from '@/core/hooks';
import { descendantIds } from '@/core/domain/tree';
import { isClosed, isOverdue, toLocalDate } from '@/core/domain/tasks';
import { useNodeTree } from '@/features/structure/use-tree';
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

const SOON: { title: string; icon: LucideIcon; empty: string }[] = [
  { title: 'Habits', icon: Repeat, empty: 'Tap to check off today’s habits.' },
  { title: 'Upcoming deadlines', icon: CalendarClock, empty: 'The next 7 days at a glance.' },
  { title: 'Ongoing projects', icon: FolderKanban, empty: 'Progress bars for active projects.' },
];

const BACKUP_REMINDER_DAYS = 7;

export function DashboardPage() {
  const profile = useProfile();
  const tasks = useAllTasks();
  const t = useNodeTree();
  const lastBackup = useMeta<number>(LAST_BACKUP_KEY);
  const nowMs = useNow();
  const now = new Date(nowMs);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = profile?.settings.displayName as string | undefined;

  // Interim "Today" list until the full dashboard (M2): due today or overdue, plus in-progress.
  const today = toLocalDate(nowMs);
  const tz = profile?.timezone;
  const todays = useMemo(
    () =>
      (tasks ?? []).filter(
        (x) =>
          !isClosed(x.status) &&
          (x.status === 'in_progress' || (!!x.dueDate && x.dueDate <= today) || isOverdue(x, nowMs, tz)),
      ),
    [tasks, today, nowMs, tz],
  );

  const hasData = (tasks?.length ?? 0) > 0;
  const backupDue =
    hasData && lastBackup !== undefined
      ? nowMs - lastBackup > BACKUP_REMINDER_DAYS * 86_400_000
      : hasData && (tasks?.length ?? 0) >= 5;

  return (
    <>
      <header className="mb-6">
        <p className="text-muted text-sm">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting(now.getHours())}
          {name ? `, ${name}` : ''}
        </h1>
      </header>

      {backupDue && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/8 p-4 sm:flex-row sm:items-center">
          <DatabaseBackup className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm">
            {lastBackup
              ? `Your last backup was over ${BACKUP_REMINDER_DAYS} days ago.`
              : 'You haven’t backed up yet.'}{' '}
            Your data lives only on this device until sync arrives.
          </p>
          <Button size="sm" variant="primary" onClick={() => void attempt(downloadBackup)}>
            Download backup
          </Button>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CircleAlert className="text-accent size-4" /> Today & overdue
        </h2>
        {tasks && (
          <TaskList tasks={todays} showSection emptyText="Nothing due today. Add tasks inside any section." />
        )}
      </section>

      <h2 className="text-muted mb-3 text-sm font-semibold">Sections</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {t?.visibleTree.map(({ node }) => {
          const c = colorFor(t.colorOf(node.id));
          const ids = new Set([node.id, ...descendantIds(t.nodes, node.id)]);
          const open = (tasks ?? []).filter(
            (x) => x.nodeId && ids.has(x.nodeId) && !x.parentTaskId && !isClosed(x.status),
          ).length;
          return (
            <Link
              key={node.id}
              to={nodePath(node.id)}
              className="border-line bg-surface hover:bg-surface-2 flex flex-col gap-3 rounded-xl border p-4 transition-colors"
            >
              <div className={cn('grid size-9 place-items-center rounded-lg', c.soft)}>
                <NodeIcon name={node.icon} className={cn('size-[18px]', c.text)} />
              </div>
              <div>
                <div className="text-sm font-medium">{node.title}</div>
                <div className="text-muted text-xs">{open} open tasks</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SOON.map(({ title, icon: Icon, empty }) => (
          <Card key={title}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="text-muted size-4" />
              <h2 className="flex-1 text-sm font-semibold">{title}</h2>
              <MilestoneBadge milestone="M2" />
            </div>
            <p className="text-muted text-sm">{empty}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
