import { formatDistanceToNowStrict } from 'date-fns';
import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { BlockHeader, Button } from '@/components/ui';
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
      <BlockHeader
        id="linked-notes"
        title="Notes"
        action={
          <Button size="sm" variant="ghost" className="-mr-2" onClick={create}>
            <Plus className="size-4" /> New note
          </Button>
        }
      />
      {mine.length > 0 && (
        <ul className="divide-line divide-y">
          {mine.map((n) => (
            <li key={n.id}>
              <Link to={notePath(n.id)} className="hover:bg-surface-2 flex items-baseline gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium md:text-sm">{noteTitle(n)}</span>
                <span className="text-meta text-muted shrink-0">
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
