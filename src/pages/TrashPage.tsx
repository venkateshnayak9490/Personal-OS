import { noteTitle } from '@/core/repos/notes';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState } from '@/components/ui';
import { db } from '@/core/db';
import {
  deleteForever,
  emptyTrash,
  listTrash,
  restoreFromTrash,
  TRASH_RETENTION_DAYS,
  type TrashEntry,
} from '@/core/repos/trash';

const KIND: Record<string, string> = {
  nodes: 'Section',
  tasks: 'Task',
  tags: 'Tag',
  projects: 'Project',
  milestones: 'Milestone',
  goals: 'Goal',
  habits: 'Habit',
  events: 'Event',
  messages: 'Message',
  collections: 'List',
  records: 'List item',
  meetings: 'Meeting',
  attachments: 'File',
  focusSessions: 'Focus session',
  notes: 'Note',
  journalEntries: 'Journal entry',
  thesisChapters: 'Chapter',
  writingLogs: 'Writing log',
  workoutSessions: 'Workout',
  workoutSets: 'Set',
  vaultItems: 'Vault item',
};

function daysLeft(deletedAt: number): number {
  return Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - deletedAt) / 86_400_000));
}

export function TrashPage() {
  // Re-run whenever any trashable table changes.
  const entries = useLiveQuery(async () => {
    await Promise.all(
      [db.nodes, db.tasks, db.tags, db.pages, db.projects, db.milestones, db.goals, db.habits].map((t) =>
        t.count(),
      ),
    );
    return listTrash();
  }, []);
  const [confirm, setConfirm] = useState<TrashEntry | 'all' | null>(null);

  const label = (e: TrashEntry) =>
    // A journal entry is named by its day, never by its (possibly private) text.
    (e.tableName === 'journalEntries' ? `Journal, ${(e.root as { date?: string }).date}` : undefined) ??
    (e.tableName === 'vaultItems' ? 'Encrypted vault item' : undefined) ??
    (e.tableName === 'notes' ? noteTitle(e.root as unknown as { title: string; text: string }) : undefined) ??
    (e.root as { title?: string }).title ??
    (e.root as { name?: string }).name ??
    (e.root as { text?: string }).text ??
    '(untitled)';

  return (
    <>
      <PageHeader
        title="Trash"
        icon={Trash}
        subtitle={`Deleted items are kept for ${TRASH_RETENTION_DAYS} days, then removed for good.`}
        actions={
          entries && entries.length > 0 ? (
            <Button size="sm" className="text-danger hover:text-danger" onClick={() => setConfirm('all')}>
              Empty trash
            </Button>
          ) : undefined
        }
      />
      {entries && entries.length === 0 && <EmptyState icon={Trash} title="Trash is empty" />}
      {entries && entries.length > 0 && (
        <ul className="divide-line border-line-strong divide-y border-t" aria-label="Deleted items">
          {entries.map((e) => (
            <li key={e.batchId} className="flex items-center gap-2 py-2.5 md:gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium md:text-sm">{label(e)}</div>
                <div className="text-meta text-muted">
                  {KIND[e.tableName] ?? e.tableName}
                  {e.extra.nodes > 0 && ` · +${e.extra.nodes} subsection${e.extra.nodes > 1 ? 's' : ''}`}
                  {e.extra.tasks > 0 && ` · +${e.extra.tasks} task${e.extra.tasks > 1 ? 's' : ''}`}
                  {' · '}
                  {daysLeft(e.deletedAt)} days left
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  void attempt(async () => {
                    await restoreFromTrash(e.batchId);
                    toast(`Restored “${label(e)}”`);
                  })
                }
              >
                <RotateCcw className="size-4" /> Restore
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${label(e)} forever`}
                title="Delete forever"
                className="hover:text-danger"
                onClick={() => setConfirm(e)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Confirm
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'all' ? 'Empty the trash?' : `Delete “${confirm ? label(confirm) : ''}” forever?`}
        description="This can’t be undone. Activity history stays, so past statistics are not affected."
        confirmLabel="Delete forever"
        danger
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          await attempt(() =>
            c === 'all' ? emptyTrash() : c ? deleteForever(c.batchId) : Promise.resolve(),
          );
        }}
      />
    </>
  );
}
