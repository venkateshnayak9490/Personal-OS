import { formatDistanceToNowStrict } from 'date-fns';
import { NotebookPen, Pin, PinOff, Plus, Search, Trash } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { Button, EmptyState, Input, Loading } from '@/components/ui';
import { useNotes } from '@/core/hooks';
import { createNote, deleteNote, noteTitle, saveNoteBody, updateNote } from '@/core/repos/notes';
import { restoreFromTrash } from '@/core/repos/trash';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';

const RichEditor = lazy(() => import('@/features/pages/PageEditor').then((m) => ({ default: m.RichEditor })));

export const notePath = (id: string) => `/notes/${id}`;

/** A list of notes and the open one, side by side. */
export function NotesPage() {
  const { noteId } = useParams();
  const notes = useNotes();
  const t = useNodeTree();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

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
          <div className="relative mb-2">
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
            <p className="text-muted px-1 py-4 text-sm">{notes.length ? 'No match.' : 'No notes yet.'}</p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((n) => (
                <li key={n.id}>
                  <Link
                    to={notePath(n.id)}
                    aria-current={n.id === noteId ? 'page' : undefined}
                    className={cn(
                      'hover:bg-surface-2/60 block rounded-lg px-3 py-2',
                      n.id === noteId && 'bg-surface-2',
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {n.pinned && <Pin className="text-muted size-3 shrink-0" />}
                      <span className="truncate">{noteTitle(n)}</span>
                    </div>
                    <div className="text-muted truncate text-xs">
                      {formatDistanceToNowStrict(n.updatedAt, { addSuffix: true })}
                      {n.nodeId && t.byId.get(n.nodeId) ? ` · ${t.byId.get(n.nodeId)!.title}` : ''}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="min-w-0">
          {open ? (
            <NoteView key={open.id} note={open} />
          ) : (
            <EmptyState compact icon={NotebookPen} title={noteId ? 'This note doesn’t exist' : 'Pick a note'}>
              {noteId ? 'It may have been deleted. Check the Trash.' : 'Or start a new one.'}
            </EmptyState>
          )}
        </div>
      </div>
    </>
  );
}

function NoteView({ note: n }: { note: NonNullable<ReturnType<typeof useNotes>>[number] }) {
  const navigate = useNavigate();
  const remove = () =>
    void attempt(async () => {
      const b = await deleteNote(n.id);
      if (b) toast(`Moved “${noteTitle(n)}” to Trash`, () => restoreFromTrash(b));
      navigate('/notes', { replace: true });
    });
  return (
    <article>
      <div className="mb-3 flex items-center gap-2">
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
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none md:text-3xl"
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
      <div className="mb-5 max-w-xs">
        <SectionSelect
          id="note-node"
          value={n.nodeId}
          noneLabel="No section"
          onChange={(nodeId) => void attempt(() => updateNote(n.id, { nodeId }))}
        />
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
