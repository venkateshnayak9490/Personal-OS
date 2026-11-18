import { Columns3, Ellipsis, Plus, Settings2, Table2, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { Menu } from '@/components/Menu';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState, Input, Loading } from '@/components/ui';
import { useCollections, useRecords } from '@/core/hooks';
import { createRecord, deleteCollection, updateCollection } from '@/core/repos/collections';
import { restoreFromTrash } from '@/core/repos/trash';
import { ListSettings } from '@/features/collections/ListSettings';
import { RecordSheet } from '@/features/collections/RecordSheet';
import { BoardView, TableView } from '@/features/collections/views';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';

const NOUN: Record<string, string> = {
  papers: 'paper',
  deadlines: 'deadline',
  experiments: 'experiment',
  datasets: 'resource',
  ideas: 'idea',
};
const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

export function CollectionPage() {
  const { collectionId = '' } = useParams();
  const lists = useCollections();
  const records = useRecords(collectionId);
  const t = useNodeTree();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!lists || !records || !t) return <Loading />;
  const c = lists.find((x) => x.id === collectionId);
  if (!c)
    return (
      <EmptyState title="This list doesn’t exist">
        It may have been deleted.{' '}
        <Link to="/trash" className="font-medium hover:underline">
          Open Trash
        </Link>
      </EmptyState>
    );

  const noun = NOUN[c.templateKey ?? ''] ?? 'item';
  const section = c.nodeId ? t.byId.get(c.nodeId) : undefined;
  const openId = params.get('item');
  const open = openId ? records.find((r) => r.id === openId) : undefined;
  const openItem = (id: string | null) => setParams(id ? { item: id } : {}, { replace: !id });

  const add = () =>
    void attempt(async () => {
      await createRecord(c.id, { title });
      setTitle('');
    });
  const remove = async () => {
    const b = await attempt(() => deleteCollection(c.id));
    if (b) {
      toast(`Moved “${c.name}” to Trash`, () => restoreFromTrash(b));
      navigate(section ? nodePath(section.id) : '/', { replace: true });
    }
  };

  return (
    <>
      {section && (
        <nav aria-label="Breadcrumb" className="text-muted mb-3 text-[13px] md:text-xs">
          <Link to={nodePath(section.id)} className="hover:text-fg">
            {section.title}
          </Link>
        </nav>
      )}
      <header className="mb-6 flex items-start gap-3">
        <NodeIcon name={c.icon} className="text-muted mt-1.5 size-7 shrink-0" />
        <h1 className="min-w-0 flex-1 text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] md:text-4xl">
          {c.name}
        </h1>
        <Button variant="ghost" size="sm" onClick={() => setSettings(true)}>
          <Settings2 className="size-4" /> Fields & statuses
        </Button>
        <Menu
          trigger={
            <Button variant="ghost" size="icon" aria-label="List options">
              <Ellipsis className="size-5" />
            </Button>
          }
          items={[
            { label: 'Delete list…', icon: Trash, danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-60 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add();
          }}
        >
          <Input
            aria-label={`New ${noun}`}
            placeholder={`Add ${withArticle(noun)}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        <div
          role="tablist"
          aria-label="View"
          className="bg-surface-2/70 inline-grid grid-cols-2 gap-1 rounded-lg p-1"
        >
          {(
            [
              ['table', 'Table', Table2],
              ['board', 'Board', Columns3],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={c.defaultView === v}
              onClick={() => void attempt(() => updateCollection(c.id, { defaultView: v }))}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                c.defaultView === v ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState compact title="Nothing here yet">
          Add your first {noun} above. Open it to fill in the details.
        </EmptyState>
      ) : c.defaultView === 'board' ? (
        <BoardView collection={c} records={records} onOpen={openItem} />
      ) : (
        <TableView collection={c} records={records} onOpen={openItem} />
      )}

      {open && <RecordSheet collection={c} record={open} onClose={() => openItem(null)} />}
      {settings && <ListSettings collection={c} onClose={() => setSettings(false)} />}
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${c.name}”?`}
        description="It moves to Trash with all its items. You can restore it for 30 days."
        confirmLabel="Move to Trash"
        danger
        onConfirm={remove}
      />
    </>
  );
}
