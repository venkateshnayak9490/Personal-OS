import { CalendarDays, Ellipsis, LayoutDashboard, LayoutGrid, Plus, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { SECTIONS } from './nav';
import { useUIStore } from './ui-store';

interface Tab {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
}

const inSections = (p: string) =>
  p === '/sections' || SECTIONS.some((s) => p === s.path || p.startsWith(s.path + '/'));

const TABS_LEFT: Tab[] = [
  { key: 'today', label: 'Today', to: '/', icon: LayoutDashboard, isActive: (p) => p === '/' },
  {
    key: 'calendar',
    label: 'Calendar',
    to: '/calendar',
    icon: CalendarDays,
    isActive: (p) => p === '/calendar',
  },
];
const TABS_RIGHT: Tab[] = [
  { key: 'sections', label: 'Sections', to: '/sections', icon: LayoutGrid, isActive: inSections },
  {
    key: 'more',
    label: 'More',
    to: '/more',
    icon: Ellipsis,
    isActive: (p) => !['/', '/calendar'].includes(p) && !inSections(p),
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
        'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
        active ? 'text-fg' : 'text-muted',
      )}
    >
      <Icon className={cn('size-5', active && 'text-accent')} />
      {tab.label}
    </Link>
  );
}

/** Mobile navigation (< 768px). build.md §12.2 */
export function BottomNav() {
  const { pathname } = useLocation();
  const openCapture = useUIStore((s) => s.setQuickCaptureOpen);

  return (
    <nav
      aria-label="Main navigation"
      className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {TABS_LEFT.map((t) => (
          <TabLink key={t.key} tab={t} path={pathname} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openCapture(true)}
            aria-label="Quick Capture"
            className="bg-accent text-accent-fg shadow-accent/25 grid size-12 place-items-center rounded-2xl shadow-lg active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>
        {TABS_RIGHT.map((t) => (
          <TabLink key={t.key} tab={t} path={pathname} />
        ))}
      </div>
    </nav>
  );
}
