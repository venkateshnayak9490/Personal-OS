import { format, getYear, parseISO, setYear } from 'date-fns';
import { AOE_TZ, dueInstant } from './tasks';
import type { Collection, CollectionRecord, DeadlineValue, FieldDef } from './types';

/** Lists and their items: value helpers shared by the table, board, calendar and Today. */

export const FIELD_TYPES: { value: FieldDef['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'Link' },
  { value: 'date', label: 'Date' },
  { value: 'deadline', label: 'Deadline (date, time, zone)' },
  { value: 'select', label: 'Choice' },
  { value: 'rating', label: 'Rating (1–5)' },
  { value: 'checkbox', label: 'Checkbox' },
];

export const isDeadline = (v: unknown): v is DeadlineValue =>
  !!v && typeof v === 'object' && typeof (v as DeadlineValue).date === 'string';

export const deadlineInstant = (v: DeadlineValue, defaultTz?: string): number =>
  dueInstant({ dueDate: v.date, dueTime: v.time, timezone: v.tz }, defaultTz)!;

export const zoneLabel = (tz: string | undefined) => (tz === AOE_TZ ? 'AoE' : tz === 'UTC' ? 'UTC' : '');

export const isDone = (c: Pick<Collection, 'doneStatuses'>, r: Pick<CollectionRecord, 'status'>) =>
  c.doneStatuses.includes(r.status);

/** Plain-text value for table cells. */
export function display(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  switch (f.type) {
    case 'date':
      return format(parseISO(v as string), 'd MMM yyyy');
    case 'deadline':
      // The deadline as announced ("23:59 AoE"); the UI shows your local time next to it.
      return isDeadline(v)
        ? `${format(parseISO(v.date), 'd MMM yyyy')} ${v.time} ${zoneLabel(v.tz)}`.trim()
        : '';
    case 'rating':
      return '★'.repeat(Number(v));
    case 'checkbox':
      return v ? 'Yes' : '';
    case 'url':
      return String(v).replace(/^https?:\/\/(www\.)?/, '');
    default:
      return String(v);
  }
}

function fieldKey(f: FieldDef, r: CollectionRecord, defaultTz?: string): number | string {
  const v = r.custom[f.key];
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'number' || f.type === 'rating') return Number(v);
  if (f.type === 'deadline') return isDeadline(v) ? deadlineInstant(v, defaultTz) : '';
  if (f.type === 'checkbox') return v ? 1 : 0;
  return String(v).toLowerCase();
}

/** Sort by 'title', 'status' (in lane order) or a field key. Empty values always go last. */
export function sortRecords(
  records: CollectionRecord[],
  c: Pick<Collection, 'fields' | 'statusOptions'>,
  by: string,
  dir: 'asc' | 'desc',
  defaultTz?: string,
): CollectionRecord[] {
  const f = c.fields.find((x) => x.key === by);
  const key = (r: CollectionRecord): number | string =>
    by === 'status'
      ? c.statusOptions.indexOf(r.status)
      : f
        ? fieldKey(f, r, defaultTz)
        : r.title.toLowerCase();
  return [...records].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === '' && kb !== '') return 1;
    if (kb === '' && ka !== '') return -1;
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    return (dir === 'asc' ? cmp : -cmp) || (a.order < b.order ? -1 : 1);
  });
}

export interface DatedItem {
  collection: Collection;
  record: CollectionRecord;
  field: FieldDef;
  /** The instant for deadlines; local midnight for dates. */
  at: number;
  allDay: boolean;
}

/** What a dated item is called: the field ("Birthday"), or for a plain "Date" its kind ("Anniversary"). */
export const datedLabel = (d: Pick<DatedItem, 'record' | 'field'>) =>
  d.field.key === 'date' && d.record.status ? d.record.status : d.field.name;

/**
 * Dates and deadlines of open items within [from, to): feeds the calendar and Coming up.
 * Yearly date fields (birthdays) repeat every year on the same day.
 */
export function datedItems(
  collections: Collection[],
  records: CollectionRecord[],
  from: number,
  to: number,
  defaultTz?: string,
): DatedItem[] {
  const byId = new Map(collections.map((c) => [c.id, c]));
  const out: DatedItem[] = [];
  for (const r of records) {
    const c = byId.get(r.collectionId);
    if (!c || r.deletedAt || isDone(c, r)) continue;
    for (const f of c.fields) {
      const v = r.custom[f.key];
      const add = (at: number, allDay: boolean) =>
        at >= from && at < to && out.push({ collection: c, record: r, field: f, at, allDay });
      if (f.type === 'deadline' && isDeadline(v)) add(deadlineInstant(v, defaultTz), false);
      else if (f.type === 'date' && typeof v === 'string' && v) {
        const d = parseISO(v);
        // An occasion marked "once" (custom.repeats) doesn't come round every year.
        if (!f.yearly || r.custom.repeats === 'once') add(d.getTime(), true);
        else for (let y = getYear(from); y <= getYear(to); y++) add(setYear(d, y).getTime(), true);
      }
    }
  }
  return onceEach(out);
}

/**
 * The same birthday or anniversary entered in People and in Occasions ("Ravi" and "Ravi’s birthday",
 * same day) shows once, so it isn't on the calendar twice or reminded twice. The occasion wins (it
 * may carry a reminder days before).
 */
function personDay(d: DatedItem): string | null {
  if (!d.field.yearly) return null;
  const people = d.collection.templateKey === 'people';
  const kind = people ? d.field.key : d.record.status.toLowerCase();
  if (kind !== 'birthday' && kind !== 'anniversary') return null;
  const raw = people ? d.record.title : String(d.record.custom.who || d.record.title);
  const name = raw
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/\b(birthday|bday|anniversary)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? `${kind}|${name}|${format(d.at, 'yyyy-MM-dd')}` : null;
}

function onceEach(items: DatedItem[]): DatedItem[] {
  const kept = new Map<string, number>();
  const out: (DatedItem | null)[] = [];
  for (const d of items) {
    const key = personDay(d);
    const i = key ? kept.get(key) : undefined;
    if (key && i === undefined) kept.set(key, out.length);
    else if (i !== undefined) {
      // Keep the occasion over the People entry.
      if (out[i]!.collection.templateKey === 'people' && d.collection.templateKey !== 'people') out[i] = d;
      continue;
    }
    out.push(d);
  }
  return out.filter((d): d is DatedItem => d !== null);
}

/**
 * Course grade from an Assessments list (fields weight, score, outOf).
 * earned: weighted marks so far; graded: total weight of scored items; total: all weights.
 */
/** Expense totals for one month ("2026-11"), by category, biggest first. */
export function expenseSummary(records: CollectionRecord[], month: string) {
  const byCat = new Map<string, number>();
  let total = 0;
  for (const r of records) {
    const amount = Number(r.custom.amount);
    const date = String(r.custom.date ?? '');
    if (!(amount > 0) || !date.startsWith(month)) continue;
    total += amount;
    const cat = String(r.custom.category ?? 'Other');
    byCat.set(cat, (byCat.get(cat) ?? 0) + amount);
  }
  return { total, byCategory: [...byCat].sort((a, b) => b[1] - a[1]) };
}

export function gradeSummary(records: CollectionRecord[]) {
  let earned = 0;
  let graded = 0;
  let total = 0;
  for (const r of records) {
    const w = Number(r.custom.weight);
    if (!(w > 0)) continue;
    total += w;
    const score = Number(r.custom.score);
    const outOf = Number(r.custom.outOf);
    if (r.custom.score === undefined || !(outOf > 0)) continue;
    graded += w;
    earned += (w * score) / outOf;
  }
  return { earned, graded, total };
}
