import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUIStore } from '@/app/ui-store';
import { useNow } from '@/app/use-now';
import { BlockHeader, Button } from '@/components/ui';
import { useAllTasks, useCollections, useEvents, useProfile, useRecords } from '@/core/hooks';
import { datedItems } from '@/core/domain/collections';
import { describeRule, parseRRule } from '@/core/domain/recurrence';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { descendantIds } from '@/core/domain/tree';
import type { SectionNode } from '@/core/domain/types';
import { EventSheet, type EventDraft } from '@/features/calendar/EventSheet';
import type { NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';
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
      nodeId: d.collection.nodeId!,
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
        nodeId: x.nodeId!,
        task: x.id,
      })),
  ].sort((a, b) => a.at - b.at);

  return (
    <section aria-labelledby="cw-due" className="mb-10">
      <BlockHeader id="cw-due" title={`Due in the next ${DAYS} days`} />
      {due.length === 0 ? (
        <p className="text-muted py-2 text-[15px] md:text-sm">Nothing due across your courses.</p>
      ) : (
        <ul aria-label="Due across courses" className="divide-line divide-y">
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
                  className={cn(
                    'text-meta w-24 shrink-0 tabular-nums',
                    days < 0 ? 'text-danger font-medium' : 'text-muted',
                  )}
                >
                  {when}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium md:text-sm">{d.title}</span>
                {d.course && (
                  <span className="text-meta text-muted flex shrink-0 items-center gap-1.5 max-sm:hidden">
                    <span aria-hidden className={cn('size-2 rounded-xs', colorFor(tree.colorOf(d.nodeId)).dot)} />
                    {d.course}
                  </span>
                )}
                {d.course && <span className="text-meta text-muted basis-full pl-27 sm:hidden">{d.course}</span>}
              </>
            );
            const cls = 'hover:bg-surface-2 flex min-h-11 w-full flex-wrap items-baseline gap-x-3 py-2.5 text-left';
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
    <section aria-labelledby="course-classes" className="mb-10">
      <BlockHeader
        id="course-classes"
        title="Classes"
        action={
          <Button size="sm" variant="ghost" className="-mr-2" onClick={add}>
            <Plus className="size-4" /> Add class time
          </Button>
        }
      />
      {classes.length === 0 ? (
        <p className="text-muted py-2 text-[15px] md:text-sm">
          No class times yet. Add the weekly times and they show on your calendar.
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {classes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setDraft({ mode: 'edit', event: e })}
                className="hover:bg-surface-2 flex min-h-11 w-full flex-wrap items-baseline gap-x-3 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium tabular-nums md:text-sm">
                  {describeRule(parseRRule(e.rrule!))}, {format(e.start, 'h:mm a')}–{format(e.end, 'h:mm a')}
                </span>
                {e.location && <span className="text-meta text-muted shrink-0">{e.location}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {draft && <EventSheet draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
}
