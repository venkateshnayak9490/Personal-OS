import { DatabaseBackup, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button, Loading } from '@/components/ui';
import { downloadBackup, LAST_BACKUP_KEY } from '@/core/backup';
import { useAllTasks, useMeta, useProfile } from '@/core/hooks';
import { isClosed, isOverdue, toLocalDate } from '@/core/domain/tasks';
import { OverdueBar } from '@/features/tasks/OverdueBar';
import { AwayCard } from '@/features/reminders/AwayCard';
import {
  ActiveProjects,
  ComingUp,
  CustomizeSheet,
  TodayEvents,
  useLayout,
  type WidgetKey,
} from '@/features/dashboard/widgets';
import { MotivationLine } from '@/features/messages/MotivationLine';
import { ReviewNudge, WeekPriorities } from '@/features/analytics/ReviewNudge';
import { timeOfDay } from '@/content/messages';
import { SetupChecklist, useSetupSteps } from '@/features/setup/SetupChecklist';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { TaskComposer } from '@/features/tasks/TaskComposer';
import { TaskList } from '@/features/tasks/TaskList';

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
  const layout = useLayout();
  const [customizing, setCustomizing] = useState(false);
  const now = new Date(nowMs);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const name = profile?.settings.displayName as string | undefined;

  // Due today or overdue, plus anything in progress.
  const today = toLocalDate(nowMs);
  const tz = profile?.timezone;
  const { todays, overdueIds, counts } = useMemo(() => {
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
      overdueIds: overdue.map((x) => x.id),
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

  const blocks: Record<WidgetKey, ReactNode> = {
    events: <TodayEvents />,
    tasks: (
      <section aria-labelledby="today-heading" className="mb-10">
        <h2 id="today-heading" className="title-block mb-3">
          Today
        </h2>
        <div className="mb-4">
          <TaskComposer variant="inline" dueToday placeholder="Add a task for today" />
        </div>
        <OverdueBar ids={overdueIds} today={today} timezone={tz} weekStartsOn={profile?.weekStartsOn ?? 1} />
        <TaskList
          tasks={todays}
          hideFilters
          showSection
          emptyText="Nothing due today. Tasks with today’s date, overdue ones and anything in progress show up here."
        />
      </section>
    ),
    upcoming: <ComingUp />,
    projects: <ActiveProjects />,
  };

  // Setup, review and backup nudges: above the tasks on day one, below them once you have tasks.
  const nudges = (
    <>
      <SetupChecklist />

      <ReviewNudge now={nowMs} weekStartsOn={profile?.weekStartsOn ?? 1} />

      {backupDue && (
        <div className="border-line mb-8 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <DatabaseBackup className="text-warning size-5 shrink-0" />
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
    </>
  );

  return (
    <>
      <header className="mb-8 md:mb-10">
        <p className="text-muted text-[15px] md:text-sm">{dateLabel}</p>
        <h1 className="title-page mt-1">
          {greeting(now.getHours())}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="text-muted mt-3 text-[15px] md:text-base">
          {summary(counts.due, counts.overdue, counts.inProgress)}
        </p>
        <MotivationLine keys={[timeOfDay(now.getHours())]} />
      </header>

      <AwayCard />

      <WeekPriorities now={nowMs} weekStartsOn={profile?.weekStartsOn ?? 1} />

      {!hasData && nudges}

      {layout.order
        .filter((k) => !layout.hidden.includes(k))
        .map((k) => (
          <div key={k}>{blocks[k]}</div>
        ))}

      {hasData && nudges}

      <Button variant="ghost" size="sm" className="text-muted" onClick={() => setCustomizing(true)}>
        <SlidersHorizontal className="size-4" /> Customize Today
      </Button>
      <CustomizeSheet open={customizing} onClose={() => setCustomizing(false)} />
    </>
  );
}
