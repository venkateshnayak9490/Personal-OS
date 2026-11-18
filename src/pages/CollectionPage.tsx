import { format } from 'date-fns';
import { Columns3, Download, Ellipsis, Plus, Settings2, Table2, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { Menu } from '@/components/Menu';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState, Input, Loading } from '@/components/ui';
import { useCollections, useRecords } from '@/core/hooks';
import { download } from '@/core/backup';
import { expenseSummary, gradeSummary } from '@/core/domain/collections';
import { fetchPaper, parsePaperId, toBibTeX } from '@/core/domain/papers';
import type { CollectionRecord } from '@/core/domain/types';
import { createRecord, deleteCollection, updateCollection } from '@/core/repos/collections';
import { restoreFromTrash } from '@/core/repos/trash';
import { ListSettings } from '@/features/collections/ListSettings';
import { RecordSheet } from '@/features/collections/RecordSheet';
import { BoardView, TableView } from '@/features/collections/views';
import { useNodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';

export const NOUN: Record<string, string> = {
  occasions: 'occasion',
  papers: 'paper',
  deadlines: 'deadline',
  experiments: 'experiment',
  datasets: 'resource',
  ideas: 'idea',
  movies: 'title',
  places: 'place',
  trips: 'trip',
  dates: 'idea',
  expenses: 'expense',
  shopping: 'item',
  learning: 'resource',
  course: 'assessment',
  people: 'person',
};
export const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

/**
 * A list's page. `id` overrides the URL (the People page shows its fixed list).
 * `embedded`: shown inside a section page (no breadcrumb, a section-sized heading).
 */
export function CollectionPage({ id, embedded }: { id?: string; embedded?: boolean } = {}) {
  const params_ = useParams();
  const collectionId = id ?? params_.collectionId ?? '';
  const lists = useCollections();
  const records = useRecords(collectionId);
  const t = useNodeTree();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
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

  // Papers: a pasted DOI or arXiv ID/link is looked up and filled in.
  const paperId = c.templateKey === 'papers' ? parsePaperId(title) : null;
  const add = () =>
    void attempt(async () => {
      if (!paperId) {
        await createRecord(c.id, { title });
        setTitle('');
        return;
      }
      setBusy(true);
      try {
        const p = await fetchPaper(paperId);
        if (records.some((r) => r.custom.link === p.link)) {
          toast(`“${p.title}” is already in ${c.name}`);
        } else {
          const { title: t, ...custom } = p;
          await createRecord(c.id, { title: t, custom });
          toast(`Imported “${t}”`);
        }
        setTitle('');
      } finally {
        setBusy(false);
      }
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
      {section && !embedded && (
        <nav aria-label="Breadcrumb" className="text-muted mb-3 text-[13px] md:text-xs">
          <Link to={nodePath(section.id)} className="hover:text-fg">
            {section.title}
          </Link>
        </nav>
      )}
      <header className={cn('flex items-start gap-3', embedded ? 'mb-3 items-center' : 'mb-6')}>
        {embedded ? (
          <h2 className="min-w-0 flex-1 text-[15px] font-semibold md:text-sm">{c.name}</h2>
        ) : (
          <>
            <NodeIcon name={c.icon} className="text-muted mt-1.5 size-7 shrink-0" />
            <h1 className="min-w-0 flex-1 text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] md:text-4xl">
              {c.name}
            </h1>
          </>
        )}
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
            c.templateKey === 'papers'
              ? {
                  label: 'Export BibTeX',
                  icon: Download,
                  disabled: !records.length,
                  onSelect: () => download(toBibTeX(records), `${c.name}.bib`, 'application/x-bibtex'),
                }
              : null,
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
            placeholder={
              c.templateKey === 'papers'
                ? 'Add a paper, or paste a DOI or arXiv link'
                : `Add ${withArticle(noun)}`
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!title.trim() || busy}>
            {paperId ? (
              <>
                <Download className="size-4" /> {busy ? 'Importing…' : 'Import'}
              </>
            ) : (
              <>
                <Plus className="size-4" /> Add
              </>
            )}
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

      {c.templateKey === 'course' && <Grade records={records} />}
      {c.templateKey === 'expenses' && <Spent records={records} />}

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

/** "Graded so far" for a course's assessments. */
function Grade({ records }: { records: CollectionRecord[] }) {
  const g = gradeSummary(records);
  if (!g.total) return null;
  const n = (x: number) => (Math.round(x * 10) / 10).toString();
  return (
    <p className="text-muted mb-4 text-sm">
      {g.graded
        ? `So far: ${n(g.earned)} of ${n(g.graded)} marks graded (${Math.round((g.earned / g.graded) * 100)}%).`
        : 'Nothing graded yet.'}{' '}
      {Math.round(g.total) !== 100 && `Weights add up to ${n(g.total)}%, not 100%.`}
    </p>
  );
}

/** This month's spending, by category. */
function Spent({ records }: { records: CollectionRecord[] }) {
  const month = format(new Date(), 'yyyy-MM'); // local month, not UTC
  const s = expenseSummary(records, month);
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <p className="text-muted mb-4 text-sm">
      {s.total ? (
        <>
          This month: <b className="text-fg tabular-nums">{fmt(s.total)}</b>
          {' · '}
          {s.byCategory.map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}
        </>
      ) : (
        'Nothing spent this month yet. Give each expense an amount and a date.'
      )}
    </p>
  );
}
