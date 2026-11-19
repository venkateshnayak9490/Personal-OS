import type { EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { addDays, addHours, differenceInCalendarDays, format } from 'date-fns';
import { CalendarDays, Dumbbell, Flag, HeartPulse, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useMediaQuery } from '@/app/use-media-query';
import { useUIStore } from '@/app/ui-store';
import { PageHeader } from '@/components/PageHeader';
import { Button, Loading } from '@/components/ui';
import {
  useAllTasks,
  useCollections,
  useEvents,
  useMeetings,
  useProfile,
  useRecords,
  useRoutines,
  useWorkouts,
} from '@/core/hooks';
import { plannedOn } from '@/core/domain/fitness';
import { planOf, routineSlots } from '@/core/domain/health';
import { nodePath } from '@/app/nav';
import { datedItems, datedLabel, type DatedItem } from '@/core/domain/collections';
import { occurrences } from '@/core/domain/events';
import { isClosed } from '@/core/domain/tasks';
import type { CalendarEvent, Meeting, Task, WorkoutSession } from '@/core/domain/types';
import { updateEvent } from '@/core/repos/events';
import { updateTask } from '@/core/repos/tasks';
import { EventSheet, type EventDraft } from '@/features/calendar/EventSheet';
import { listPath } from '@/features/collections/ListsSection';
import { meetingPath } from '@/features/meetings/MeetingsSection';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

type Source =
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'task'; task: Task }
  | { kind: 'record'; item: DatedItem }
  | { kind: 'meeting'; meeting: Meeting }
  | { kind: 'workout'; workout: WorkoutSession }
  | { kind: 'gym' }
  | { kind: 'health' };

/** Layers you can switch off (events always show). Remembered on this device. */
const LAYERS = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'lists', label: 'List dates' },
  { key: 'gym', label: 'Gym' },
  { key: 'health', label: 'Health plan' },
];

export default function CalendarPage() {
  const events = useEvents();
  const tasks = useAllTasks();
  const profile = useProfile();
  const phone = useMediaQuery('(max-width: 767px)');
  const lists = useCollections();
  const records = useRecords();
  const meetings = useMeetings();
  const navigate = useNavigate();
  const t = useNodeTree();
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const routines = useRoutines();
  const workouts = useWorkouts();
  const hidden = useUIStore((s) => s.calendarHidden);
  const toggleLayer = useUIStore((s) => s.toggleCalendarLayer);
  const sectionOf = (moduleKey: string) => t?.nodes.find((n) => n.moduleKey === moduleKey && !n.deletedAt);

  const items = useMemo<EventInput[]>(() => {
    if (!events || !tasks || !lists || !records || !meetings || !range) return [];
    const out: EventInput[] = [];
    for (const ev of events)
      for (const o of occurrences(ev, range.from, range.to))
        out.push({
          id: `${ev.id}@${o.start}`,
          title: ev.title,
          start: o.start,
          end: o.end,
          allDay: ev.allDay,
          editable: !ev.rrule, // moving one repeat would move the whole series
          extendedProps: { kind: 'event', event: ev } satisfies Source,
        });
    for (const task of hidden.includes('tasks') ? [] : tasks) {
      if (!task.dueDate || task.parentTaskId || task.status === 'cancelled') continue;
      out.push({
        id: task.id,
        title: task.title,
        start: task.dueTime ? `${task.dueDate}T${task.dueTime}` : task.dueDate,
        allDay: !task.dueTime,
        durationEditable: false,
        classNames: ['pos-cal-task', isClosed(task.status) ? 'is-done' : ''],
        extendedProps: { kind: 'task', task } satisfies Source,
      });
    }
    // Dates and deadlines from lists (Conference deadlines, Experiments…). Edited in the list, not here.
    const dated = hidden.includes('lists')
      ? []
      : datedItems(lists, records, range.from, range.to, profile?.timezone);
    for (const item of dated)
      out.push({
        id: `${item.record.id}:${item.field.key}`,
        title: `${item.record.title} · ${datedLabel(item)}`,
        start: item.at,
        allDay: item.allDay,
        editable: false,
        classNames: ['pos-cal-task'],
        extendedProps: { kind: 'record', item } satisfies Source,
      });
    // Meetings made from a calendar event already show as that event.
    for (const m of meetings)
      if (!m.eventId && m.start >= range.from && m.start < range.to)
        out.push({
          id: `meeting-${m.id}`,
          title: m.title,
          start: m.start,
          end: m.start + 3_600_000,
          editable: false,
          extendedProps: { kind: 'meeting', meeting: m } satisfies Source,
        });
    const days: string[] = [];
    for (let d = new Date(range.from); d.getTime() < range.to; d = addDays(d, 1))
      days.push(format(d, 'yyyy-MM-dd'));
    // Gym: workouts you did, and the routine's planned day where none is logged yet.
    if (!hidden.includes('gym') && routines && workouts) {
      const live = workouts.filter((w) => !w.deletedAt);
      for (const w of live)
        if (w.startedAt && w.startedAt >= range.from && w.startedAt < range.to)
          out.push({
            id: `workout-${w.id}`,
            title: w.title,
            start: w.startedAt,
            end: w.endedAt ?? w.startedAt + 3_600_000,
            editable: false,
            classNames: ['pos-cal-task'],
            extendedProps: { kind: 'workout', workout: w } satisfies Source,
          });
      const active = routines.find((r) => r.active && !r.deletedAt && !r.paused);
      if (active?.byWeekday)
        for (const day of days) {
          const p = plannedOn(active, routines, day);
          const name = p.routine?.days[p.dayIndex]?.name;
          if (name && !live.some((w) => w.date === day))
            out.push({
              id: `gym-${day}`,
              title: `Gym: ${name}`,
              start: day,
              allDay: true,
              editable: false,
              classNames: ['pos-cal-task'],
              extendedProps: { kind: 'gym' } satisfies Source,
            });
        }
    }
    // Health: your repeating plan items ("Drink water every 2 hours", "Stretch at 11:00").
    const plan = planOf(profile?.settings);
    if (!hidden.includes('health') && plan?.routines?.length)
      for (const day of days)
        for (const r of plan.routines)
          for (const time of routineSlots(r, day))
            out.push({
              id: `health-${r.id}-${day}-${time}`,
              title: r.title,
              start: `${day}T${time}`,
              end: new Date(`${day}T${time}`).getTime() + 15 * 60_000,
              editable: false,
              classNames: ['pos-cal-task'],
              extendedProps: { kind: 'health' } satisfies Source,
            });
    return out;
  }, [
    events,
    tasks,
    lists,
    records,
    meetings,
    range,
    profile?.timezone,
    profile?.settings,
    hidden,
    routines,
    workouts,
  ]);

  if (!events || !tasks || profile === undefined) return <Loading />;

  const colorOf = (nodeId?: string) => colorFor(nodeId ? t?.colorOf(nodeId) : undefined).dot;

  const content = (arg: EventContentArg) => {
    const src = arg.event.extendedProps as Source | Record<string, never>;
    if (!src.kind) return <span className="px-1 tabular-nums">{arg.timeText}</span>; // the drag-to-create preview
    const nodeId =
      src.kind === 'event'
        ? src.event.nodeId
        : src.kind === 'task'
          ? src.task.nodeId
          : src.kind === 'meeting'
            ? src.meeting.nodeId
            : src.kind === 'record'
              ? src.item.record.nodeId
              : undefined;
    const marker =
      src.kind === 'workout' || src.kind === 'gym' ? (
        <Dumbbell className="size-3 shrink-0" />
      ) : src.kind === 'health' ? (
        <HeartPulse className="size-3 shrink-0" />
      ) : src.kind === 'record' ? (
        <Flag className="size-3 shrink-0" />
      ) : src.kind === 'task' ? (
        <span
          className={cn(
            'size-2.5 shrink-0 rounded-[3px] border-[1.5px] border-current',
            isClosed(src.task.status) && 'bg-current',
          )}
        />
      ) : (
        <span className={cn('size-2 shrink-0 rounded-full', colorOf(nodeId))} />
      );
    if (arg.view.type.startsWith('timeGrid') && !arg.event.allDay)
      return (
        <div className="min-w-0 overflow-hidden px-1 py-0.5 leading-tight">
          <div className="flex items-center gap-1.5 font-medium">
            {marker}
            <span className="truncate">{arg.event.title}</span>
          </div>
          <div className="text-muted truncate tabular-nums">{arg.timeText}</div>
        </div>
      );
    return (
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden px-1">
        {marker}
        {arg.timeText && !arg.event.allDay && (
          <span className="text-muted shrink-0 tabular-nums">{arg.timeText}</span>
        )}
        <span className="truncate">{arg.event.title}</span>
      </div>
    );
  };

  const moved = (arg: EventDropArg | EventResizeDoneArg) => {
    const src = arg.event.extendedProps as Source;
    const start = arg.event.start!;
    if (src.kind === 'task') {
      void attempt(() =>
        updateTask(src.task.id, {
          dueDate: format(start, 'yyyy-MM-dd'),
          dueTime: arg.event.allDay ? undefined : format(start, 'HH:mm'),
        }),
      );
      return;
    }
    if (src.kind !== 'event') return;
    const len = src.event.end - src.event.start;
    const end =
      arg.event.end?.getTime() ?? start.getTime() + (arg.event.allDay ? Math.max(len, 86_400_000) : len);
    void attempt(() => updateEvent(src.event.id, { start: start.getTime(), end, allDay: arg.event.allDay }));
  };

  const now = new Date();
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();

  return (
    <>
      <PageHeader
        title="Calendar"
        icon={CalendarDays}
        subtitle={
          phone
            ? 'Events and dated tasks together.'
            : 'Events and dated tasks together. Drag on the calendar to add an event.'
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setDraft({ mode: 'create', start: nextHour, end: nextHour + 3_600_000, allDay: false })
            }
          >
            <Plus className="size-4" /> New event
          </Button>
        }
      />
      <div role="group" aria-label="Calendar layers" className="mb-3 flex flex-wrap gap-1.5">
        {LAYERS.map((l) => {
          const on = !hidden.includes(l.key);
          return (
            <button
              key={l.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLayer(l.key)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium',
                on ? 'bg-fg text-bg border-transparent' : 'border-line text-muted hover:text-fg',
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <div className="pos-cal h-[max(36rem,calc(100dvh-12rem))]">
        <FullCalendar
          key={phone ? 'phone' : 'wide'}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={phone ? 'timeGrid3' : 'timeGridWeek'}
          // Phone: title and arrows on top, view switch at the bottom near the thumb.
          headerToolbar={
            phone
              ? { left: 'title', right: 'prev,next' }
              : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
          }
          footerToolbar={phone ? { left: 'today', right: 'dayGridMonth,timeGrid3,timeGridDay' } : undefined}
          buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
          height="100%"
          firstDay={profile?.weekStartsOn ?? 1}
          nowIndicator
          views={{
            timeGrid: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
            timeGrid3: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 days' },
          }}
          scrollTime="08:00:00"
          dayMaxEvents
          selectable
          selectMirror
          editable
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          datesSet={(a) => setRange({ from: a.start.getTime(), to: a.end.getTime() })}
          events={items}
          eventContent={content}
          eventDrop={moved}
          eventResize={moved}
          eventClick={(a) => {
            const src = a.event.extendedProps as Source;
            const gym = sectionOf('fitness');
            const health = sectionOf('health');
            if (src.kind === 'task') openTask(src.task.id);
            else if (src.kind === 'workout') navigate(`/workouts/${src.workout.id}`);
            else if (src.kind === 'gym') {
              if (gym) navigate(nodePath(gym.id));
            } else if (src.kind === 'health') {
              if (health) navigate(nodePath(health.id));
            } else if (src.kind === 'meeting') navigate(meetingPath(src.meeting.id));
            else if (src.kind === 'record')
              navigate(`${listPath(src.item.collection.id)}?item=${src.item.record.id}`);
            else setDraft({ mode: 'edit', event: src.event, occurrence: a.event.start?.getTime() });
          }}
          select={(a) => {
            a.view.calendar.unselect();
            // A click on a month day means "something that day", most often a meeting, not an all-day block.
            if (a.view.type === 'dayGridMonth' && differenceInCalendarDays(a.end, a.start) === 1) {
              const s = addHours(a.start, 9).getTime();
              setDraft({ mode: 'create', start: s, end: s + 3_600_000, allDay: false });
            } else
              setDraft({ mode: 'create', start: a.start.getTime(), end: a.end.getTime(), allDay: a.allDay });
          }}
        />
      </div>
      {draft && <EventSheet draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
