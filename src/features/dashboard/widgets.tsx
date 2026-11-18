import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { ArrowDown, ArrowUp, CalendarDays, Flag, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { dateChipLabel } from '@/components/DatePicker';
import { Sheet } from '@/components/Sheet';
import { Button, ProgressBar } from '@/components/ui';
import { db } from '@/core/db';
import {
  useAllTasks,
  useCollections,
  useEvents,
  useMeta,
  useMilestones,
  useProfile,
  useProjects,
  useRecords,
} from '@/core/hooks';
import { datedItems, zoneLabel } from '@/core/domain/collections';
import { occurrences } from '@/core/domain/events';
import { projectProgress } from '@/core/domain/progress';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { listPath } from '@/features/collections/ListsSection';
import { projectPath } from '@/pages/ProjectsPage';

/* ---------- Layout (per device: desktop and phone can differ) ---------- */

export const WIDGETS = {
  events: 'Today’s events',
  tasks: 'Today’s tasks',
  habits: 'Habits today',
  checkin: 'Check-in',
  upcoming: 'Coming up',
  projects: 'Active projects',
  areas: 'Your areas',
} as const;
export type WidgetKey = keyof typeof WIDGETS;

interface Layout {
  order: WidgetKey[];
  hidden: WidgetKey[];
}
const LAYOUT_KEY = 'dashboard.layout';
const DEFAULT: Layout = { order: Object.keys(WIDGETS) as WidgetKey[], hidden: [] };

// shortcut: kept in local `meta` (not synced) so each device has its own Today; move to `widgets` if sync should carry it.
export function useLayout(): Layout {
  const saved = useMeta<Layout>(LAYOUT_KEY);
  if (!saved) return DEFAULT;
  // Widgets added in later versions show up at the end.
  const known = saved.order.filter((k) => k in WIDGETS);
  return { order: [...known, ...DEFAULT.order.filter((k) => !known.includes(k))], hidden: saved.hidden };
}
const saveLayout = (l: Layout) => db.meta.put({ key: LAYOUT_KEY, value: l });

export function CustomizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layout = useLayout();
  const move = (i: number, d: -1 | 1) => {
    const order = [...layout.order];
    [order[i], order[i + d]] = [order[i + d]!, order[i]!];
    void saveLayout({ ...layout, order });
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Customize Today"
      description="Choose what shows on Today and in which order. This device only."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <ul className="divide-line divide-y">
        {layout.order.map((k, i) => (
          <li key={k} className="flex items-center gap-2 py-2">
            <label className="flex flex-1 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={!layout.hidden.includes(k)}
                onChange={(e) =>
                  void saveLayout({
                    ...layout,
                    hidden: e.target.checked ? layout.hidden.filter((h) => h !== k) : [...layout.hidden, k],
                  })
                }
                className="accent-[var(--fg)]"
              />
              {WIDGETS[k]}
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${WIDGETS[k]} up`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${WIDGETS[k]} down`}
              disabled={i === layout.order.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/* ---------- Widgets (each hides itself when it has nothing to show) ---------- */

function Widget({
  id,
  title,
  link,
  children,
}: {
  id: string;
  title: string;
  link?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id={id} className="text-[15px] font-semibold md:text-sm">
          {title}
        </h2>
        {link}
      </div>
      {children}
    </section>
  );
}

const linkCls = 'text-muted hover:text-fg text-xs';

export function TodayEvents() {
  const events = useEvents();
  const now = useNow();
  if (!events) return null;
  const list = events
    .flatMap((e) => occurrences(e, startOfDay(now).getTime(), endOfDay(now).getTime()))
    .sort((a, b) => a.start - b.start);
  if (!list.length) return null;
  return (
    <Widget
      id="w-events"
      title={WIDGETS.events}
      link={
        <Link to="/calendar" className={linkCls}>
          Calendar
        </Link>
      }
    >
      <ul className="border-line divide-line divide-y rounded-2xl border">
        {list.map((o) => {
          const past = o.end <= now;
          return (
            <li
              key={`${o.event.id}@${o.start}`}
              className={`flex items-center gap-4 px-4 py-3 ${past ? 'opacity-50' : ''}`}
            >
              <span className="text-muted w-20 shrink-0 text-sm tabular-nums">
                {o.event.allDay ? 'All day' : format(o.start, 'h:mm a')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{o.event.title}</div>
                {o.event.location && (
                  <div className="text-muted flex items-center gap-1 truncate text-xs">
                    <MapPin className="size-3" /> {o.event.location}
                  </div>
                )}
              </div>
              {o.start <= now && !past && <span className="text-sec-self text-xs font-medium">Now</span>}
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

/** Open tasks due in the next 7 days (after today), events in that time, and list deadlines from now on. */
export function ComingUp() {
  const tasks = useAllTasks();
  const events = useEvents();
  const lists = useCollections();
  const records = useRecords();
  const profile = useProfile();
  const now = useNow();
  const navigate = useNavigate();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  if (!tasks || !events || !lists || !records) return null;
  const until = endOfDay(addDays(now, 7)).getTime();
  const today = toLocalDate(now);
  const last = format(addDays(now, 7), 'yyyy-MM-dd');
  const rows = [
    ...tasks
      .filter(
        (t) => !t.parentTaskId && !isClosed(t.status) && t.dueDate && t.dueDate > today && t.dueDate <= last,
      )
      .map((t) => ({
        key: t.id,
        date: `${t.dueDate}T${t.dueTime ?? '99'}`,
        title: t.title,
        task: t.id,
        href: undefined,
        day: t.dueDate!,
      })),
    ...events
      .flatMap((e) =>
        occurrences(e, startOfDay(addDays(now, 1)).getTime(), endOfDay(addDays(now, 7)).getTime()),
      )
      .map((o) => ({
        key: `${o.event.id}@${o.start}`,
        date: format(o.start, "yyyy-MM-dd'T'HH:mm"),
        title: o.event.title,
        task: undefined,
        href: undefined,
        day: format(o.start, 'yyyy-MM-dd'),
      })),
    // Deadlines count from now (today's too): missing one is costly.
    ...datedItems(lists, records, startOfDay(now).getTime(), until + 1, profile?.timezone)
      .filter((d) => d.allDay || d.at >= now)
      .map((d) => {
        const v = d.record.custom[d.field.key] as { time?: string; tz?: string };
        const z = zoneLabel(v?.tz);
        return {
          key: `${d.record.id}:${d.field.key}`,
          date: format(d.at, "yyyy-MM-dd'T'HH:mm"),
          title: `${d.record.title} · ${d.field.name}${d.allDay ? '' : ` · ${format(d.at, 'HH:mm')}${z ? ` (${v.time} ${z})` : ''}`}`,
          task: undefined,
          href: `${listPath(d.collection.id)}?item=${d.record.id}`,
          day: format(d.at, 'yyyy-MM-dd'),
        };
      }),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;
  return (
    <Widget
      id="w-upcoming"
      title={WIDGETS.upcoming}
      link={<span className="text-muted text-xs">Next 7 days</span>}
    >
      <ul className="border-line divide-line divide-y rounded-2xl border">
        {rows.slice(0, 8).map((r) => (
          <li key={r.key}>
            <button
              type="button"
              disabled={!r.task && !r.href}
              onClick={() => (r.task ? openTask(r.task) : r.href && navigate(r.href))}
              className="hover:enabled:bg-surface-2/60 flex w-full items-center gap-4 px-4 py-3 text-left"
            >
              <span className="text-muted w-20 shrink-0 text-sm">{dateChipLabel(r.day, now)}</span>
              {r.href ? (
                <Flag className="text-danger size-3.5 shrink-0" />
              ) : (
                !r.task && <CalendarDays className="text-muted size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

export function ActiveProjects() {
  const projects = useProjects();
  const tasks = useAllTasks();
  const milestones = useMilestones();
  if (!projects || !tasks || !milestones) return null;
  const active = projects.filter((p) => p.status === 'active');
  if (!active.length) return null;
  return (
    <Widget
      id="w-projects"
      title={WIDGETS.projects}
      link={
        <Link to="/projects" className={linkCls}>
          All projects
        </Link>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {active.map((p) => {
          const prog = projectProgress(p, tasks, milestones);
          return (
            <li key={p.id}>
              <Link
                to={projectPath(p.id)}
                className="border-line hover:bg-surface-2/60 block rounded-2xl border px-4 py-3"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{p.title}</span>
                  <span className="text-muted text-xs tabular-nums">{prog.pct}%</span>
                </div>
                <ProgressBar pct={prog.pct} label={`${p.title} progress`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}
