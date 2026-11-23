import { endOfDay, format, startOfDay } from 'date-fns';
import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { occurrences } from '@/core/domain/events';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { useAllTasks, useEvents } from '@/core/hooks';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

export interface Period {
  key: string;
  title: string;
  start: number;
  end: number;
  kind: 'event' | 'task';
  nodeId?: string;
  taskId?: string;
  location?: string;
}

const H = 3_600_000;
/** Items shorter than this draw as a tick with the label beside it: a block this short cannot hold a label. */
const SHORT = 1.25 * H;
/** Axis room a tick's label takes (and holds in its lane). */
const LABEL = 2.25 * H;

/**
 * Lay periods out in lanes so neither blocks nor their labels overlap. A short item's label needs
 * room after its tick, so it reserves about 1.5 hours of axis.
 */
export function assignLanes(periods: Period[], short = SHORT, label = LABEL): number[] {
  const laneEnds: number[] = [];
  return periods.map((p) => {
    const visualEnd = Math.max(p.end, p.start + (p.end - p.start < short ? label : 0));
    let lane = laneEnds.findIndex((end) => end <= p.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = visualEnd;
    return lane;
  });
}

/** Today's timed events and timed open tasks, in start order. All-day events are returned apart. */
export function useTodayPeriods(): { periods: Period[]; allDay: string[] } | undefined {
  const events = useEvents();
  const tasks = useAllTasks();
  const now = useNow();
  if (!events || !tasks) return undefined;
  const from = startOfDay(now).getTime();
  const to = endOfDay(now).getTime();
  const today = toLocalDate(now);
  const occ = events.flatMap((e) => occurrences(e, from, to));
  const periods: Period[] = [
    ...occ
      .filter((o) => !o.event.allDay)
      .map((o) => ({
        key: `e:${o.event.id}@${o.start}`,
        title: o.event.title,
        start: Math.max(o.start, from),
        end: Math.min(o.end, to),
        kind: 'event' as const,
        nodeId: o.event.nodeId,
        location: o.event.location,
      })),
    ...tasks
      .filter((t) => !t.parentTaskId && !isClosed(t.status) && t.dueDate === today && t.dueTime)
      .map((t) => {
        const [h = 0, m = 0] = t.dueTime!.split(':').map(Number);
        const start = from + h * H + m * 60_000;
        return {
          key: `t:${t.id}`,
          title: t.title,
          start,
          end: start + 0.5 * H,
          kind: 'task' as const,
          nodeId: t.nodeId,
          taskId: t.id,
        };
      }),
  ].sort((a, b) => a.start - b.start);
  return { periods, allDay: occ.filter((o) => o.event.allDay).map((o) => o.event.title) };
}

/**
 * The day ruled as a timetable: periods on a time axis with a now-line (tablet and up), or a list
 * of periods on phones, where a 13-hour axis would not fit.
 */
export function DayStrip() {
  const data = useTodayPeriods();
  const tree = useNodeTree();
  const now = useNow();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  // The axis's width in pixels: whether an item can be a labelled block depends on its size on
  // screen, not its minutes (90 minutes is roomy at 1440px and cramped at 768px).
  const [axisW, setAxisW] = useState(0);
  const axisRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAxisW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!data || !tree) return null;
  const { periods, allDay } = data;
  const dayStart = startOfDay(now).getTime();

  if (!periods.length && !allDay.length)
    return (
      <p className="text-muted text-[15px] md:text-sm">
        Nothing with a time today. Events and timed tasks show up here.
      </p>
    );

  // The axis covers 08:00–21:00 and stretches to fit anything earlier or later.
  const firstH = Math.min(8, ...periods.map((p) => Math.floor((p.start - dayStart) / H)));
  const lastH = Math.max(21, ...periods.map((p) => Math.ceil((p.end - dayStart) / H)));
  const span = (lastH - firstH) * H;
  const x = (t: number) => ((t - dayStart - firstH * H) / span) * 100;
  // A block needs about 96px for a readable label; a tick's label takes about 176px beside it.
  const shortMs = axisW ? (96 / axisW) * span : SHORT;
  const labelMs = axisW ? (176 / axisW) * span : LABEL;
  const lanes = assignLanes(periods, shortMs, labelMs);
  const laneCount = Math.max(1, ...lanes.map((l) => l + 1));
  const nowIn = now >= dayStart + firstH * H && now <= dayStart + lastH * H;

  const label = (p: Period) =>
    `${format(p.start, 'HH:mm')}${p.kind === 'event' ? `–${format(p.end, 'HH:mm')}` : ''}, ${p.title}${p.location ? `, ${p.location}` : ''}${p.kind === 'task' ? ' (task)' : ''}`;
  const item = (p: Period, className: string, children: ReactNode) =>
    p.taskId ? (
      <button
        type="button"
        onClick={() => openTask(p.taskId!)}
        aria-label={label(p)}
        title={label(p)}
        className={className}
      >
        {children}
      </button>
    ) : (
      <Link to="/calendar" aria-label={label(p)} title={label(p)} className={className}>
        {children}
      </Link>
    );

  return (
    <div>
      {allDay.length > 0 && (
        <p className="text-meta text-muted mb-2">
          All day: <span className="text-fg">{allDay.join(', ')}</span>
        </p>
      )}
      {periods.length > 0 && (
        <>
          {/* Tablet and up: the axis. */}
          <div className="border-line bg-surface hidden rounded-2xl border px-3 pt-2 pb-3 md:block">
            <div className="text-muted relative h-5 text-[11px]">
              {Array.from({ length: lastH - firstH + 1 }, (_, i) => firstH + i).map((h) => (
                <span
                  key={h}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${((h - firstH) / (lastH - firstH)) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}
                </span>
              ))}
            </div>
            <div ref={axisRef} className="relative" style={{ height: laneCount * 34 + 8 }}>
              {Array.from({ length: lastH - firstH + 1 }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="bg-line absolute inset-y-0 w-px"
                  style={{ left: `${(i / (lastH - firstH)) * 100}%` }}
                />
              ))}
              {periods.map((p, i) => {
                const c = colorFor(tree.colorOf(p.nodeId));
                const isShort = p.end - p.start < shortMs;
                return (
                  <div
                    key={p.key}
                    className={cn('absolute h-7', p.end <= now && 'opacity-60')}
                    style={{
                      left: `${x(p.start)}%`,
                      top: 4 + lanes[i]! * 34,
                      width: `${x(isShort ? p.start + labelMs * 0.95 : p.end) - x(p.start)}%`,
                    }}
                  >
                    {item(
                      p,
                      isShort
                        ? 'flex h-full max-w-full items-center gap-1.5 text-left'
                        : 'border-line-strong bg-surface-2 flex h-full w-full items-center gap-1.5 overflow-hidden rounded-sm border px-1.5 text-left',
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'shrink-0 rounded-xs',
                            isShort ? '-ml-0.5 h-full w-1' : 'size-2',
                            c.dot,
                          )}
                        />
                        <span className="truncate text-xs font-semibold">{p.title}</span>
                      </>,
                    )}
                  </div>
                );
              })}
              {nowIn && (
                <span
                  role="img"
                  aria-label={`Now, ${format(now, 'HH:mm')}`}
                  className="bg-danger absolute -inset-y-1 w-0.5"
                  style={{ left: `${x(now)}%` }}
                />
              )}
            </div>
          </div>

          {/* Phones: the periods as a ruled list, time on the left. */}
          <ul className="border-line border-t md:hidden">
            {periods.map((p) => {
              const c = colorFor(tree.colorOf(p.nodeId));
              const past = p.end <= now;
              const current = p.start <= now && now < p.end;
              return (
                <li key={p.key} className={cn('border-line border-b', past && 'opacity-60')}>
                  {item(
                    p,
                    'flex min-h-12 w-full items-center gap-3 py-2 text-left',
                    <>
                      <span className="w-14 shrink-0 text-sm font-semibold">{format(p.start, 'HH:mm')}</span>
                      <span aria-hidden className={cn('w-1 self-stretch rounded-xs', c.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{p.title}</span>
                        <span className="text-meta text-muted block truncate">
                          {p.kind === 'event' ? `until ${format(p.end, 'HH:mm')}` : 'Task'}
                          {p.location ? `, ${p.location}` : ''}
                        </span>
                      </span>
                      {current && <span className="text-danger text-xs font-semibold">Now</span>}
                    </>,
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
