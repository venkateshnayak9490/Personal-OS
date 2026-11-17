import { ListTodo } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Loading, Select } from '@/components/ui';
import { useAllTasks, useTags } from '@/core/hooks';
import { descendantIds, flatten } from '@/core/domain/tree';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { TaskComposer } from '@/features/tasks/TaskComposer';
import { TaskList } from '@/features/tasks/TaskList';

export function TasksPage() {
  const tasks = useAllTasks();
  const tags = useTags();
  const t = useNodeTree();
  const [section, setSection] = useState('');
  const [tag, setTag] = useState('');
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
        <Select
          aria-label="Filter by section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="h-10 w-auto min-w-40 md:h-9"
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
            className="h-10 w-auto min-w-32 md:h-9"
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
      {tasks ? (
        <TaskList tasks={filtered} showSection emptyText="Nothing open here. Add a task above." />
      ) : (
        <Loading />
      )}
    </>
  );
}
