import type { NavItem } from '@/app/nav';
import { Card, MilestoneBadge, PageHeader } from '@/components/PageHeader';

/** Stand-in for app pages that are not built yet. Shows what will live here and when. */
export function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.title} icon={item.icon} />
      <Card className="flex items-start justify-between gap-4">
        <p className="text-muted text-sm">{item.summary}</p>
        <MilestoneBadge milestone={item.milestone} />
      </Card>
    </>
  );
}
