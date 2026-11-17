import { Ellipsis, House, LayoutGrid, ListTodo, Plus, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { useUIStore } from './ui-store';

interface Tab {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
}

const inSections = (p: string) => p === '/sections' || p.startsWith('/s/') || p === '/settings/sections';

const TABS_LEFT: Tab[] = [
  { key: 'today', label: 'Today', to: '/', icon: House, isActive: (p) => p === '/' },
  { key: 'tasks', label: 'Tasks', to: '/tasks', icon: ListTodo, isActive: (p) => p === '/tasks' },
];
const TABS_RIGHT: Tab[] = [
  { key: 'sections', label: 'Sections', to: '/sections', icon: LayoutGrid, isActive: inSections },
  {
    key: 'more',
    label: 'More',
    to: '/more',
    icon: Ellipsis,
    isActive: (p) => !['/', '/tasks'].includes(p) && !inSections(p),
  },
];

function TabLink({ tab, path }: { tab: Tab; path: string }) {
  const active = tab.isActive(path);
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
        active ? 'text-fg' : 'text-muted',
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
      {tab.label}
    </Link>
  );
}

/**
 * Phone navigation (< 768px). Solid background on purpose: backdrop blur on a fixed bar
 * can black out the page on some Android GPUs.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const openComposer = useUIStore((s) => s.setComposerOpen);

  return (
    <nav
      aria-label="Main navigation"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {TABS_LEFT.map((t) => (
          <TabLink key={t.key} tab={t} path={pathname} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openComposer(true)}
            aria-label="New task"
            className="bg-accent text-accent-fg grid size-12 place-items-center rounded-full shadow-lg shadow-black/30 transition-transform duration-150 active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </div>
        {TABS_RIGHT.map((t) => (
          <TabLink key={t.key} tab={t} path={pathname} />
        ))}
      </div>
    </nav>
  );
}
