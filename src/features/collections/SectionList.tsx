import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { templateFor } from '@/content/collection-templates';
import { Button, Input } from '@/components/ui';
import { useCollections } from '@/core/hooks';
import { fetchPaper, parsePaperId } from '@/core/domain/papers';
import { createCollection, createRecord } from '@/core/repos/collections';
import { CollectionPage, NOUN, withArticle } from '@/pages/CollectionPage';

/**
 * A section's own list (Papers on Research, Watchlist on Movies…) right on its page.
 * Until the first item is added there's no list yet, only its add box: nothing is created by looking.
 */
export function SectionList({ nodeId, templateKey }: { nodeId: string; templateKey: string }) {
  const lists = useCollections();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  if (!lists) return null;
  const list = lists.find((c) => c.nodeId === nodeId && c.templateKey === templateKey);
  if (list)
    return (
      <div className="mb-10">
        <CollectionPage id={list.id} embedded />
      </div>
    );

  const t = templateFor(templateKey);
  const paperId = templateKey === 'papers' ? parsePaperId(title) : null;
  const noun = NOUN[templateKey] ?? 'item';
  return (
    <section aria-label={t?.name ?? 'List'} className="mb-10">
      <h2 className="mb-1 text-[15px] font-semibold md:text-sm">{t?.name}</h2>
      <p className="text-muted mb-3 text-sm">{t?.hint}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void attempt(async () => {
            setBusy(true);
            try {
              // Look the paper up first, so a failed lookup doesn't leave an empty list behind.
              const p = paperId ? await fetchPaper(paperId) : null;
              const c = await createCollection({ templateKey, nodeId });
              if (p) {
                const { title: name, ...custom } = p;
                await createRecord(c.id, { title: name, custom });
              } else await createRecord(c.id, { title });
              setTitle('');
            } finally {
              setBusy(false);
            }
          });
        }}
      >
        <Input
          aria-label={`New ${noun}`}
          placeholder={
            templateKey === 'papers'
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
    </section>
  );
}
