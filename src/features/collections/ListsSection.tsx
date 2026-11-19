import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { COLLECTION_TEMPLATES } from '@/content/collection-templates';
import { Sheet } from '@/components/Sheet';
import { useCollections, useRecords } from '@/core/hooks';
import { isDone } from '@/core/domain/collections';
import { createCollection } from '@/core/repos/collections';
import { NodeIcon } from '@/lib/NodeIcon';

export const listPath = (id: string) => `/lists/${id}`;

/** The lists (Papers, Deadlines…) that belong to a section, shown on its page. */
export function ListsSection({ nodeId, ownTemplate }: { nodeId: string; ownTemplate?: string }) {
  const lists = useCollections();
  const records = useRecords();
  if (!lists || !records) return null;
  // The section's own list is shown on its own; this block is for any others you added.
  const own = lists.find((c) => c.nodeId === nodeId && c.templateKey === ownTemplate);
  const mine = lists.filter((c) => c.nodeId === nodeId && c !== own);
  if (!mine.length) return null;

  return (
    <section aria-labelledby="lists-heading" className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="lists-heading" className="title-block flex-1">
          {own ? 'More lists' : 'Lists'}
        </h2>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((c) => {
          const items = records.filter((r) => r.collectionId === c.id);
          const open = items.filter((r) => !isDone(c, r)).length;
          return (
            <li key={c.id}>
              <Link
                to={listPath(c.id)}
                className="border-line hover:bg-surface-2/60 flex items-center gap-3 rounded-2xl border px-4 py-3"
              >
                <NodeIcon name={c.icon} className="text-muted size-5 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-muted text-xs">
                    {items.length === 0
                      ? 'Empty'
                      : c.doneStatuses.length
                        ? `${open} open of ${items.length}`
                        : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Add a list here": pick a starting template (ones that suit the section first). */
export function TemplatePicker({
  open,
  onClose,
  nodeId,
  suggested,
}: {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  suggested: string[];
}) {
  const navigate = useNavigate();
  // Templates that suit this section first; "Blank" stays last.
  const rank = (suits: string[]) => (suits.some((s) => suggested.includes(s)) ? 0 : suits.length ? 1 : 2);
  // People has its own page (/people); it isn't a per-section list.
  const templates = COLLECTION_TEMPLATES.filter((t) => t.key !== 'people').sort(
    (a, b) => rank(a.suits) - rank(b.suits),
  );
  const create = (templateKey: string) =>
    void attempt(async () => {
      const c = await createCollection({ templateKey, nodeId });
      onClose();
      navigate(listPath(c.id));
    });
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New list"
      description="Pick a starting point. You can rename it and change its fields afterwards."
    >
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => create(t.key)}
              className="border-line hover:bg-surface-2/60 flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left"
            >
              <NodeIcon name={t.icon} className="text-muted mt-0.5 size-5 shrink-0" />
              <span>
                <span className="block text-sm font-medium">{t.key === 'blank' ? 'Blank list' : t.name}</span>
                <span className="text-muted block text-xs">{t.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
