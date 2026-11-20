import { ChevronDown, ChevronRight, FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { dateChipLabel } from '@/components/DatePicker';
import { PageHeader } from '@/components/PageHeader';
import { BlockHeader, Button, EmptyState, Input, Loading, ProgressBar, StatusMark } from '@/components/ui';
import { useAllTasks, useGoals, useMilestones, useProjects } from '@/core/hooks';
import { projectProgress } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
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

  const today = toLocalDate(now);
  const row = (p: Project) => {
    const prog = projectProgress(p, tasks, milestones);
    const node = p.nodeId ? t?.byId.get(p.nodeId) : undefined;
    const goal = p.goalId ? goals.find((g) => g.id === p.goalId) : undefined;
    const finished = p.status === 'completed' || p.status === 'cancelled';
    const overdue = !finished && !!p.dueDate && p.dueDate < today;
    return (
      <li key={p.id}>
        <Link
          to={projectPath(p.id)}
          className="hover:bg-surface-2/60 grid grid-cols-[1fr_6rem] items-center gap-4 py-3 transition-colors md:grid-cols-[1fr_9rem_1rem]"
        >
          <div className="min-w-0">
            <div
              className={cn(
                'flex items-center gap-2 text-[15px] font-medium md:text-sm',
                finished && 'text-muted',
              )}
            >
              {p.status === 'completed' && <StatusMark mark="done" />}
              <span className={cn('truncate', p.status === 'cancelled' && 'line-through')}>{p.title}</span>
            </div>
            <div className="text-meta text-muted mt-0.5 flex flex-wrap items-center gap-x-3">
              {finished && <span>{PROJECT_STATUS[p.status]}</span>}
              {node && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn('size-2 rounded-xs', colorFor(t?.colorOf(node.id)).dot)} />
                  {node.title}
                </span>
              )}
              {goal && <span>Goal: {goal.title}</span>}
              {p.dueDate && (
                <span className={cn(overdue && 'text-danger font-medium')}>
                  {overdue ? 'Overdue, due' : 'Due'} {dateChipLabel(p.dueDate, now)}
                </span>
              )}
            </div>
          </div>
          <div>
            <ProgressBar pct={prog.pct} label={`${p.title} progress`} />
            <div className="text-meta text-muted mt-1 text-right">
              {p.progressMode === 'manual'
                ? `${prog.pct}%`
                : prog.total
                  ? `${prog.done}/${prog.total}`
                  : 'No tasks yet'}
            </div>
          </div>
          <ChevronRight aria-hidden className="text-muted hidden size-4 md:block" />
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
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />
      {adding && (
        <form
          className="mb-8 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="Project name, e.g. Grasping baseline for CoRL"
            aria-label="New project name"
            className="flex-1"
          />
          <Button type="submit" disabled={!title.trim()}>
            Create
          </Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      )}
      {projects.length === 0 && !adding ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          action={
            <Button onClick={() => setAdding(true)}>
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
          const id = `projects-${g.statuses[0]}`;
          return (
            <section key={g.title} aria-labelledby={id} className="mb-10">
              <BlockHeader
                id={id}
                title={g.title}
                count={list.length}
                action={
                  g.collapsed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={open}
                      onClick={() => setShowFinished(!showFinished)}
                      className="-my-1.5"
                    >
                      <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
                      {open ? 'Hide' : 'Show'}
                    </Button>
                  )
                }
              />
              {open && <ul className="divide-line divide-y">{list.map(row)}</ul>}
            </section>
          );
        })
      )}
    </>
  );
}
