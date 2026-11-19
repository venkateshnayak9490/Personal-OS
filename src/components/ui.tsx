import { RotateCw, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/88 active:bg-accent/80',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-2 active:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg active:bg-surface-2',
  danger: 'bg-danger text-danger-fg hover:bg-danger/88 active:bg-danger/80',
};
// Phones get 44px+ targets; pointers get the denser desktop sizes.
const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px] md:h-8 md:rounded-md md:px-2.5 md:text-xs',
  md: 'h-11 gap-2 rounded-xl px-4 text-[15px] md:h-10 md:rounded-lg md:text-sm',
  icon: 'size-11 rounded-xl md:size-10 md:rounded-lg',
  'icon-sm': 'size-10 rounded-lg md:size-8 md:rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,opacity,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

// Inputs are square, ruled boxes; focus draws the focus colour as a 1px ring on top of the border.
const field =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-base text-fg placeholder:text-muted focus:border-focus focus:ring-1 focus:ring-focus focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger md:text-sm';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(field, 'h-11 md:h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea ref={ref} className={cn(field, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(field, 'h-11 pr-8 md:h-10', className)} {...props} />;
});

/**
 * One segmented control for every "pick one of a few" switch (Week/Month/Year, Table/Board, One week /
 * Every week, Theme). `as="tabs"` when it switches what the page shows, else radio buttons.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  as = 'radio',
  full,
}: {
  label: string;
  options: readonly { value: T; label: string; icon?: LucideIcon; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  as?: 'tabs' | 'radio';
  /** Stretch to the full width on phones. */
  full?: boolean;
}) {
  const tabs = as === 'tabs';
  return (
    <div
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={cn('bg-surface-2 inline-flex gap-0.5 rounded-md p-0.5', full && 'max-md:flex max-md:w-full')}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            {...(tabs ? { 'aria-selected': on } : { 'aria-checked': on })}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors md:h-7 md:text-xs',
              full && 'max-md:flex-1',
              on ? 'bg-surface text-fg ring-line-strong shadow-xs ring-1' : 'text-muted hover:text-fg',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {o.label}
            {!!o.count && <span className="tabular-nums opacity-60">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Why Save is off, said in the sheet's footer (left of the buttons). Nothing when it can save. */
export function SaveHint({ children }: { children?: string | false | null | 0 | '' }) {
  if (!children) return null;
  return (
    <p role="status" className="text-warning mr-auto self-center text-xs md:text-[13px]">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="text-muted block text-[13px] font-medium md:text-xs">
        {label}
      </label>
      {children}
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

/** What will appear here, and the one thing to do next. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-8' : 'py-14')}>
      {Icon && (
        <div className="border-line-strong mb-3 grid size-10 place-items-center rounded-md border">
          <Icon className="text-muted size-5" />
        </div>
      )}
      <p className="text-[15px] font-medium md:text-sm">{title}</p>
      {children && <div className="text-muted mt-1 max-w-xs text-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Placeholder while local data loads (normally a few ms, so nothing shows at first).
 * If loading ever stalls, say so and offer a reload instead of leaving a blank screen.
 */
export function Loading({ label = 'Loading' }: { label?: string }) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'slow'>('hidden');
  useEffect(() => {
    const a = setTimeout(() => setPhase('shown'), 250);
    const b = setTimeout(() => setPhase('slow'), 6000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  if (phase === 'hidden') return <div aria-busy="true" className="min-h-40" />;
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3 py-6">
      {phase === 'shown' ? (
        // Skeleton of a page: a title over its rule, then three ruled rows.
        <div className="animate-pulse">
          <div className="bg-surface-2 h-6 w-2/5 rounded-sm" />
          <div className="bg-line-strong mt-2.5 mb-5 h-0.5 w-2/5" />
          {[60, 45, 52].map((w) => (
            <div key={w} className="border-line flex items-center gap-3 border-b py-3">
              <div className="bg-surface-2 size-4 rounded-sm" />
              <div className="bg-surface-2 h-3.5 rounded-sm" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={RotateCw}
          title="This is taking longer than usual"
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          Your data is safe on this device. Reloading usually fixes it.
        </EmptyState>
      )}
    </div>
  );
}

/** Thin progress bar with an accessible value. */
export function ProgressBar({ pct, label, className }: { pct: number; label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-surface-2 h-1.5 overflow-hidden rounded-xs', className)}
    >
      <div className="bg-fg h-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A block's title over a strong hairline, with an optional action on the right
 * ("Open Today", "Hide"). Use it instead of wrapping blocks in cards.
 */
export function BlockHeader({
  title,
  id,
  action,
  count,
  className,
}: {
  title: ReactNode;
  id?: string;
  action?: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('border-line-strong mb-2 flex items-baseline gap-2 border-b pb-1.5', className)}>
      <h2 id={id} className="title-block">
        {title}
      </h2>
      {count !== undefined && <span className="text-meta text-muted">{count}</span>}
      {action && <div className="text-meta text-muted ml-auto flex items-center gap-1">{action}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'danger' | 'warning' | 'success' | 'info';
const TONES: Record<Tone, string> = {
  neutral: 'border-line-strong text-muted',
  danger: 'border-danger/50 text-danger',
  warning: 'border-warning/50 text-warning',
  success: 'border-success/50 text-success',
  info: 'border-info/50 text-info',
};

/** A small outlined label: counts, states, "Overdue", "Private". The word carries the meaning; tone only adds to it. */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[11.5px] font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type Mark = 'done' | 'skipped' | 'rest' | 'missed' | 'due' | 'none';
const MARK_LABEL: Record<Mark, string> = {
  done: 'Done',
  skipped: 'Skipped',
  rest: 'Rest day',
  missed: 'Missed',
  due: 'Due',
  none: 'Not yet',
};

/**
 * The register mark: one shape per state, readable without colour.
 * Done ✓ (ink), skipped S, rest R, missed – (danger), due ○, none blank.
 */
export function StatusMark({ mark, className }: { mark: Mark; className?: string }) {
  const body =
    mark === 'done' ? (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ) : mark === 'skipped' ? (
      'S'
    ) : mark === 'rest' ? (
      'R'
    ) : mark === 'missed' ? (
      '–'
    ) : mark === 'due' ? (
      <span aria-hidden className="border-muted size-3.5 rounded-full border-[1.5px]" />
    ) : null;
  return (
    <span
      role="img"
      aria-label={MARK_LABEL[mark]}
      className={cn(
        'inline-grid place-items-center text-[13px] font-bold',
        mark === 'done' && 'text-fg',
        (mark === 'skipped' || mark === 'rest') && 'text-muted',
        mark === 'missed' && 'text-danger',
        className,
      )}
    >
      {body}
    </span>
  );
}
