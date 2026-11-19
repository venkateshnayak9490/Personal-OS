import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CalendarClock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import { useAllTasks, useCollections, useEvents, useProfile, useRecords } from '@/core/hooks';
import { datedItems } from '@/core/domain/collections';
import { describeRule, parseRRule } from '@/core/domain/recurrence';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { descendantIds } from '@/core/domain/tree';
import type { SectionNode } from '@/core/domain/types';
import { EventSheet, type EventDraft } from '@/features/calendar/EventSheet';
import type { NodeTree } from '@/features/structure/use-tree';
import { listPath } from './ListsSection';

const DAYS = 14;

/** Coursework: what's due in the next two weeks across every course (assessments and tasks). */
export function CourseworkDue({ node, tree }: { node: SectionNode; tree: NodeTree }) {
  const lists = useCollections();
  const records = useRecords();
  const tasks = useAllTasks();
  const profile = useProfile();
  const now = useNow(60_000);
  const openTask = useUIStore((s) => s.setEditingTaskId);
  if (!lists || !records || !tasks) return null;
  const today = toLocalDate(now, profile?.timezone);
  const end = addDays(parseISO(today), DAYS + 1).getTime();
  const inside = new Set([node.id, ...descendantIds(tree.nodes, node.id)]);
  const courses = lists.filter((c) => c.templateKey === 'course' && c.nodeId && inside.has(c.nodeId));
  const due = [
    ...datedItems(courses, records, 0, end, profile?.timezone).map((d) => ({
      key: `${d.record.id}:${d.field.key}`,
      at: d.at,
      title: d.record.title,
      course: tree.byId.get(d.collection.nodeId!)?.title,
      link: `${listPath(d.collection.id)}?item=${d.record.id}`,
    })),
    ...tasks
      .filter(
        (x) =>
          x.nodeId &&
          inside.has(x.nodeId) &&
          !x.parentTaskId &&
          !isClosed(x.status) &&
          !!x.dueDate &&
          x.dueDate <= format(end, 'yyyy-MM-dd'),
      )
      .map((x) => ({
        key: x.id,
        at: parseISO(x.dueDate!).getTime(),
        title: x.title,
        course: tree.byId.get(x.nodeId!)?.title,
        task: x.id,
      })),
  ].sort((a, b) => a.at - b.at);

  return (
    <section aria-labelledby="cw-due" className="mb-8">
      <h2 id="cw-due" className="mb-2 text-sm font-semibold">
        Due in the next {DAYS} days
      </h2>
      {due.length === 0 ? (
        <p className="text-muted text-sm">Nothing due across your courses.</p>
      ) : (
        <ul aria-label="Due across courses" className="border-line divide-line divide-y rounded-2xl border">
          {due.map((d) => {
            const days = differenceInCalendarDays(d.at, parseISO(today));
            const when =
              days < 0
                ? 'Overdue'
                : days === 0
                  ? 'Today'
                  : days === 1
                    ? 'Tomorrow'
                    : format(d.at, 'EEE d MMM');
            const body = (
              <>
                <span
                  className={
                    days < 0 ? 'text-danger w-24 shrink-0 text-xs' : 'text-muted w-24 shrink-0 text-xs'
                  }
                >
                  {when}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                {d.course && <span className="text-muted shrink-0 text-xs">{d.course}</span>}
              </>
            );
            const cls = 'hover:bg-surface-2/60 flex w-full items-baseline gap-3 px-4 py-2.5 text-left';
            return (
              <li key={d.key}>
                {'task' in d ? (
                  <button type="button" className={cls} onClick={() => openTask(d.task!)}>
                    {body}
                  </button>
                ) : (
                  <Link to={d.link} className={cls}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A course's weekly classes: repeating calendar events in this course's section. */
export function CourseClasses({ node }: { node: SectionNode }) {
  const events = useEvents();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  if (!events) return null;
  const classes = events.filter((e) => e.nodeId === node.id && e.rrule && !e.deletedAt);
  const add = () => {
    const nine = new Date();
    nine.setHours(9, 0, 0, 0);
    setDraft({
      mode: 'create',
      start: nine.getTime(),
      end: nine.getTime() + 3_600_000,
      allDay: false,
      title: node.title,
      nodeId: node.id,
      repeat: 'weekly',
    });
  };
  return (
    <section aria-labelledby="course-classes" className="mb-8">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="course-classes" className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <CalendarClock className="text-muted size-4" /> Classes
        </h2>
        <Button size="sm" variant="ghost" onClick={add}>
          <Plus className="size-4" /> Add class time
        </Button>
      </div>
      {classes.length > 0 && (
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {classes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setDraft({ mode: 'edit', event: e })}
                className="hover:bg-surface-2/60 flex w-full items-baseline gap-3 px-4 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {describeRule(parseRRule(e.rrule!))}, {format(e.start, 'h:mm a')}–{format(e.end, 'h:mm a')}
                </span>
                {e.location && <span className="text-muted shrink-0 text-xs">{e.location}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {draft && <EventSheet draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
}
