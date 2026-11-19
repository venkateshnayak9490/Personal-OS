import { formatDistanceToNowStrict } from 'date-fns';
import { NotebookPen, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { Button } from '@/components/ui';
import { useNotes } from '@/core/hooks';
import { createNote, noteTitle } from '@/core/repos/notes';
import { notePath } from '@/pages/NotesPage';

/** Notes that belong to a section or a project, listed where the work is, with "New note" here. */
export function LinkedNotes({ nodeId, projectId }: { nodeId?: string; projectId?: string }) {
  const notes = useNotes();
  const navigate = useNavigate();
  if (!notes) return null;
  const mine = notes.filter((n) =>
    projectId ? n.projectId === projectId : n.nodeId === nodeId && !n.projectId,
  );
  const create = () =>
    void attempt(async () => {
      const n = await createNote({ nodeId, projectId });
      navigate(notePath(n.id));
    });
  return (
    <section aria-labelledby="linked-notes" className="mb-8">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="linked-notes" className="title-block flex flex-1 items-center gap-2">
          <NotebookPen className="text-muted size-4" /> Notes
        </h2>
        <Button size="sm" variant="ghost" onClick={create}>
          <Plus className="size-4" /> New note
        </Button>
      </div>
      {mine.length > 0 && (
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {mine.map((n) => (
            <li key={n.id}>
              <Link
                to={notePath(n.id)}
                className="hover:bg-surface-2/60 flex items-baseline gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{noteTitle(n)}</span>
                <span className="text-muted shrink-0 text-xs">
                  {formatDistanceToNowStrict(n.updatedAt, { addSuffix: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
