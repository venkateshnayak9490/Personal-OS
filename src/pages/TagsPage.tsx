import { Hash, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { PageHeader } from '@/components/PageHeader';
import { Button, EmptyState, Input, Select } from '@/components/ui';
import { useAllTasks, useTags } from '@/core/hooks';
import type { Tag } from '@/core/domain/types';
import { createTag, deleteTag, updateTag } from '@/core/repos/tags';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';
import { COLOR_NAMES, colorFor } from '@/lib/palette';

function TagRow({ tag, uses }: { tag: Tag; uses: number }) {
  const [name, setName] = useState(tag.name);
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span aria-hidden className={cn('size-3 shrink-0 rounded-full', colorFor(tag.color).dot)} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() =>
          name !== tag.name &&
          void attempt(() => updateTag(tag.id, { name })).then((r) => r === undefined && setName(tag.name))
        }
        aria-label={`Rename tag ${tag.name}`}
        className="hover:border-line-strong focus:border-focus focus:ring-focus h-11 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-base focus:ring-1 focus:outline-none md:h-8 md:text-sm"
      />
      <span className="text-meta text-muted shrink-0 tabular-nums">{uses} tasks</span>
      <Select
        aria-label={`Color for ${tag.name}`}
        value={tag.color ?? 'slate'}
        onChange={(e) => void attempt(() => updateTag(tag.id, { color: e.target.value }))}
        className="w-24 md:h-8 md:w-28 md:text-xs"
      >
        {COLOR_NAMES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Delete tag ${tag.name}`}
        className="hover:text-danger"
        onClick={() =>
          void attempt(async () => {
            const b = await deleteTag(tag.id);
            if (b) toast(`Deleted #${tag.name}`, () => restoreFromTrash(b));
          })
        }
      >
        <Trash className="size-4" />
      </Button>
    </li>
  );
}

export function TagsPage() {
  const tags = useTags();
  const tasks = useAllTasks();
  const [name, setName] = useState('');
  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks ?? []) for (const id of t.tags) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [tasks]);

  return (
    <>
      <PageHeader title="Tags" icon={Hash} subtitle="Tags work across every section." />
      <form
        className="mb-6 flex gap-2"

        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void attempt(() => createTag(name, COLOR_NAMES[(tags?.length ?? 0) % COLOR_NAMES.length])).then(
            () => setName(''),
          );
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag, e.g. urgent-review"
          aria-label="New tag name"
        />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Add
        </Button>
      </form>
      {tags && tags.length === 0 && (
        <EmptyState icon={Hash} title="No tags yet">
          Create one above or from any task.
        </EmptyState>
      )}
      {tags && tags.length > 0 && (
        <ul className="divide-line border-line-strong divide-y border-t" aria-label="Tags">
          {tags.map((t) => (
            <TagRow key={t.id} tag={t} uses={uses.get(t.id) ?? 0} />
          ))}
        </ul>
      )}
    </>
  );
}
