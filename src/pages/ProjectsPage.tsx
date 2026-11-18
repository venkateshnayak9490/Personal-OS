import { ChevronRight, FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { dateChipLabel } from '@/components/DatePicker';
import { PageHeader } from '@/components/PageHeader';
import { Button, EmptyState, Loading, ProgressBar } from '@/components/ui';
import { useAllTasks, useGoals, useMilestones, useProjects } from '@/core/hooks';
import { projectProgress } from '@/core/domain/progress';
import type { Project, ProjectStatus } from '@/core/domain/types';
import { createProject } from '@/core/repos/plans';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

export const PROJECT_STATUS: Record<ProjectStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const GROUPS: { title: string; statuses: ProjectStatus[]; collapsed?: boolean }[] = [
  { title: 'Active', statuses: ['active'] },
  { title: 'Planned', statuses: ['planned'] },
  { title: 'On hold', statuses: ['on_hold'] },
  { title: 'Finished', statuses: ['completed', 'cancelled'], collapsed: true },
];

export const projectPath = (id: string) => `/projects/${id}`;

export function ProjectsPage() {
  const projects = useProjects();
  const tasks = useAllTasks();
  const milestones = useMilestones();
  const goals = useGoals();
  const t = useNodeTree();
  const now = useNow();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showFinished, setShowFinished] = useState(false);

  if (!projects || !tasks || !milestones || !goals) return <Loading />;

  const create = async () => {
    if (!title.trim()) return;
    const p = await attempt(() => createProject({ title }));
    setTitle('');
    setAdding(false);
    if (p) navigate(projectPath(p.id));
  };

  const row = (p: Project) => {
    const prog = projectProgress(p, tasks, milestones);
    const node = p.nodeId ? t?.byId.get(p.nodeId) : undefined;
    const goal = p.goalId ? goals.find((g) => g.id === p.goalId) : undefined;
    return (
      <li key={p.id}>
        <Link
          to={projectPath(p.id)}
          className="hover:bg-surface-2/60 grid grid-cols-[1fr_9rem_1.25rem] items-center gap-4 px-4 py-3 transition-colors"
        >
          <div className="min-w-0">
            <div
              className={cn(
                'truncate text-sm font-medium',
                p.status === 'cancelled' && 'text-muted line-through',
              )}
            >
              {p.title}
            </div>
            <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
              {node && (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', colorFor(t?.colorOf(node.id)).dot)} />
                  {node.title}
                </span>
              )}
              {goal && <span>Goal: {goal.title}</span>}
              {p.dueDate && <span>Due {dateChipLabel(p.dueDate, now)}</span>}
            </div>
          </div>
          <div>
            <ProgressBar pct={prog.pct} label={`${p.title} progress`} />
            <div className="text-muted mt-1 text-right text-xs tabular-nums">
              {p.progressMode === 'manual'
                ? `${prog.pct}%`
                : prog.total
                  ? `${prog.done}/${prog.total}`
                  : 'No tasks yet'}
            </div>
          </div>
          <ChevronRight className="text-muted size-4" />
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Projects"
        icon={FolderKanban}
        subtitle="Bigger pieces of work, made of tasks and milestones."
        actions={
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />
      {adding && (
        <form
          className="border-line mb-6 flex items-center gap-2 rounded-xl border px-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <FolderKanban className="text-muted size-4" />
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="Project name, e.g. Grasping baseline for CoRL"
            aria-label="New project name"
            className="placeholder:text-muted/80 h-11 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>
            Create
          </Button>
        </form>
      )}
      {projects.length === 0 && !adding ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> New project
            </Button>
          }
        >
          A project groups tasks toward one outcome, like a paper submission or a course project, and shows
          honest progress.
        </EmptyState>
      ) : (
        GROUPS.map((g) => {
          const list = projects.filter((p) => g.statuses.includes(p.status));
          if (!list.length) return null;
          const open = !g.collapsed || showFinished;
          return (
            <section key={g.title} className="mb-6">
              <button
                type="button"
                disabled={!g.collapsed}
                onClick={() => setShowFinished(!showFinished)}
                className="text-muted mb-2 flex items-center gap-1 text-xs font-medium"
              >
                {g.collapsed && (
                  <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                )}
                {g.title} <span className="tabular-nums">({list.length})</span>
              </button>
              {open && (
                <ul className="border-line divide-line divide-y rounded-xl border">{list.map(row)}</ul>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
