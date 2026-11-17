import { ListTodo } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Select } from '@/components/ui';
import { useAllTasks, useTags } from '@/core/hooks';
import { descendantIds, flatten } from '@/core/domain/tree';
import { useNodeTree } from '@/features/structure/use-tree';
import { QuickAdd, TaskList } from '@/features/tasks/TaskList';

export function TasksPage() {
  const tasks = useAllTasks();
  const tags = useTags();
  const t = useNodeTree();
  const [section, setSection] = useState('');
  const [tag, setTag] = useState('');

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
      <div className="mb-3">
        <QuickAdd placeholder="Add a task (no section)…" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          aria-label="Filter by section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="h-9 w-auto min-w-40"
        >
          <option value="">All sections</option>
          <option value="none">No section</option>
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
            className="h-9 w-auto min-w-32"
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
      {tasks && (
        <TaskList
          tasks={filtered}
          showSection
          emptyText="Add one above, or open a section to add tasks there."
        />
      )}
    </>
  );
}
