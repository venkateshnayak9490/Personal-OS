import { ArrowLeft, Check, FolderKanban, Plus, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState, Field, Loading, ProgressBar, Select, Textarea } from '@/components/ui';
import { useAllTasks, useGoals, useMilestones, useProfile, useProjects } from '@/core/hooks';
import { projectProgress } from '@/core/domain/progress';
import type { Milestone, Project, ProjectStatus, ProgressMode } from '@/core/domain/types';
import {
  addMilestone,
  deleteMilestone,
  deleteProject,
  toggleMilestone,
  updateProject,
  type ProjectChanges,
} from '@/core/repos/plans';
import { restoreFromTrash } from '@/core/repos/trash';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { useComposerContext } from '@/features/tasks/composer-context';
import { ProjectOutline } from '@/features/projects/ProjectOutline';
import { cn } from '@/lib/cn';
import { PROJECT_STATUS } from './ProjectsPage';

function Milestones({ project, milestones }: { project: Project; milestones: Milestone[] }) {
  const [title, setTitle] = useState('');
  return (
    <div>
      <ul>
        {milestones.map((m) => (
          <li key={m.id} className="group flex min-h-9 items-center gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={!!m.doneAt}
              aria-label={`${m.doneAt ? 'Reopen' : 'Complete'} milestone ${m.title}`}
              onClick={() => void attempt(() => toggleMilestone(m))}
              className={cn(
                'grid size-[18px] shrink-0 place-items-center rounded-md border-2',
                m.doneAt ? 'bg-fg border-fg text-bg' : 'border-muted/60',
              )}
            >
              {m.doneAt && <Check className="size-3" strokeWidth={3} />}
            </button>
            <span className={cn('flex-1 text-sm', m.doneAt && 'text-muted line-through')}>{m.title}</span>
            <button
              type="button"
              aria-label={`Delete milestone ${m.title}`}
              onClick={() => void attempt(() => deleteMilestone(m.id))}
              className="text-muted hover:text-danger rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void attempt(() => addMilestone(project.id, title));
          setTitle('');
        }}
      >
        <Plus className="text-muted size-4" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a milestone, e.g. Baseline reproduced"
          aria-label="Add a milestone"
          className="placeholder:text-muted/80 h-9 flex-1 bg-transparent text-sm focus:outline-none"
        />
      </form>
    </div>
  );
}

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const projects = useProjects();
  const tasks = useAllTasks();
  const allMilestones = useMilestones();
  const goals = useGoals();
  const profile = useProfile();
  const navigate = useNavigate();
  const project = projects?.find((p) => p.id === projectId);
  useComposerContext({ nodeId: project?.nodeId, projectId: project?.id });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);

  if (!projects || !tasks || !allMilestones || !goals) return <Loading />;
  if (!project)
    return (
      <EmptyState icon={FolderKanban} title="This project doesn’t exist">
        It may have been deleted.{' '}
        <Link to="/trash" className="text-fg font-medium underline">
          Open Trash
        </Link>
      </EmptyState>
    );

  const save = (changes: ProjectChanges) => void attempt(() => updateProject(project.id, changes));
  const milestones = allMilestones.filter((m) => m.projectId === project.id);
  const prog = projectProgress(project, tasks, allMilestones);

  return (
    <>
      <Link to="/projects" className="text-muted hover:text-fg mb-3 inline-flex items-center gap-1 text-xs">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>
      <input
        value={title ?? project.title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== null && title.trim() && title !== project.title) save({ title });
          setTitle(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Project name"
        className="font-display w-full bg-transparent text-4xl leading-tight font-semibold tracking-[-0.025em] focus:outline-none"
      />

      <div className="mt-5 mb-6 flex items-center gap-4">
        <ProgressBar pct={prog.pct} label="Project progress" className="h-2 flex-1" />
        <span className="text-muted text-sm tabular-nums">
          {prog.pct}%
          {project.progressMode !== 'manual' && prog.total ? ` · ${prog.done} of ${prog.total}` : ''}
        </span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Field label="Status" htmlFor="pr-status">
          <Select
            id="pr-status"
            value={project.status}
            onChange={(e) => save({ status: e.target.value as ProjectStatus })}
          >
            {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section" htmlFor="pr-node">
          <SectionSelect id="pr-node" value={project.nodeId} onChange={(nodeId) => save({ nodeId })} />
        </Field>
        <Field label="Goal" htmlFor="pr-goal">
          <Select
            id="pr-goal"
            value={project.goalId ?? ''}
            onChange={(e) => save({ goalId: e.target.value || undefined })}
          >
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <DatePicker
            value={project.dueDate ?? ''}
            weekStartsOn={profile?.weekStartsOn}
            onChange={(v) => save({ dueDate: v || undefined })}
          >
            <DateButton label="Project due date" value={project.dueDate} />
          </DatePicker>
        </Field>
        <Field label="Progress from" htmlFor="pr-mode">
          <Select
            id="pr-mode"
            value={project.progressMode}
            onChange={(e) => save({ progressMode: e.target.value as ProgressMode })}
          >
            <option value="tasks">Tasks</option>
            <option value="milestones">Milestones</option>
            <option value="manual">Set by hand</option>
          </Select>
        </Field>
      </div>

      {project.progressMode === 'manual' && (
        <Field
          label={`Progress: ${project.manualProgress ?? 0}%`}
          htmlFor="pr-manual"
          className="mb-8 max-w-sm"
        >
          <input
            id="pr-manual"
            type="range"
            min={0}
            max={100}
            step={5}
            defaultValue={project.manualProgress ?? 0}
            onPointerUp={(e) => save({ manualProgress: Number((e.target as HTMLInputElement).value) })}
            onKeyUp={(e) => save({ manualProgress: Number((e.target as HTMLInputElement).value) })}
            className="w-full accent-[var(--fg)]"
          />
        </Field>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
        <ProjectOutline project={project} />
        <aside className="space-y-8">
          <section aria-labelledby="pr-ms">
            <h2 id="pr-ms" className="mb-2 text-sm font-semibold">
              Milestones
            </h2>
            <Milestones project={project} milestones={milestones} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Notes</h2>
            <Textarea
              value={desc ?? project.description ?? ''}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => {
                if (desc !== null && desc !== (project.description ?? ''))
                  save({ description: desc || undefined });
                setDesc(null);
              }}
              placeholder="Why this project, links, scope…"
              aria-label="Project notes"
            />
          </section>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash className="size-3.5" /> Delete project
          </Button>
        </aside>
      </div>

      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${project.title}”?`}
        description="It moves to Trash with its milestones. Its tasks stay where they are."
        confirmLabel="Move to Trash"
        danger
        onConfirm={async () => {
          const batch = await attempt(() => deleteProject(project.id));
          if (batch) {
            toast(`Moved “${project.title}” to Trash`, () => restoreFromTrash(batch));
            navigate('/projects', { replace: true });
          }
        }}
      />
    </>
  );
}
