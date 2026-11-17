import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  nextMonday,
  nextSaturday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useNow } from '@/app/use-now';
import { cn } from '@/lib/cn';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

interface Props {
  /** yyyy-MM-dd or '' */
  value: string;
  onChange: (value: string) => void;
  /** The button that opens the picker. */
  children: ReactNode;
  weekStartsOn?: 0 | 1;
  align?: 'start' | 'center' | 'end';
  /** Where keyboard focus goes after closing (default: back to the button). */
  onCloseFocus?: () => void;
}

/**
 * One click: quick choices (Today, Tomorrow, This weekend, Next week) plus a month grid.
 * Picking a day applies it immediately, with no typing into a date field.
 */
export function DatePicker({
  value,
  onChange,
  children,
  weekStartsOn = 1,
  align = 'start',
  onCloseFocus,
}: Props) {
  const now = useNow(60_000);
  const today = new Date(now);
  const selected = value ? parseISO(value) : undefined;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selected ?? today));

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const quick: { label: string; date?: Date }[] = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This weekend', date: nextSaturday(addDays(today, -1)) },
    { label: 'Next week', date: nextMonday(today) },
  ];

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const weekdays = days.slice(0, 7).map((d) => format(d, 'EEEEE'));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(startOfMonth(selected ?? today));
      }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="anim-pop border-line bg-surface z-[70] w-[19rem] rounded-xl border p-2 shadow-2xl focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            if (!onCloseFocus) return;
            e.preventDefault();
            onCloseFocus();
          }}
        >
          <div className="space-y-0.5">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => pick(ymd(q.date!))}
                className={cn(
                  'hover:bg-surface-2 flex h-8 w-full items-center justify-between rounded-md px-2.5 text-sm',
                  selected && isSameDay(selected, q.date!) && 'bg-surface-2 font-medium',
                )}
              >
                {q.label}
                <span className="text-muted text-xs">{format(q.date!, 'EEE d MMM')}</span>
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={() => pick('')}
                className="text-muted hover:bg-surface-2 hover:text-fg flex h-8 w-full items-center rounded-md px-2.5 text-sm"
              >
                No date
              </button>
            )}
          </div>

          <div className="border-line mt-2 border-t pt-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-sm font-medium">{format(month, 'MMMM yyyy')}</span>
              <div className="flex">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth(addMonths(month, -1))}
                  className="text-muted hover:bg-surface-2 hover:text-fg grid size-7 place-items-center rounded-md"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(addMonths(month, 1))}
                  className="text-muted hover:bg-surface-2 hover:text-fg grid size-7 place-items-center rounded-md"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center" role="grid" aria-label={format(month, 'MMMM yyyy')}>
              {weekdays.map((w, i) => (
                <div key={i} className="text-muted py-1 text-[11px]">
                  {w}
                </div>
              ))}
              {days.map((d) => {
                const isSel = selected && isSameDay(d, selected);
                const isToday = isSameDay(d, today);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    aria-label={format(d, 'EEEE d MMMM yyyy')}
                    aria-pressed={!!isSel}
                    onClick={() => pick(ymd(d))}
                    className={cn(
                      'mx-auto grid size-8 place-items-center rounded-full text-[13px] tabular-nums',
                      !isSameMonth(d, month) && 'text-muted/50',
                      isSel ? 'bg-fg text-bg font-semibold' : 'hover:bg-surface-2',
                      isToday && !isSel && 'text-fg ring-line font-semibold ring-1',
                    )}
                  >
                    {format(d, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Short label for a date value: Today, Tomorrow, or "Fri 21 Nov". */
export function dateChipLabel(value: string, now: number): string {
  if (!value) return '';
  const d = parseISO(value);
  const t = new Date(now);
  if (isSameDay(d, t)) return 'Today';
  if (isSameDay(d, addDays(t, 1))) return 'Tomorrow';
  return format(d, d.getFullYear() === t.getFullYear() ? 'EEE d MMM' : 'd MMM yyyy');
}

/** Field-style button that opens a DatePicker (use as its child). */
export function DateButton({
  label,
  value,
  ...props
}: { label: string; value?: string } & ComponentProps<'button'>) {
  const now = useNow(60_000);
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="border-line bg-surface hover:border-fg/30 flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-base md:h-10 md:rounded-lg md:text-sm"
    >
      <CalendarDays className="text-muted size-4 shrink-0" />
      <span className={cn('flex-1 truncate', !value && 'text-muted')}>
        {value ? dateChipLabel(value, now) : 'No date'}
      </span>
    </button>
  );
}
