import { ArrowLeft, FolderKanban, Plus, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Confirm } from '@/components/Sheet';
import { useNow } from '@/app/use-now';
import {
  Badge,
  BlockHeader,
  Button,
  EmptyState,
  Field,
  Loading,
  ProgressBar,
  Select,
  StatusMark,
  Textarea,
} from '@/components/ui';
import { useAllTasks, useGoals, useMilestones, useProfile, useProjects } from '@/core/hooks';
import { projectProgress } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
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
import { LinkedNotes } from '@/features/notes/LinkedNotes';
import { ProjectOutline } from '@/features/projects/ProjectOutline';
import { TaskCheck } from '@/features/tasks/TaskBits';
import { cn } from '@/lib/cn';
import { PROJECT_STATUS } from './ProjectsPage';

function Milestones({ project, milestones }: { project: Project; milestones: Milestone[] }) {
  const [title, setTitle] = useState('');
  return (
    <ul className="divide-line divide-y">
      {milestones.map((m) => (
        <li key={m.id} className="group flex min-h-11 items-center gap-3 md:min-h-9">
          <TaskCheck
            status={m.doneAt ? 'completed' : 'not_started'}
            priority={4}
            small
            label={`${m.doneAt ? 'Reopen' : 'Complete'} milestone ${m.title}`}
            onClick={() => void attempt(() => toggleMilestone(m))}
          />
          <span
            className={cn('min-w-0 flex-1 text-[15px] md:text-sm', m.doneAt && 'text-muted line-through')}
          >
            {m.title}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete milestone ${m.title}`}
            onClick={() => void attempt(() => deleteMilestone(m.id))}
            className="hover:text-danger md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
      <li>
        <form
          className="flex min-h-11 items-center gap-3 md:min-h-9"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void attempt(() => addMilestone(project.id, title));
            setTitle('');
          }}
        >
          <Plus aria-hidden className="text-muted size-4 shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a milestone, e.g. Baseline reproduced"
            aria-label="Add a milestone"
            className="placeholder:text-muted h-11 min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none md:h-9 md:text-sm"
          />
        </form>
      </li>
    </ul>
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
  const now = useNow();
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

  const finished = project.status === 'completed' || project.status === 'cancelled';
  const overdue = !finished && !!project.dueDate && project.dueDate < toLocalDate(now);
  const msDone = milestones.filter((m) => m.doneAt).length;

  return (
    <>
      <Link
        to="/projects"
        className="text-meta text-muted hover:text-fg mb-2 inline-flex min-h-11 items-center gap-1 md:min-h-8"
      >
        <ArrowLeft className="size-3.5" /> Projects
      </Link>
      <div className="mb-6">
        {/* The sheet heading, editable: title over the 2px ink rule, like PageHeader. */}
        <input
          value={title ?? project.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== null && title.trim() && title !== project.title) save({ title });
            setTitle(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Project name"
          className="title-page border-fg block field-sizing-content max-w-full min-w-48 border-b-2 bg-transparent pb-2 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <ProgressBar pct={prog.pct} label="Project progress" className="h-2 min-w-40 flex-1" />
          <span className="text-muted text-sm">
            {prog.pct}%
            {project.progressMode !== 'manual' && prog.total ? ` · ${prog.done} of ${prog.total}` : ''}
          </span>
          <span className="flex items-center gap-2">
            {project.status === 'completed' && <StatusMark mark="done" />}
            <Badge>{PROJECT_STATUS[project.status]}</Badge>
            {overdue && <Badge tone="danger">Overdue</Badge>}
          </span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <ProjectOutline project={project} />
        <aside className="space-y-10">
          <section aria-labelledby="pr-ms">
            <BlockHeader
              id="pr-ms"
              title="Milestones"
              action={milestones.length ? `${msDone} of ${milestones.length} done` : undefined}
            />
            <Milestones project={project} milestones={milestones} />
          </section>

          <section aria-labelledby="pr-details">
            <BlockHeader id="pr-details" title="Details" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
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
              <Field label="Due date">
                <DatePicker
                  value={project.dueDate ?? ''}
                  weekStartsOn={profile?.weekStartsOn}
                  onChange={(v) => save({ dueDate: v || undefined })}
                >
                  <DateButton label="Project due date" value={project.dueDate} />
                </DatePicker>
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
              <Field label="Progress from" htmlFor="pr-mode" className="col-span-2 lg:col-span-1">
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
              {project.progressMode === 'manual' && (
                <Field
                  label={`Progress: ${project.manualProgress ?? 0}%`}
                  htmlFor="pr-manual"
                  className="col-span-2 lg:col-span-1"
                >
                  <input
                    id="pr-manual"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    defaultValue={project.manualProgress ?? 0}
                    onPointerUp={(e) =>
                      save({ manualProgress: Number((e.target as HTMLInputElement).value) })
                    }
                    onKeyUp={(e) => save({ manualProgress: Number((e.target as HTMLInputElement).value) })}
                    className="h-11 w-full accent-[var(--fg)] md:h-8"
                  />
                </Field>
              )}
            </div>
          </section>

          <section aria-labelledby="pr-about">
            <BlockHeader id="pr-about" title="About this project" />
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
          <LinkedNotes projectId={project.id} nodeId={project.nodeId} />
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash className="size-4" /> Delete project
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
