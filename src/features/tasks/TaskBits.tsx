import { Check, Minus, X } from 'lucide-react';
import type { Priority, Tag, TaskStatus } from '@/core/domain/types';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

export const PRIORITY_STYLE: Record<Priority, { ring: string; text: string; fill: string }> = {
  1: { ring: 'border-red-500', text: 'text-red-500', fill: 'bg-red-500' },
  2: { ring: 'border-orange-500', text: 'text-orange-500', fill: 'bg-orange-500' },
  3: { ring: 'border-sky-500', text: 'text-sky-500', fill: 'bg-sky-500' },
  4: { ring: 'border-muted/60', text: 'text-muted', fill: 'bg-muted' },
};

/** Round checkbox; the ring color shows priority. Skipped/cancelled show their own marks. */
export function TaskCheck({
  status,
  priority,
  onClick,
  label,
  small,
}: {
  status: TaskStatus;
  priority: Priority;
  onClick: () => void;
  label: string;
  small?: boolean;
}) {
  const p = PRIORITY_STYLE[priority];
  const done = status === 'completed';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-2 transition-colors',
        small ? 'size-[18px]' : 'size-5',
        done ? cn(p.fill, 'border-transparent text-white') : p.ring,
        status === 'skipped' && 'border-dashed',
        status === 'cancelled' && 'border-muted/50 text-muted',
        status === 'in_progress' && 'border-[3px]',
      )}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
      {status === 'skipped' && <Minus className="text-muted size-3" strokeWidth={3} />}
      {status === 'cancelled' && <X className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  const c = colorFor(tag.color);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        c.soft,
        c.text,
      )}
    >
      #{tag.name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${tag.name}`}
          onClick={onRemove}
          className="-mr-0.5 rounded-full hover:opacity-70"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
