import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { colorFor } from '@/lib/palette';
import { Badge } from './ui';

interface Props {
  title: string;
  icon?: LucideIcon;
  /** Palette color name; omitted = accent. */
  color?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, icon: Icon, color, subtitle, actions }: Props) {
  const c = color ? colorFor(color) : undefined;
  return (
    <header className="mb-6 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {/* The sheet heading: title over a 2px ink rule. Only a section page shows its icon, in its area colour. */}
        <h1 className="title-page border-fg inline-flex max-w-full items-center gap-2 border-b-2 pb-2">
          {Icon && c && <Icon aria-hidden className={cn('size-5 shrink-0', c.text)} />}
          <span className="min-w-0">{title}</span>
        </h1>
        {subtitle && <p className="text-muted mt-2 text-[15px] md:text-sm">{subtitle}</p>}
      </div>
      {/* Phones: header actions meet the 44px target, whatever size the page asked for. */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2 max-md:[&_button]:min-h-11">{actions}</div>
      )}
    </header>
  );
}

/** A bordered panel. Use for things that are one object (a form, a table, the check-in), not to wrap every block. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('border-line bg-surface rounded-2xl border p-4', className)}>{children}</section>
  );
}

export function MilestoneBadge({ milestone }: { milestone: string }) {
  return <Badge>{milestone === 'M0' || milestone === 'M1' ? 'Available' : `Arrives in ${milestone}`}</Badge>;
}
