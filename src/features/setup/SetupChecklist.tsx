import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useInstallStore } from '@/app/pwa-install';
import { attempt } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { BlockHeader, Button } from '@/components/ui';
import { downloadBackup, LAST_BACKUP_KEY } from '@/core/backup';
import { db } from '@/core/db';
import { useAllTasks, useMeta } from '@/core/hooks';
import { splitList, SUGGESTED_SECTIONS } from '@/core/domain/templates';
import { createNode } from '@/core/repos/nodes';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';

export const SETUP_KEY = 'setup';
interface SetupState {
  dismissed?: boolean;
  reviewedSections?: boolean;
}

async function saveSetup(changes: SetupState) {
  const cur = ((await db.meta.get(SETUP_KEY))?.value as SetupState | undefined) ?? {};
  await db.meta.put({ key: SETUP_KEY, value: { ...cur, ...changes } });
}

interface Step {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  body?: ReactNode;
}

/** Adds sub-sections from a comma-separated list ("Physical AI, Robot learning"). */
function ListAdder({ parentId, icon, placeholder }: { parentId: string; icon: string; placeholder: string }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const names = splitList(value);
        if (!names.length) return;
        // No toast: the step ticks itself off, which is confirmation enough.
        void attempt(async () => {
          for (const title of names) await createNode({ title, parentId, icon });
          setValue('');
        });
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="border-line bg-bg placeholder:text-muted/80 focus:border-fg/40 h-11 min-w-0 flex-1 rounded-xl border px-3 text-base focus:outline-none md:h-9 md:rounded-lg md:text-sm"
      />
      <Button type="submit" size="sm" variant="primary" className="h-11 md:h-9" disabled={!value.trim()}>
        Add
      </Button>
    </form>
  );
}

/** Live list of setup suggestions; `visible` is false once everything is done or the user hides it. */
export function useSetupSteps(): { steps: Step[]; visible: boolean } | undefined {
  const t = useNodeTree();
  const tasks = useAllTasks();
  const lastBackup = useMeta<number>(LAST_BACKUP_KEY);
  const state = useLiveQuery(
    async () => ((await db.meta.get(SETUP_KEY))?.value as SetupState | undefined) ?? {},
    [],
  );
  const installed = useInstallStore((s) => s.installed);
  const canInstall = useInstallStore((s) => !!s.deferred);
  const promptInstall = useInstallStore((s) => s.promptInstall);
  const openComposer = useUIStore((s) => s.setComposerOpen);

  if (!t || !tasks || !state) return undefined;
  const byTemplate = (key: string) =>
    t.nodes.find((n) => n.config.templateKey === key && !n.hidden && !n.deletedAt);
  const hasChildren = (id: string) => t.nodes.some((n) => n.parentId === id);
  const research = byTemplate('research');
  // One-tap extras that aren't seeded; each disappears once a section of that name exists.
  const suggestions = SUGGESTED_SECTIONS.flatMap((s) => {
    const parent = byTemplate(s.parent);
    return parent && !t.nodes.some((n) => n.title === s.title && !n.deletedAt)
      ? [{ ...s, parentId: parent.id }]
      : [];
  });
  const coursework = byTemplate('coursework');

  const steps: Step[] = [];
  if (research)
    steps.push({
      key: 'research',
      title: 'Add your research areas',
      hint: 'Each one becomes its own place inside Research.',
      done: hasChildren(research.id),
      body: <ListAdder parentId={research.id} icon="atom" placeholder="e.g. Physical AI, Robot learning" />,
    });
  if (coursework)
    steps.push({
      key: 'courses',
      title: 'Add your courses',
      hint: 'One place per course inside Coursework.',
      done: hasChildren(coursework.id),
      body: <ListAdder parentId={coursework.id} icon="book" placeholder="e.g. SMAI" />,
    });
  steps.push({
    key: 'task',
    title: 'Add your first task',
    hint: 'Type it, press Enter. Dates and priority are optional.',
    done: tasks.length > 0,
    body: (
      <Button size="sm" variant="primary" onClick={() => openComposer(true)}>
        New task
      </Button>
    ),
  });
  steps.push({
    key: 'sections',
    title: 'Make the sections yours',
    hint: 'Rename, reorder or hide anything you won’t use.',
    done: !!state.reviewedSections,
    body: (
      <div className="flex flex-wrap gap-2">
        <Link to="/settings/sections" onClick={() => void saveSetup({ reviewedSections: true })}>
          <Button size="sm" tabIndex={-1}>
            Edit sections
          </Button>
        </Link>
        {suggestions.map((s) => (
          <Button
            key={s.title}
            size="sm"
            variant="ghost"
            onClick={() =>
              void attempt(() => createNode({ title: s.title, parentId: s.parentId, icon: s.icon }))
            }
          >
            + {s.title}
          </Button>
        ))}
      </div>
    ),
  });
  steps.push({
    key: 'install',
    title: 'Install on this device',
    hint: canInstall
      ? 'It opens like an app and works offline.'
      : 'In Chrome, open the ⋮ menu and choose “Install app” or “Add to Home screen”.',
    done: installed,
    body: canInstall ? (
      <Button size="sm" variant="primary" onClick={() => void promptInstall()}>
        Install
      </Button>
    ) : undefined,
  });
  steps.push({
    key: 'backup',
    title: 'Download a backup',
    hint: 'Your data lives only on this device until sync arrives.',
    done: lastBackup !== undefined,
    body: (
      <Button size="sm" onClick={() => void attempt(downloadBackup)}>
        Download backup
      </Button>
    ),
  });

  const visible = !state.dismissed && steps.some((s) => !s.done);
  return { steps, visible };
}

export function SetupChecklist() {
  const setup = useSetupSteps();
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!setup?.visible) return null;
  const { steps } = setup;
  const doneCount = steps.filter((s) => s.done).length;
  const firstOpen = steps.find((s) => !s.done)?.key;
  const expanded = openKey ?? firstOpen;

  return (
    <section aria-labelledby="setup-heading" className="mb-10">
      <BlockHeader
        id="setup-heading"
        title="Finish setting up"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="-my-1.5"
            onClick={() => void saveSetup({ dismissed: true })}
          >
            Hide
          </Button>
        }
      />
      <p className="text-muted text-[13px] md:text-xs">
        {doneCount} of {steps.length} done. All optional.
      </p>
      <div className="bg-line mt-2 h-1 overflow-hidden rounded-xs">
        <div
          className="bg-fg h-full transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-2 pb-2">
        {/* Finished steps leave the list; the count above keeps the tally. */}
        {steps
          .filter((s) => !s.done)
          .map((s) => {
            const isOpen = expanded === s.key && !s.done;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  disabled={s.done}
                  onClick={() => setOpenKey(isOpen ? '' : s.key)}
                  className="border-line flex min-h-12 w-full items-center gap-3 border-b text-left disabled:cursor-default md:min-h-10"
                >
                  <span
                    className={cn(
                      'grid size-[22px] shrink-0 place-items-center rounded-[3px] border-2 md:size-5',
                      s.done ? 'bg-fg text-bg border-fg' : 'border-line-strong',
                    )}
                  >
                    {s.done && <Check className="size-3.5 md:size-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-[15px] md:text-sm',
                      s.done ? 'text-muted line-through decoration-1' : 'font-medium',
                    )}
                  >
                    {s.title}
                  </span>
                  {!s.done && (
                    <ChevronRight
                      className={cn('text-muted size-4 transition-transform', isOpen && 'rotate-90')}
                    />
                  )}
                </button>
                {isOpen && (
                  <div className="anim-rise border-line space-y-3 border-b pt-2 pb-3 pl-[2.1rem] md:pl-8">
                    <p className="text-muted text-[13px] md:text-xs">{s.hint}</p>
                    {s.body}
                  </div>
                )}
              </li>
            );
          })}
      </ol>
    </section>
  );
}
