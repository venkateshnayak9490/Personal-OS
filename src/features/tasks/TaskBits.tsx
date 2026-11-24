import { Check, Minus, X } from 'lucide-react';
import type { Priority, Tag, TaskStatus } from '@/core/domain/types';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';

// Priority is weight in ink, with its word beside it in rows ("Urgent", "High"). It never uses a
// status colour: vermilion means overdue, and a colour alone would be the only cue (WCAG 1.4.1).
export const PRIORITY_STYLE: Record<Priority, { ring: string; text: string; fill: string }> = {
  1: { ring: 'border-fg', text: 'text-fg', fill: 'bg-fg' },
  2: { ring: 'border-fg-2', text: 'text-fg-2', fill: 'bg-fg-2' },
  3: { ring: 'border-line-strong', text: 'text-muted', fill: 'bg-muted' },
  4: { ring: 'border-line-strong', text: 'text-muted', fill: 'bg-muted/50' },
};

/**
 * Square check (the register's box); a darker border marks urgent and high priority. Done is an ink fill with a
 * tick, whatever the priority: done is never a colour. Skipped and cancelled show their own marks.
 */
export function TaskCheck({
  status,
  priority,
  onClick,
  label,
  small,
  animate,
}: {
  status: TaskStatus;
  priority: Priority;
  onClick: () => void;
  label: string;
  small?: boolean;
  /** Play the check-off animation (only right after the user ticks it). */
  animate?: boolean;
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
        // The visible circle is small; the ::before pseudo-element makes the tap target ~44px.
        'relative grid shrink-0 place-items-center rounded-[3px] border-2 transition-colors before:absolute before:-inset-2.5',
        small ? 'size-5 md:size-[18px]' : 'size-[22px] md:size-5',
        animate && 'anim-check',
        done ? 'bg-fg border-fg text-bg' : p.ring,
        status === 'skipped' && 'border-dashed',
        status === 'cancelled' && 'border-muted/50 text-muted',
        status === 'in_progress' && 'border-[3px]',
      )}
    >
      {done && <Check className="size-3.5 md:size-3" strokeWidth={3} />}
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
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
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
