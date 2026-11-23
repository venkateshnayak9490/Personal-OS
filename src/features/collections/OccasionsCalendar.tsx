import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Bell, ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { templateFor } from '@/content/collection-templates';
import { Confirm, Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select, Textarea, SaveHint } from '@/components/ui';
import { useCollections, useProfile, useRecords } from '@/core/hooks';
import { datedItems, type DatedItem } from '@/core/domain/collections';
import { toLocalDate } from '@/core/domain/tasks';
import type { Collection, CollectionRecord } from '@/core/domain/types';
import {
  createCollection,
  createRecord,
  deleteRecord,
  setRecordValue,
  setStatuses,
  updateRecord,
} from '@/core/repos/collections';
import { restoreFromTrash } from '@/core/repos/trash';
import { listPath } from './ListsSection';
import { cn } from '@/lib/cn';

const ymd = (d: Date | number) => format(d, 'yyyy-MM-dd');
const KINDS = templateFor('occasions')?.statusOptions ?? ['Birthday', 'Anniversary', 'Custom'];
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2026, i, 1), 'MMM'));
const REMIND = [
  { value: 0, label: 'On the day only' },
  { value: 1, label: '1 day before, and on the day' },
  { value: 3, label: '3 days before, and on the day' },
  { value: 7, label: '7 days before, and on the day' },
];
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/**
 * Dates & Occasions as a month calendar: dates with occasions are marked, today is outlined, and
 * picking a date lists its occasions (add, edit, delete). Birthdays and anniversaries come round
 * every year; others can be once. Below, what's coming up next.
 */
export function OccasionsCalendar({ nodeId }: { nodeId: string }) {
  const lists = useCollections();
  const records = useRecords();
  const profile = useProfile();
  const now = useNow();
  const today = toLocalDate(now, profile?.timezone);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)));
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CollectionRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CollectionRecord | null>(null);
  if (!lists || !records) return null;
  const list = lists.find((c) => c.nodeId === nodeId && c.templateKey === 'occasions');
  // Birthdays and anniversaries saved in People show here too, without entering them twice.
  const people = lists.filter((c) => c.templateKey === 'people' && !c.deletedAt);
  const names = records
    .filter((r) => !r.deletedAt && people.some((c) => c.id === r.collectionId))
    .map((r) => r.title);
  const weekStartsOn = profile?.weekStartsOn ?? 1;
  const gridStart = startOfWeek(month, { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn });
  const days = Array.from({ length: differenceInCalendarDays(gridEnd, gridStart) + 1 }, (_, i) =>
    addDays(gridStart, i),
  );
  const items = (from: Date, to: Date) =>
    datedItems(list ? [list, ...people] : people, records, from.getTime(), to.getTime(), profile?.timezone);
  const byDay = new Map<string, DatedItem[]>();
  for (const d of items(gridStart, addDays(gridEnd, 1)))
    byDay.set(ymd(d.at), [...(byDay.get(ymd(d.at)) ?? []), d]);
  const onSelected = byDay.get(selected) ?? items(parseISO(selected), addDays(parseISO(selected), 1));
  // A yearly date can fall twice in the 366-day window (today and in 365 days): keep the next one.
  const seen = new Set<string>();
  const upcoming = items(parseISO(today), addDays(parseISO(today), 366))
    .sort((a, b) => a.at - b.at)
    .filter((d) => !seen.has(`${d.record.id}:${d.field.key}`) && !!seen.add(`${d.record.id}:${d.field.key}`))
    .slice(0, 6);
  const go = (d: Date) => setMonth(startOfMonth(d));
  const pick = (d: string) => {
    setSelected(d);
    if (!isSameMonth(parseISO(d), month)) go(parseISO(d));
  };

  return (
    <section aria-label="Occasions calendar" className="mb-10 space-y-6">
      <div className="border-line rounded-2xl border p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => go(addMonths(month, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Select
            aria-label="Month"
            value={month.getMonth()}
            onChange={(e) => go(new Date(month.getFullYear(), Number(e.target.value), 1))}
            className="w-auto min-w-0 flex-1 md:flex-none"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Year"
            type="number"
            min={1900}
            max={2200}
            value={month.getFullYear()}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (y >= 1900 && y <= 2200) go(new Date(y, month.getMonth(), 1));
            }}
            className="w-20 shrink-0"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => go(addMonths(month, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto shrink-0 px-2" onClick={() => pick(today)}>
            Today
          </Button>
        </div>
        <div
          role="grid"
          aria-label={format(month, 'MMMM yyyy')}
          className="grid grid-cols-7 gap-1 text-center"
        >
          {days.slice(0, 7).map((d) => (
            <div key={`h${ymd(d)}`} role="columnheader" className="text-muted pb-1 text-xs font-medium">
              {format(d, 'EEEEE')}
            </div>
          ))}
          {days.map((d) => {
            const key = ymd(d);
            const n = byDay.get(key)?.length ?? 0;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={key === selected}
                aria-current={key === today ? 'date' : undefined}
                aria-label={`${format(d, 'EEEE d MMMM yyyy')}${n ? `, ${n} occasion${n > 1 ? 's' : ''}` : ''}`}
                onClick={() => pick(key)}
                className={cn(
                  // Capped height so the month leaves room for the day's list and "Add occasion".
                  'hover:bg-surface-2 relative grid h-11 place-items-center rounded-xl text-sm tabular-nums md:h-14',
                  !isSameMonth(d, month) && 'text-muted font-normal',
                  n > 0 && 'bg-sec-personal/15 font-semibold',
                  key === today && 'ring-line-strong font-bold ring-1 ring-inset',
                  key === selected && 'ring-fg ring-2 ring-inset',
                )}
              >
                {format(d, 'd')}
                {n > 0 && (
                  <span aria-hidden className="bg-sec-personal absolute bottom-1.5 size-1.5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="title-block flex-1">{format(parseISO(selected), 'EEEE d MMMM yyyy')}</h2>
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add occasion
          </Button>
        </div>
        {onSelected.length === 0 ? (
          <p className="text-muted text-sm">Nothing on this date.</p>
        ) : (
          <ul
            aria-label="Occasions on this date"
            className="border-line divide-line divide-y rounded-2xl border"
          >
            {onSelected.map((d) =>
              fromPeople(d) ? (
                <PersonRow key={`${d.record.id}:${d.field.key}`} item={d} />
              ) : (
                <OccasionRow
                  key={d.record.id}
                  item={d}
                  onEdit={() => setEditing(d.record)}
                  onDelete={() => setDeleting(d.record)}
                />
              ),
            )}
          </ul>
        )}
      </div>

      <div>
        <h2 className="title-block mb-3">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted text-sm">No occasions yet. Pick a date above and add one.</p>
        ) : (
          <ul aria-label="Upcoming occasions" className="space-y-1.5 text-sm">
            {upcoming.map((d) => (
              <li key={`${d.record.id}:${d.field.key}:${d.at}`} className="flex items-baseline gap-3">
                <button
                  type="button"
                  className="text-muted w-24 shrink-0 text-left tabular-nums hover:underline"
                  onClick={() => pick(ymd(d.at))}
                >
                  {format(d.at, 'EEE d MMM')}
                </button>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{d.record.title}</span>
                  <span className="text-muted"> · {kindOf(d)}</span>
                </span>
                <span className="text-muted shrink-0 text-xs">
                  {inDays(differenceInCalendarDays(d.at, parseISO(today)))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <OccasionSheet
          nodeId={nodeId}
          list={list}
          record={editing === 'new' ? undefined : editing}
          date={selected}
          names={names}
          onClose={() => setEditing(null)}
          onSaved={(date) => pick(date)}
        />
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ''}”?`}
        description="It moves to Trash and stops reminding you. You can undo or restore it from Trash."
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => {
          const r = deleting!;
          setDeleting(null);
          void attempt(async () => {
            const b = await deleteRecord(r.id);
            if (b) toast(`Moved “${r.title}” to Trash`, () => restoreFromTrash(b));
          });
        }}
      />
    </section>
  );
}

const fromPeople = (d: DatedItem) => d.collection.templateKey === 'people';
const kindOf = (d: DatedItem) => (fromPeople(d) ? d.field.name : d.record.status);

/** A birthday or anniversary from People: edited there, so here it links to the person. */
function PersonRow({ item }: { item: DatedItem }) {
  const since = Number(String(item.record.custom[item.field.key] ?? '').slice(0, 4));
  const years = new Date(item.at).getFullYear() - since;
  return (
    <li aria-label={item.record.title} className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium md:text-sm">
          <span>{item.record.title}</span>
          <span className="bg-sec-personal/15 rounded-sm px-1.5 py-0.5 text-[11px] font-normal">
            {item.field.name}
          </span>
        </div>
        <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
          <span className="flex items-center gap-1">
            <Repeat className="size-3" />
            Every year{years > 0 ? ` (${years} years)` : ''}
          </span>
          <Link to={`${listPath(item.collection.id)}?item=${item.record.id}`} className="underline">
            From People
          </Link>
        </div>
      </div>
    </li>
  );
}

function OccasionRow({
  item,
  onEdit,
  onDelete,
}: {
  item: DatedItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const r = item.record;
  const once = r.custom.repeats === 'once';
  const before = Number(r.custom.remindDays) || 0;
  const since = typeof r.custom.date === 'string' ? Number(r.custom.date.slice(0, 4)) : NaN;
  const years = new Date(item.at).getFullYear() - since;
  return (
    <li aria-label={r.title} className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium md:text-sm">
          <span>{r.title}</span>
          <span className="bg-sec-personal/15 rounded-sm px-1.5 py-0.5 text-[11px] font-normal">
            {r.status}
          </span>
        </div>
        <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {typeof r.custom.who === 'string' && <span>For {r.custom.who}</span>}
          <span className="flex items-center gap-1">
            <Repeat className="size-3" />
            {once ? 'Once' : `Every year${years > 0 && !once ? ` (${years} years)` : ''}`}
          </span>
          <span className="flex items-center gap-1">
            <Bell className="size-3" />
            {before ? `${before} day${before > 1 ? 's' : ''} before` : 'On the day'}
          </span>
        </div>
        {typeof r.custom.comments === 'string' && (
          <p className="mt-1 text-sm whitespace-pre-line">{r.custom.comments}</p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.title}`} onClick={onDelete}>
        <Trash className="size-4" />
      </Button>
    </li>
  );
}

/** Add or edit an occasion: name, kind, date, every year or once, reminder, who, description. */
function OccasionSheet({
  nodeId,
  list,
  record,
  date,
  names,
  onClose,
  onSaved,
}: {
  nodeId: string;
  list?: Collection;
  /** People's names, offered for "For / with". */
  names: string[];
  record?: CollectionRecord;
  date: string;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const c = record?.custom ?? {};
  const [title, setTitle] = useState(record?.title ?? '');
  const [kind, setKind] = useState(record?.status ?? 'Birthday');
  const [when, setWhen] = useState(typeof c.date === 'string' ? c.date : date);
  const [yearly, setYearly] = useState(c.repeats !== 'once');
  const [remind, setRemind] = useState(Number(c.remindDays) || 0);
  const [who, setWho] = useState(typeof c.who === 'string' ? c.who : '');
  const [notes, setNotes] = useState(typeof c.comments === 'string' ? c.comments : '');
  const kinds = [...new Set([...KINDS, ...(list?.statusOptions ?? []), ...(record ? [record.status] : [])])];
  const ok = title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(when);

  const save = () =>
    void attempt(async () => {
      // The list is made with the first occasion; a kind it doesn't have yet is added to it.
      const l = list ?? (await createCollection({ templateKey: 'occasions', nodeId }));
      if (!l.statusOptions.includes(kind))
        await setStatuses(l.id, [...l.statusOptions.map((n) => ({ from: n, name: n })), { name: kind }]);
      const custom = {
        date: when,
        who: who.trim() || undefined,
        comments: notes.trim() || undefined,
        repeats: yearly ? undefined : 'once',
        remindDays: remind || undefined,
      };
      if (record) {
        await updateRecord(record.id, { title, status: kind });
        for (const [k, v] of Object.entries(custom)) await setRecordValue(record.id, k, v);
      } else
        await createRecord(l.id, {
          title,
          status: kind,
          custom: Object.fromEntries(Object.entries(custom).filter(([, v]) => v !== undefined)),
        });
      onSaved(when);
      onClose();
    });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={record ? 'Edit occasion' : 'New occasion'}
      footer={
        <>
          <SaveHint>{!title.trim() ? 'Give it a name' : !ok && 'Pick a date'}</SaveHint>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="oc-title">
          <Input
            id="oc-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Amma’s birthday"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind" htmlFor="oc-kind">
            <Select
              id="oc-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                if (!record) setYearly(['Birthday', 'Anniversary'].includes(e.target.value) || yearly);
              }}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="oc-date">
            <Input id="oc-date" type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={yearly}
            onChange={(e) => setYearly(e.target.checked)}
            className="accent-[var(--fg)]"
          />
          Every year on this date
        </label>
        <Field label="Remind me" htmlFor="oc-remind">
          <Select id="oc-remind" value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
            {REMIND.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="For / with (optional)" htmlFor="oc-who">
          <Input id="oc-who" list="oc-people" value={who} onChange={(e) => setWho(e.target.value)} />
          <datalist id="oc-people">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label="Description (optional)" htmlFor="oc-notes">
          <Textarea
            id="oc-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gift ideas, plans, anything to remember"
          />
        </Field>
      </div>
    </Sheet>
  );
}
