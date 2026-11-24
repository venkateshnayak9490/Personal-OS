import { DatabaseBackup, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Link } from 'react-router';
import { BlockHeader, Button, Loading } from '@/components/ui';
import { downloadBackup, LAST_BACKUP_KEY } from '@/core/backup';
import { useAllTasks, useHabitLogs, useHabits, useMeta, useProfile } from '@/core/hooks';
import { isScheduled } from '@/core/domain/progress';
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

/**
 * Habit progress as one read-only line linking to Habits. Habits are ticked only on the Habits page
 * (owner's decision, 2026-11-19); Today just says how the day stands.
 */
function HabitsLine({ today }: { today: string }) {
  const habits = useHabits();
  const logs = useHabitLogs(today);
  if (!habits || !logs) return null;
  const due = habits.filter((h) => !h.archivedAt && isScheduled(h, today));
  if (!due.length) return null;
  const done = due.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === today && l.status === 'done'),
  ).length;
  return (
    <p className="text-muted mt-1 text-[15px] md:text-sm">
      <Link to="/habits" className="hover:text-fg underline-offset-2 hover:underline">
        Habits: {done} of {due.length} done today
      </Link>
    </p>
  );
}

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
        <BlockHeader id="today-heading" title="Today" count={todays.length} />
        <div className="mt-3 mb-4">
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
        <div className="border-line-strong mb-10 flex flex-col gap-3 border-y py-3 sm:flex-row sm:items-center">
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
      <header className="mb-8">
        <h1 className="title-page border-fg inline-block border-b-2 pb-2">
          {greeting(now.getHours())}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="text-muted mt-2 text-[15px] md:text-sm">{dateLabel}</p>
        <p className="text-fg-2 mt-3 text-[15px] md:text-sm">
          {summary(counts.due, counts.overdue, counts.inProgress)}
        </p>
        <HabitsLine today={today} />
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
