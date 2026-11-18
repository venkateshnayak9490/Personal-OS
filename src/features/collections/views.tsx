import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { display, isDone, sortRecords } from '@/core/domain/collections';
import type { Collection, CollectionRecord, FieldDef } from '@/core/domain/types';
import { updateRecord } from '@/core/repos/collections';
import { cn } from '@/lib/cn';

interface ViewProps {
  collection: Collection;
  records: CollectionRecord[];
  onOpen: (id: string) => void;
}

/** Long text is for the item panel; everything else gets a column. */
const columns = (c: Collection): FieldDef[] => c.fields.filter((f) => f.type !== 'longtext');

export function TableView({ collection: c, records, onOpen }: ViewProps) {
  const [sort, setSort] = useState<{ by: string; dir: 'asc' | 'desc' } | null>(null);
  const rows = sort ? sortRecords(records, c, sort.by, sort.dir) : records;
  const header = (by: string, label: string) => {
    const active = sort?.by === by;
    return (
      <th
        key={by}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="px-3 py-2 text-left font-medium whitespace-nowrap"
      >
        <button
          type="button"
          onClick={() =>
            setSort(active ? (sort.dir === 'asc' ? { by, dir: 'desc' } : null) : { by, dir: 'asc' })
          }
          className="hover:text-fg inline-flex items-center gap-1"
        >
          {label}
          {active && (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      </th>
    );
  };

  return (
    <div className="border-line overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="text-muted border-line border-b text-xs">
          <tr>
            {header('title', 'Title')}
            {header('status', c.statusName ?? 'Status')}
            {columns(c).map((f) => header(f.key, f.name))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.id} className={cn('hover:bg-surface-2/50', isDone(c, r) && 'opacity-60')}>
              <td className="max-w-80 px-3 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="block w-full truncate text-left font-medium hover:underline"
                >
                  {r.title}
                </button>
              </td>
              <td className="px-3 py-1.5">
                <select
                  aria-label={`${c.statusName ?? 'Status'} of ${r.title}`}
                  value={r.status}
                  onChange={(e) => void attempt(() => updateRecord(r.id, { status: e.target.value }))}
                  className="bg-surface-2 hover:bg-line/60 h-7 rounded-md px-2 text-xs"
                >
                  {c.statusOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
              {columns(c).map((f) => (
                <td key={f.key} className="text-muted max-w-60 truncate px-3 py-2 whitespace-nowrap">
                  {f.type === 'url' && typeof r.custom[f.key] === 'string' ? (
                    <a
                      href={r.custom[f.key] as string}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-fg underline-offset-2 hover:underline"
                    >
                      {display(f, r.custom[f.key])}
                    </a>
                  ) : (
                    display(f, r.custom[f.key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Columns per status; drag a card to another column to change its status. */
export function BoardView({ collection: c, records, onOpen }: ViewProps) {
  const [over, setOver] = useState<string | null>(null);
  const preview = (r: CollectionRecord) =>
    columns(c)
      .map((f) => display(f, r.custom[f.key]))
      .filter(Boolean)
      .slice(0, 2);

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {c.statusOptions.map((s) => {
        const items = records.filter((r) => r.status === s);
        return (
          <section
            key={s}
            aria-label={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s);
            }}
            onDragLeave={() => setOver((o) => (o === s ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              const r = records.find((x) => x.id === id);
              if (r && r.status !== s) void attempt(() => updateRecord(id, { status: s }));
            }}
            className={cn(
              'bg-surface-2/40 flex w-64 shrink-0 flex-col rounded-2xl p-2 transition-colors',
              over === s && 'bg-surface-2',
            )}
          >
            <h3 className="text-muted flex items-center justify-between px-1.5 pt-1 pb-2 text-xs font-medium">
              {s}
              <span className="tabular-nums">{items.length || ''}</span>
            </h3>
            <ul className="flex min-h-16 flex-col gap-2">
              {items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', r.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => onOpen(r.id)}
                    className="border-line bg-surface hover:border-fg/25 w-full cursor-grab rounded-xl border px-3 py-2.5 text-left active:cursor-grabbing"
                  >
                    <div className="text-sm font-medium">{r.title}</div>
                    {preview(r).map((p, i) => (
                      <div key={i} className="text-muted truncate text-xs">
                        {p}
                      </div>
                    ))}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
