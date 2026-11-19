import { ChevronRight, Ellipsis, Search } from 'lucide-react';
import { Link } from 'react-router';
import { comingSoon, groupItems, NAV_GROUPS, SETTINGS_NAV, TRASH_NAV, type NavItem } from '@/app/nav';
import { useUIStore } from '@/app/ui-store';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

function Row({ item, soon }: { item: NavItem; soon?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        'hover:bg-surface-2 active:bg-surface-2 flex min-h-14 items-center gap-3.5 px-4 transition-colors',
        soon && 'text-muted',
      )}
    >
      <Icon className="text-muted size-5 shrink-0" />
      <span className={cn('flex-1 truncate text-base', !soon && 'font-medium')}>{item.title}</span>
      {soon ? <span className="text-xs">Coming soon</span> : <ChevronRight className="text-muted size-4" />}
    </Link>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-line border-line mb-4 divide-y overflow-hidden rounded-2xl border">{children}</div>
  );
}

/** Opens search (the Ctrl+K palette) on a phone, where there's no keyboard shortcut. */
export function SearchButton({ compact }: { compact?: boolean }) {
  const open = useUIStore((s) => s.setPaletteOpen);
  if (compact)
    return (
      <Button variant="ghost" size="icon" aria-label="Search" onClick={() => open(true)}>
        <Search className="size-5" />
      </Button>
    );
  return (
    <button
      type="button"
      onClick={() => open(true)}
      className="border-line bg-surface text-muted mb-6 flex h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[15px]"
    >
      <Search className="size-4" /> Search tasks, notes, lists, sections…
    </button>
  );
}

/** Mobile "More" tab. */
export function MorePage() {
  // Every screen that works, so nothing is reachable only by typing its address.
  return (
    <>
      <PageHeader title="More" icon={Ellipsis} />
      <SearchButton />
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <h2 className="text-muted mb-2 px-1 text-[13px] font-medium">{g.label}</h2>
          <Group>
            {groupItems(g.keys).map((i) => (
              <Row key={i.key} item={i} />
            ))}
          </Group>
        </div>
      ))}
      <Group>
        <Row item={SETTINGS_NAV} />
        <Row item={TRASH_NAV} />
      </Group>
      {comingSoon().length > 0 && (
        <>
          <h2 className="text-muted mt-8 mb-2 px-1 text-[13px] font-medium">Coming soon</h2>
          <Group>
            {comingSoon().map((i) => (
              <Row key={i.key} item={i} soon />
            ))}
          </Group>
        </>
      )}
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="title-page">Page not found</h1>
      <p className="text-muted mt-1 text-sm">This page doesn’t exist (yet).</p>
      <Link to="/" className="text-accent mt-4 inline-block text-sm font-medium hover:underline">
        Go to Today
      </Link>
    </div>
  );
}
