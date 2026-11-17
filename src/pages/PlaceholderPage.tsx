import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { COLOR_CLASSES, type NavItem, type SectionColor } from '@/app/nav';
import { Card, MilestoneBadge, PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/cn';

/** Short original lines per area. The full context-aware message engine arrives in M2. */
const LINES: Partial<Record<SectionColor, string>> = {
  work: 'Small, steady steps compound into discoveries.',
  self: 'Show up today. Progress follows the habit, not the mood.',
  personal: 'Make room for the people and moments that matter.',
  misc: 'A clear list makes a calm mind.',
};

/** Stand-in for screens that are not built yet. Shows what will live here and when. */
export function PlaceholderPage({ item }: { item: NavItem }) {
  const line = LINES[item.color];
  return (
    <>
      <PageHeader
        title={item.title}
        icon={item.icon}
        color={item.color}
        subtitle={line ? <span className="italic">{line}</span> : undefined}
      />

      <Card className="mb-6 flex items-start justify-between gap-4">
        <p className="text-muted text-sm">{item.summary}</p>
        <MilestoneBadge milestone={item.milestone} />
      </Card>

      {item.children && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {item.children.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.key}
                to={c.path}
                className="group border-line bg-surface hover:bg-surface-2 flex items-start gap-3 rounded-xl border p-4 transition-colors"
              >
                <div
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg',
                    COLOR_CLASSES[c.color].soft,
                  )}
                >
                  <Icon className={cn('size-[18px]', COLOR_CLASSES[c.color].text)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 font-medium">
                    {c.title}
                    <ChevronRight className="text-muted size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="text-muted mt-0.5 line-clamp-2 text-xs">{c.summary}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
