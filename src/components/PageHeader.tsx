import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { COLOR_CLASSES, type SectionColor } from '@/app/nav';
import { cn } from '@/lib/cn';

interface Props {
  title: string;
  icon?: LucideIcon;
  color?: SectionColor;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, icon: Icon, color = 'neutral', subtitle, actions }: Props) {
  const c = COLOR_CLASSES[color];
  return (
    <header className="mb-6 flex items-start gap-3">
      {Icon && (
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', c.soft)}>
          <Icon className={cn('size-5', color === 'neutral' ? 'text-accent' : c.text)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('border-line bg-surface rounded-xl border p-4', className)}>{children}</section>
  );
}

export function MilestoneBadge({ milestone }: { milestone: string }) {
  return (
    <span className="border-line text-muted inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      {milestone === 'M0' ? 'Available' : `Arrives in ${milestone}`}
    </span>
  );
}
