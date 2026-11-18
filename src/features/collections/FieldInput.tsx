import { format, formatDistanceStrict } from 'date-fns';
import { ExternalLink, Star } from 'lucide-react';
import { useNow } from '@/app/use-now';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Input, Select, Textarea } from '@/components/ui';
import { deadlineInstant, isDeadline } from '@/core/domain/collections';
import { AOE_TZ } from '@/core/domain/tasks';
import type { DeadlineValue, FieldDef } from '@/core/domain/types';
import { cn } from '@/lib/cn';

const ZONES = [
  { value: AOE_TZ, label: 'AoE' },
  { value: 'UTC', label: 'UTC' },
  { value: '', label: 'My time' },
];

/**
 * Editor for one field value. Text-like inputs save on blur; the rest save on change.
 * Uncontrolled text inputs are keyed by their value, so a change from elsewhere (sync, undo) shows up.
 */
export function FieldInput({
  field,
  value,
  onChange,
  id,
  weekStartsOn,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  id: string;
  weekStartsOn?: 0 | 1;
}) {
  const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const blurSave = (raw: string) => {
    const next = field.type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw.trim();
    if (text(next) !== text(value)) onChange(next);
  };

  switch (field.type) {
    case 'longtext':
      return (
        <Textarea
          id={id}
          key={text(value)}
          defaultValue={text(value)}
          onBlur={(e) => blurSave(e.target.value)}
        />
      );
    case 'url':
      return (
        <div className="flex gap-2">
          <Input
            id={id}
            key={text(value)}
            type="url"
            placeholder="https://"
            defaultValue={text(value)}
            onBlur={(e) => blurSave(e.target.value)}
          />
          {typeof value === 'string' && /^https?:\/\//.test(value) && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${field.name}`}
              className="border-line hover:bg-surface-2 grid size-11 shrink-0 place-items-center rounded-xl border md:size-10 md:rounded-lg"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      );
    case 'number':
    case 'text':
      return (
        <Input
          id={id}
          key={text(value)}
          type={field.type === 'number' ? 'number' : 'text'}
          defaultValue={text(value)}
          onBlur={(e) => blurSave(e.target.value)}
        />
      );
    case 'select':
      return (
        <Select id={id} value={text(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      );
    case 'checkbox':
      return (
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--fg)]"
        />
      );
    case 'rating': {
      const n = Number(value ?? 0);
      return (
        <div role="radiogroup" aria-label={field.name} className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={n === i}
              aria-label={`${i} of 5`}
              onClick={() => onChange(n === i ? undefined : i)}
              className="hover:bg-surface-2 rounded-md p-1"
            >
              <Star className={cn('size-5', i <= n ? 'fill-current text-amber-400' : 'text-muted')} />
            </button>
          ))}
        </div>
      );
    }
    case 'date':
      return (
        <DatePicker
          value={text(value)}
          weekStartsOn={weekStartsOn}
          onChange={(v) => onChange(v || undefined)}
        >
          <DateButton label={field.name} value={text(value)} />
        </DatePicker>
      );
    case 'deadline':
      return (
        <DeadlineInput field={field} value={value} onChange={onChange} id={id} weekStartsOn={weekStartsOn} />
      );
  }
}

function DeadlineInput({
  field,
  value,
  onChange,
  id,
  weekStartsOn,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  id: string;
  weekStartsOn?: 0 | 1;
}) {
  const v: DeadlineValue | undefined = isDeadline(value) ? value : undefined;
  const set = (patch: Partial<DeadlineValue>) => {
    const next = { date: v?.date ?? '', time: v?.time ?? '23:59', tz: v ? v.tz : field.defaultTz, ...patch };
    if (!next.date) return onChange(undefined);
    if (!next.tz) delete next.tz;
    onChange(next);
  };
  const now = useNow(60_000);
  const at = v ? deadlineInstant(v) : null;
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <DatePicker
          value={v?.date ?? ''}
          weekStartsOn={weekStartsOn}
          onChange={(d) => set({ date: d ?? '' })}
        >
          <DateButton label={field.name} value={v?.date} />
        </DatePicker>
        <Input
          id={id}
          type="time"
          aria-label={`${field.name} time`}
          value={v?.time ?? '23:59'}
          disabled={!v}
          onChange={(e) => e.target.value && set({ time: e.target.value })}
          className="w-28"
        />
        <Select
          aria-label={`${field.name} timezone`}
          value={v ? (v.tz ?? '') : (field.defaultTz ?? '')}
          disabled={!v}
          onChange={(e) => set({ tz: e.target.value || undefined })}
          className="w-28"
        >
          {ZONES.map((z) => (
            <option key={z.label} value={z.value}>
              {z.label}
            </option>
          ))}
        </Select>
      </div>
      {at !== null && (
        <p className="text-muted mt-1.5 text-xs">
          {v?.tz ? `Your time: ${format(at, 'EEE d MMM, HH:mm')} · ` : ''}
          {at > now ? `in ${formatDistanceStrict(at, now)}` : `${formatDistanceStrict(at, now)} ago`}
        </p>
      )}
    </div>
  );
}
