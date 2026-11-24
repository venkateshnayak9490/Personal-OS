import { addDays, eachDayOfInterval, endOfWeek, format, parseISO } from 'date-fns';
import { ListTodo } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useNow } from '@/app/use-now';
import { dateChipLabel } from '@/components/DatePicker';
import { PageHeader } from '@/components/PageHeader';
import { Loading, Select, Segmented } from '@/components/ui';
import { useAllTasks, useProfile, useTags } from '@/core/hooks';
import { isClosed, toLocalDate } from '@/core/domain/tasks';
import { descendantIds, flatten } from '@/core/domain/tree';
import type { Task } from '@/core/domain/types';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { TaskComposer } from '@/features/tasks/TaskComposer';
import { DayHead, TaskList } from '@/features/tasks/TaskList';

const VIEWS = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'This week' },
  { value: 'upcoming', label: 'Upcoming' },
] as const;
type View = (typeof VIEWS)[number]['value'];

interface Group {
  key: string;
  title: string;
  hint?: string;
  tasks: Task[];
}

/**
 * Open tasks grouped by due date (overdue first).
 * week: every day left in this week, even free ones. upcoming: every later date that has something due.
 */
export function dayGroups(
  tasks: Task[],
  view: 'week' | 'upcoming',
  now: number,
  weekStartsOn: 0 | 1 = 1,
): Group[] {
  const today = toLocalDate(now);
  const open = tasks.filter((t) => !t.parentTaskId && !isClosed(t.status) && t.dueDate);
  const withSubs = (top: Task[]) => {
    const ids = new Set(top.map((t) => t.id));
    return [...top, ...tasks.filter((t) => t.parentTaskId && ids.has(t.parentTaskId))];
  };
  const byDay = new Map<string, Task[]>();
  for (const t of open) byDay.set(t.dueDate!, [...(byDay.get(t.dueDate!) ?? []), t]);
  const day = (d: string): Group => {
    const label = dateChipLabel(d, now);
    return {
      key: d,
      title: label,
      hint: label === 'Today' || label === 'Tomorrow' ? format(parseISO(d), 'EEE d MMM') : undefined,
      tasks: withSubs(byDay.get(d) ?? []),
    };
  };
  const groups: Group[] = [];
  if (view === 'week') {
    const overdue = open.filter((t) => t.dueDate! < today);
    if (overdue.length) groups.push({ key: 'overdue', title: 'Overdue', tasks: withSubs(overdue) });
    const end = endOfWeek(now, { weekStartsOn });
    for (const d of eachDayOfInterval({ start: now, end })) groups.push(day(format(d, 'yyyy-MM-dd')));
  } else {
    const from = format(addDays(now, 1), 'yyyy-MM-dd');
    for (const d of [...byDay.keys()].filter((d) => d >= from).sort()) groups.push(day(d));
  }
  return groups;
}

export function TasksPage() {
  const tasks = useAllTasks();
  const tags = useTags();
  const t = useNodeTree();
  const [section, setSection] = useState('');
  const [tag, setTag] = useState('');
  const [params, setParams] = useSearchParams();
  const view: View = VIEWS.some((v) => v.value === params.get('view')) ? (params.get('view') as View) : 'all';
  const now = useNow();
  const profile = useProfile();
  // New tasks go to the section you're filtering by, so they never vanish behind the filter.
  const targetNode = section && section !== 'none' ? section : undefined;
  useComposerContext({ nodeId: targetNode });

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (section === 'none') list = list.filter((x) => !x.nodeId || !t?.byId.has(x.nodeId));
    else if (section && t) {
      const ids = new Set([section, ...descendantIds(t.nodes, section)]);
      list = list.filter((x) => x.nodeId && ids.has(x.nodeId));
    }
    if (tag) list = list.filter((x) => x.tags.includes(tag));
    return list;
  }, [tasks, section, tag, t]);

  return (
    <>
      <PageHeader title="All Tasks" icon={ListTodo} subtitle="Every task from every section." />
      <div className="mb-4">
        <TaskComposer variant="inline" nodeId={targetNode} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented
          as="tabs"
          label="View"
          options={VIEWS}
          value={view}
          onChange={(v) => setParams(v === 'all' ? {} : { view: v }, { replace: true })}
        />
        <Select
          aria-label="Filter by section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="h-10 w-full md:h-9 md:w-auto md:min-w-40"
        >
          <option value="">All sections</option>
          <option value="none">Inbox (no section)</option>
          {t &&
            flatten(t.tree).map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(depth * 2)}
                {node.title}
              </option>
            ))}
        </Select>
        {tags && tags.length > 0 && (
          <Select
            aria-label="Filter by tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="h-10 w-full md:h-9 md:w-auto md:min-w-32"
          >
            <option value="">All tags</option>
            {tags.map((x) => (
              <option key={x.id} value={x.id}>
                #{x.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {!tasks ? (
        <Loading />
      ) : view === 'all' ? (
        <TaskList grouped tasks={filtered} showSection emptyText="Nothing open here. Add a task above." />
      ) : (
        <DayGroups groups={dayGroups(filtered, view, now, profile?.weekStartsOn)} view={view} />
      )}
    </>
  );
}

function DayGroups({ groups, view }: { groups: Group[]; view: 'week' | 'upcoming' }) {
  if (!groups.length)
    return (
      <p className="text-muted py-8 text-sm">
        Nothing due after today. Give a task a date and it shows up here.
      </p>
    );
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`day-${g.key}`}>
          <DayHead
            id={`day-${g.key}`}
            title={g.title}
            hint={g.hint}
            count={g.tasks.filter((t) => !t.parentTaskId).length}
            danger={g.key === 'overdue'}
          />
          {g.tasks.length ? (
            <TaskList tasks={g.tasks} hideFilters showSection />
          ) : (
            <p className="text-muted py-2 text-xs">{view === 'week' ? 'Free' : ''}</p>
          )}
        </section>
      ))}
    </div>
  );
}
