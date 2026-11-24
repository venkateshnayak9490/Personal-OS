import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { display, isDone, sortRecords } from '@/core/domain/collections';
import type { Collection, CollectionRecord, FieldDef } from '@/core/domain/types';
import { updateRecord } from '@/core/repos/collections';
import { Select, StatusMark } from '@/components/ui';
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
  const numeric = (key: string) => c.fields.some((f) => f.key === key && f.type === 'number');
  const header = (by: string, label: string) => {
    const active = sort?.by === by;
    return (
      <th
        key={by}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'px-3 py-2 font-semibold whitespace-nowrap',
          by === 'title' && 'bg-surface sticky left-0 z-[1]',
          numeric(by) ? 'text-right' : 'text-left',
        )}
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

  // A table is one bordered object: head row over a 2px ink rule, hairlines between rows; on phones it
  // scrolls sideways inside its card with the title column sticky.
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
      <table className="w-full text-[15px] md:text-sm">
        <thead className="text-meta text-muted border-fg border-b-2">
          <tr>
            {header('title', 'Title')}
            {header('status', c.statusName ?? 'Status')}
            {columns(c).map((f) => header(f.key, f.name))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="group hover:bg-surface-2">
              <td className="bg-surface group-hover:bg-surface-2 sticky left-0 z-[1] max-w-48 px-3 py-2 md:max-w-80">
                <span className="flex items-center gap-2">
                  {/* Done is an ink tick (and a muted title), never a colour fill. */}
                  {isDone(c, r) && <StatusMark mark="done" className="shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className={cn(
                      'block min-w-0 flex-1 truncate text-left font-medium hover:underline',
                      isDone(c, r) && 'text-muted',
                    )}
                  >
                    {r.title}
                  </button>
                </span>
              </td>
              <td className="px-3 py-1.5">
                <Select
                  aria-label={`${c.statusName ?? 'Status'} of ${r.title}`}
                  value={r.status}
                  onChange={(e) => void attempt(() => updateRecord(r.id, { status: e.target.value }))}
                  className="h-9 w-auto text-[13px] md:h-8 md:text-xs"
                >
                  {c.statusOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </td>
              {columns(c).map((f) => (
                <td
                  key={f.key}
                  className={cn(
                    'text-muted max-w-60 truncate px-3 py-2 whitespace-nowrap',
                    f.type === 'number' && 'text-right tabular-nums',
                  )}
                >
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
    // Whole columns snap into place; on phones a column is most of the screen wide.
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:scroll-px-0 md:px-0">
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
            className="flex w-[85vw] max-w-[17rem] min-w-[16.25rem] shrink-0 snap-start flex-col"
          >
            <h3 className="title-block border-line-strong mb-2 flex items-baseline justify-between border-b pb-1.5">
              {s}
              <span className="text-meta text-muted font-normal tabular-nums">{items.length || ''}</span>
            </h3>
            <ul
              className={cn(
                'flex min-h-16 flex-col gap-2 rounded-md transition-colors',
                over === s && 'bg-surface-2',
              )}
            >
              {items.map((r) => (
                <li key={r.id} className="relative">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', r.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => onOpen(r.id)}
                    className="border-line bg-surface hover:border-line-strong w-full cursor-grab rounded-md border px-3 py-2.5 text-left active:cursor-grabbing max-md:min-h-14 max-md:pr-24"
                  >
                    <div className="text-[15px] font-medium md:text-sm">{r.title}</div>
                    {preview(r).map((p, i) => (
                      <div key={i} className="text-meta text-muted truncate">
                        {p}
                      </div>
                    ))}
                  </button>
                  {/* Drag and drop needs a mouse; phones move a card with this small picker on the card. */}
                  <select
                    aria-label={`Move ${r.title} to`}
                    value=""
                    onChange={(e) =>
                      e.target.value && void attempt(() => updateRecord(r.id, { status: e.target.value }))
                    }
                    className="border-line-strong bg-surface text-muted absolute top-1.5 right-1.5 h-11 w-20 rounded-md border pr-6 pl-1.5 text-xs md:hidden"
                  >
                    <option value="">Move…</option>
                    {c.statusOptions
                      .filter((o) => o !== s)
                      .map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
