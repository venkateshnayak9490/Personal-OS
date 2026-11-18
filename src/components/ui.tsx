import { RotateCw } from 'lucide-react';
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
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
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

const field =
  'w-full rounded-xl border border-line bg-surface px-3 text-base text-fg placeholder:text-muted/80 focus:border-fg/40 focus:outline-none disabled:opacity-60 md:rounded-lg md:text-sm';

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
        <div className="bg-surface-2 mb-3 grid size-11 place-items-center rounded-full">
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
        <>
          <div className="bg-surface-2 h-7 w-2/5 animate-pulse rounded-lg" />
          <div className="bg-surface-2 h-4 w-3/5 animate-pulse rounded" />
          <div className="bg-surface-2 h-4 w-1/2 animate-pulse rounded" />
        </>
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
      className={cn('bg-surface-2 h-1.5 overflow-hidden rounded-full', className)}
    >
      <div
        className="bg-fg/80 h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
