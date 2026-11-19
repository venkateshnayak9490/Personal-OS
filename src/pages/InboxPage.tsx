import { Inbox } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Loading } from '@/components/ui';
import { useAllTasks, useCollections, useProjects } from '@/core/hooks';
import { useNodeTree } from '@/features/structure/use-tree';
import { useComposerContext } from '@/features/tasks/composer-context';
import { TaskComposer } from '@/features/tasks/TaskComposer';
import { TaskList } from '@/features/tasks/TaskList';

/** Tasks that don't belong to a section yet. Capture fast, sort later. */
export function InboxPage() {
  const tasks = useAllTasks();
  const t = useNodeTree();
  const projects = useProjects();
  const lists = useCollections();
  useComposerContext({});
  const inbox = useMemo(
    () => (tasks ?? []).filter((x) => !x.projectId && (!x.nodeId || (t && !t.byId.has(x.nodeId)))),
    [tasks, t],
  );
  if (!tasks || !t || !projects || !lists) return <Loading />;
  const moveTo = {
    projects: projects.filter((p) => !p.deletedAt && p.status === 'active'),
    lists: lists.filter((c) => !c.deletedAt),
  };
  return (
    <>
      <PageHeader
        title="Inbox"
        icon={Inbox}
        subtitle="Capture anything fast, then move it to a section, project, list or note."
      />
      <div className="mb-4">
        <TaskComposer
          variant="inline"
          showSection={false}
          placeholder="Capture: “submit review fri 5pm #thesis !high”"
        />
      </div>
      <TaskList
        tasks={inbox}
        moveTo={moveTo}
        emptyText="Inbox zero. Anything you add without a section lands here."
      />
    </>
  );
}
