import { format, startOfDay, startOfWeek, subDays } from 'date-fns';
import { Plus, Timer, X } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { Card, PageHeader } from '@/components/PageHeader';
import { BlockHeader, Button, EmptyState, Input, Loading, Segmented, Select } from '@/components/ui';
import { useAllTasks, useFocusSessions, useProfile } from '@/core/hooks';
import { focusMinutes, hm } from '@/core/domain/focus';
import { compareTasks, isClosed } from '@/core/domain/tasks';
import { deleteFocusSession, discardFocus, extendFocus, startFocus, stopFocus } from '@/core/repos/focus';
import { restoreFromTrash } from '@/core/repos/trash';
import { clock, useRunningFocus } from '@/features/focus/FocusTimer';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';

const LENGTHS = [25, 50, 90];

export function FocusPage() {
  const { running, now, left } = useRunningFocus();
  const tasks = useAllTasks();
  const profile = useProfile();
  const t = useNodeTree();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const weekStart = startOfWeek(now, { weekStartsOn: profile?.weekStartsOn ?? 1 }).getTime();
  const since = Math.min(weekStart, subDays(startOfDay(now), 6).getTime());
  const sessions = useFocusSessions(since);
  const [minutes, setMinutes] = useState(25);
  const [taskId, setTaskId] = useState('');

  if (!tasks || !sessions || !t) return <Loading />;
  const task = (id?: string) => (id ? tasks.find((x) => x.id === id) : undefined);
  const open = tasks
    .filter((x) => !x.parentTaskId && !isClosed(x.status))
    .sort((a, b) => compareTasks(a, b, now));
  const today = startOfDay(now).getTime();
  const day = 86_400_000;

  const start = () =>
    void attempt(() =>
      startFocus({ plannedMin: minutes, taskId: taskId || undefined, nodeId: task(taskId)?.nodeId }),
    );
  const stop = () =>
    void attempt(async () => {
      const s = await stopFocus();
      toast(s ? `Saved ${hm(s.minutes)} of focus` : 'Under a minute: not saved');
    });

  // Last 7 days, oldest first, for the small bar chart.
  const days = Array.from({ length: 7 }, (_, i) => today - (6 - i) * day).map((d) => ({
    d,
    min: focusMinutes(sessions, d, d + day),
  }));
  const max = Math.max(60, ...days.map((x) => x.min));
  const bySection = new Map<string, number>();
  for (const s of sessions.filter((s) => s.start >= weekStart)) {
    const key = s.nodeId && t.byId.has(s.nodeId) ? t.path(s.nodeId)[0]!.title : 'No section';
    bySection.set(key, (bySection.get(key) ?? 0) + s.minutes);
  }

  return (
    <>
      <PageHeader
        title="Focus"
        icon={Timer}
        subtitle="Timed blocks of deep work. Only time you actually focused counts."
      />

      <Card className="mb-10 flex flex-col items-center gap-5 px-4 py-8 text-center md:py-10">
        <h2 className="sr-only">Timer</h2>
        {running ? (
          <>
            <div className="text-muted text-sm">
              {task(running.taskId)?.title ?? 'Focusing'} · until{' '}
              {format(running.startedAt + running.plannedMin * 60_000, 'HH:mm')}
            </div>
            <div
              role="timer"
              aria-label="Time left"
              className="text-7xl font-semibold tracking-tight tabular-nums"
            >
              {clock(left)}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={stop}>
                Stop and save
              </Button>
              <Button onClick={() => void attempt(() => extendFocus(5))}>
                <Plus className="size-4" /> 5 min
              </Button>
              <Button variant="ghost" onClick={() => void attempt(() => discardFocus())}>
                <X className="size-4" /> Discard
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Segmented
                label="Length"
                options={LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
                value={String(minutes)}
                onChange={(v) => setMinutes(Number(v))}
              />
              <Input
                type="number"
                aria-label="Minutes"
                min={1}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-24 text-center"
              />
              <span className="text-meta text-muted">min</span>
            </div>
            <Select
              aria-label="Task to focus on"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="max-w-md"
            >
              <option value="">No particular task</option>
              {open.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={start}>
              Start {minutes} min
            </Button>
          </>
        )}
      </Card>

      <section aria-labelledby="focus-stats" className="mb-10">
        <BlockHeader id="focus-stats" title="Deep work" />
        <p className="mt-3 mb-4 text-[15px] md:text-sm">
          Today <b className="tabular-nums">{hm(focusMinutes(sessions, today, today + day))}</b>
          <span className="text-muted"> · This week </span>
          <b className="tabular-nums">{hm(focusMinutes(sessions, weekStart, now + day))}</b>
        </p>
        <div className="flex h-28 items-end gap-2" aria-label="Focus per day, last 7 days" role="img">
          {days.map(({ d, min }) => (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <div
                title={`${format(d, 'EEE d MMM')}: ${hm(min)}`}
                className={cn('w-full rounded-xs', min ? 'bg-fg/75' : 'bg-surface-2')}
                style={{ height: `${Math.max(4, (min / max) * 88)}px` }}
              />
              <span className={cn('text-meta', d === today ? 'text-fg font-semibold' : 'text-muted')}>
                {format(d, 'EEEEE')}
              </span>
            </div>
          ))}
        </div>
        {bySection.size > 0 && (
          <ul
            aria-label="This week by area"
            className="text-meta text-muted mt-4 flex flex-wrap gap-x-4 gap-y-1"
          >
            {[...bySection].map(([k, v]) => (
              <li key={k}>
                {k} <span className="text-fg tabular-nums">{hm(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="focus-recent">
        <BlockHeader id="focus-recent" title="Recent sessions" />
        {sessions.length === 0 ? (
          <EmptyState icon={Timer} title="No focus sessions yet" compact>
            Start a block above. Each one you finish or stop is listed here with its task.
          </EmptyState>
        ) : (
          <ul className="divide-line divide-y">
            {sessions.slice(0, 15).map((s) => {
              const tk = task(s.taskId);
              return (
                <li key={s.id} className="flex items-center gap-3 py-1 text-[15px] md:text-sm">
                  <span className="text-meta text-muted w-28 shrink-0">
                    {format(s.start, 'EEE d MMM, HH:mm')}
                  </span>
                  {tk ? (
                    <button
                      type="button"
                      onClick={() => openTask(tk.id)}
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                    >
                      {tk.title}
                    </button>
                  ) : (
                    <span className="text-muted min-w-0 flex-1 truncate">No particular task</span>
                  )}
                  <span className="font-medium">{hm(s.minutes)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete session of ${format(s.start, 'HH:mm')}`}
                    onClick={() =>
                      void attempt(async () => {
                        const b = await deleteFocusSession(s.id);
                        if (b) toast('Session moved to Trash', () => restoreFromTrash(b));
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
