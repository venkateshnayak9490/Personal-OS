import { formatDistanceToNowStrict } from 'date-fns';
import { NotebookPen, Pin, PinOff, Plus, Search, Trash } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { BlockHeader, Button, EmptyState, Input, Loading, Select } from '@/components/ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { nodePath } from '@/app/nav';
import { db } from '@/core/db';
import { useNotes, useProjects } from '@/core/hooks';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { createNote, deleteNote, noteTitle, saveNoteBody, updateNote } from '@/core/repos/notes';
import { restoreFromTrash } from '@/core/repos/trash';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

const RichEditor = lazy(() => import('@/features/pages/PageEditor').then((m) => ({ default: m.RichEditor })));

export const notePath = (id: string) => `/notes/${id}`;

/** A list of notes and the open one, side by side. */
export function NotesPage() {
  const { noteId } = useParams();
  const notes = useNotes();
  const t = useNodeTree();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const projects = useProjects();
  // Each section's own page ("Write anything…") is a note too: listed here, written on the section.
  const pages = useLiveQuery(
    async () => (await db.pages.toArray()).filter((p) => !p.deletedAt && p.text.trim()),
    [],
  );

  if (!notes || !t) return <Loading />;
  const open = noteId ? notes.find((n) => n.id === noteId) : undefined;
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? notes.filter((n) => n.title.toLowerCase().includes(needle) || n.text.toLowerCase().includes(needle))
    : notes;

  const create = () =>
    void attempt(async () => {
      const n = await createNote();
      navigate(notePath(n.id));
    });

  return (
    <>
      <PageHeader
        title="Notes"
        icon={NotebookPen}
        subtitle="Ordinary notes. Everything here is searchable with Ctrl+K."
        actions={
          <Button variant="primary" size="sm" onClick={create}>
            <Plus className="size-4" /> New note
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside aria-label="All notes" className="min-w-0">
          <div className="relative mb-3">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Filter notes"
              placeholder="Filter"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {shown.length === 0 ? (
            // With no notes at all, the one empty state is on the right (with its action); here only search misses.
            notes.length > 0 && <p className="text-meta text-muted py-4">No match.</p>
          ) : (
            <ul className="divide-line border-line-strong divide-y border-t">
              {shown.map((n) => {
                const project = n.projectId ? projects?.find((p) => p.id === n.projectId) : undefined;
                const node = n.nodeId ? t.byId.get(n.nodeId) : undefined;
                // The line under the title: the text's first line, or its second when the title came from it.
                const lines = n.text
                  .trim()
                  .split('\n')
                  .filter((l) => l.trim());
                const preview = (n.title ? lines[0] : lines[1])?.slice(0, 80);
                return (
                  <li key={n.id}>
                    <Link
                      to={notePath(n.id)}
                      aria-current={n.id === noteId ? 'page' : undefined}
                      className={cn(
                        'hover:bg-surface-2/60 block px-2 py-2',
                        n.id === noteId && 'bg-surface-2 shadow-[inset_2px_0_0_var(--fg)]',
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {n.pinned && <Pin aria-label="Pinned" className="text-muted size-3 shrink-0" />}
                        <span className="truncate">{noteTitle(n)}</span>
                      </span>
                      {preview && <span className="text-meta text-fg-2 block truncate">{preview}</span>}
                      <span className="text-meta text-muted flex min-w-0 items-center gap-1.5">
                        {(project || node) && (
                          <>
                            {node && (
                              <span
                                aria-hidden
                                className={cn('size-2 shrink-0 rounded-xs', colorFor(t.colorOf(node.id)).dot)}
                              />
                            )}
                            <span className="truncate">{project ? project.title : node!.title}</span>
                            <span aria-hidden>·</span>
                          </>
                        )}
                        <span className="shrink-0">
                          {formatDistanceToNowStrict(n.updatedAt, { addSuffix: true })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {pages && pages.some((p) => t.byId.has(p.nodeId)) && (
            <div className="mt-8">
              <BlockHeader title="Section pages" />
              <ul aria-label="Section pages" className="divide-line divide-y">
                {pages
                  .filter((p) => t.byId.has(p.nodeId))
                  .map((p) => (
                    <li key={p.id}>
                      <Link to={nodePath(p.nodeId)} className="hover:bg-surface-2/60 block px-2 py-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span
                            aria-hidden
                            className={cn('size-2 shrink-0 rounded-xs', colorFor(t.colorOf(p.nodeId)).dot)}
                          />
                          <span className="truncate">{t.byId.get(p.nodeId)!.title}</span>
                        </span>
                        <span className="text-meta text-muted block truncate">{p.text.slice(0, 80)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {open ? (
            <NoteView key={open.id} note={open} />
          ) : (
            <EmptyState
              compact
              icon={NotebookPen}
              title={noteId ? 'This note doesn’t exist' : notes.length ? 'Pick a note' : 'No notes yet'}
              action={
                !noteId && !notes.length ? (
                  <Button onClick={create}>
                    <Plus className="size-4" /> Write your first note
                  </Button>
                ) : undefined
              }
            >
              {noteId
                ? 'It may have been deleted. Check the Trash.'
                : notes.length
                  ? 'Or start a new one.'
                  : 'Notes you write here, and notes from your sections and projects, are listed on the left.'}
            </EmptyState>
          )}
        </div>
      </div>
    </>
  );
}

function NoteView({ note: n }: { note: NonNullable<ReturnType<typeof useNotes>>[number] }) {
  const navigate = useNavigate();
  const projects = useProjects();
  const remove = () =>
    void attempt(async () => {
      const b = await deleteNote(n.id);
      if (b) toast(`Moved “${noteTitle(n)}” to Trash`, () => restoreFromTrash(b));
      navigate('/notes', { replace: true });
    });
  return (
    <article className="max-w-[75ch]">
      <div className="border-line-strong focus-within:border-focus mb-3 flex items-center gap-1 border-b pb-1.5">
        <input
          aria-label="Note title"
          placeholder="Untitled"
          key={n.title}
          defaultValue={n.title}
          autoFocus={!n.title && !n.text}
          onBlur={(e) =>
            e.target.value.trim() !== n.title &&
            void attempt(() => updateNote(n.id, { title: e.target.value }))
          }
          className="title-page placeholder:text-muted min-h-11 min-w-0 flex-1 bg-transparent outline-none md:min-h-10"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={n.pinned ? 'Unpin note' : 'Pin note'}
          onClick={() => void attempt(() => updateNote(n.id, { pinned: !n.pinned }))}
        >
          {n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={remove}>
          <Trash className="size-4" />
        </Button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <SectionSelect
          value={n.nodeId}
          onChange={(nodeId) => void attempt(() => updateNote(n.id, { nodeId }))}
          className="w-auto max-w-56"
          aria-label="Note section"
        />
        <Select
          aria-label="Note project"
          value={n.projectId ?? ''}
          onChange={(e) => {
            const p = projects?.find((x) => x.id === e.target.value);
            // A project's note sits in the project's section too.
            void attempt(() =>
              updateNote(n.id, { projectId: p?.id, ...(p?.nodeId && { nodeId: p.nodeId }) }),
            );
          }}
          className="w-auto max-w-56"
        >
          <option value="">No project</option>
          {(projects ?? [])
            .filter((p) => !p.deletedAt && (p.status === 'active' || p.id === n.projectId))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </Select>
      </div>
      <Suspense fallback={<div className="min-h-10" />}>
        <RichEditor
          label="Note"
          initial={n.doc}
          placeholder="Write anything. Type “/” for headings, lists and checklists."
          onSave={(doc, text) => saveNoteBody(n.id, doc, text)}
        />
      </Suspense>
    </article>
  );
}
