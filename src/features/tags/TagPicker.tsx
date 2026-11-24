import { useMemo, useState } from 'react';
import { attempt } from '@/app/toast';
import { useTags } from '@/core/hooks';
import { createTag } from '@/core/repos/tags';
import { TagChip } from '@/features/tasks/TaskBits';

/** Pick existing tags or create a new one by typing and pressing Enter. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const tagList = useTags();
  const tags = useMemo(() => tagList ?? [], [tagList]);
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const query = q.trim().replace(/^#/, '').toLowerCase();
  const suggestions = tags
    .filter((t) => !value.includes(t.id) && (!query || t.name.toLowerCase().includes(query)))
    .slice(0, 8);
  const exact = tags.some((t) => t.name.toLowerCase() === query);

  const add = async () => {
    if (!query) return;
    const tag = await attempt(() => createTag(q));
    if (tag && !value.includes(tag.id)) onChange([...value, tag.id]);
    setQ('');
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const t = byId.get(id);
            return t ? (
              <TagChip key={id} tag={t} onRemove={() => onChange(value.filter((v) => v !== id))} />
            ) : null;
          })}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const hit = suggestions.find((s) => s.name.toLowerCase() === query);
            if (hit) {
              onChange([...value, hit.id]);
              setQ('');
            } else void add();
          }
        }}
        placeholder="Add a tag…"
        aria-label="Add a tag"
        className="border-line bg-surface placeholder:text-muted/70 focus:border-accent h-9 w-full rounded-lg border px-3 text-sm focus:outline-none"
      />
      {(suggestions.length > 0 || (query && !exact)) && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange([...value, t.id]);
                setQ('');
              }}
              className="border-line text-muted hover:border-accent hover:text-fg rounded-sm border px-1.5 py-0.5 text-xs"
            >
              #{t.name}
            </button>
          ))}
          {query && !exact && (
            <button
              type="button"
              onClick={() => void add()}
              className="border-accent text-accent rounded-sm border border-dashed px-1.5 py-0.5 text-xs"
            >
              + Create #{q.trim().replace(/^#/, '')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
