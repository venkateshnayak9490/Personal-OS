import { Ellipsis, House, LayoutGrid, ListTodo, Plus, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useProfile } from '@/core/hooks';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { flatten } from '@/core/domain/tree';
import { cn } from '@/lib/cn';
import { iconFor } from '@/lib/icons';
import { allNavItems, isBuilt, nodePath } from './nav';
import { useUIStore } from './ui-store';

interface Tab {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

/** The three tabs you can choose (＋ and More are fixed, so every screen stays reachable). */
export const DEFAULT_TABS = ['dashboard', 'tasks', 'sections'];
const SECTIONS_TAB: Tab = { key: 'sections', label: 'Sections', to: '/sections', icon: LayoutGrid };

// Shorter names and the familiar home icon for the bar.
const SHORT: Record<string, Tab> = {
  dashboard: { key: 'dashboard', label: 'Today', to: '/', icon: House },
  tasks: { key: 'tasks', label: 'Tasks', to: '/tasks', icon: ListTodo },
};

/** Everything that can sit in the bar: built screens, the Sections list, and any of your sections. */
export function tabChoices(tree?: NodeTree): Tab[] {
  const screens = allNavItems()
    .filter(isBuilt)
    .map((i) => ({ key: i.key, label: i.title, to: i.path, icon: i.icon }))
    .map((t) => SHORT[t.key] ?? t);
  const sections = tree
    ? flatten(tree.visibleTree).map(({ node }) => ({
        key: `node:${node.id}`,
        label: node.title,
        to: nodePath(node.id),
        icon: iconFor(node.icon),
      }))
    : [];
  return [...screens, SECTIONS_TAB, ...sections];
}

export function useBottomTabs(): string[] {
  const saved = useProfile()?.settings.bottomTabs;
  return Array.isArray(saved) && saved.length === 3 ? (saved as string[]) : DEFAULT_TABS;
}

const isActive = (tab: Tab, path: string) =>
  tab.to === '/'
    ? path === '/'
    : tab.key === 'sections'
      ? path === '/sections' || path === '/settings/sections' || path.startsWith('/s/')
      : path === tab.to || path.startsWith(`${tab.to}/`);

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
        active ? 'text-fg' : 'text-muted',
      )}
    >
      <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
      <span className="max-w-full truncate">{tab.label}</span>
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
  const tree = useNodeTree();
  const keys = useBottomTabs();
  const choices = tabChoices(tree);
  // A tab whose section was deleted falls back to the default for that slot.
  const tabs = keys.map(
    (k, i) =>
      choices.find((c) => c.key === k) ?? choices.find((c) => c.key === DEFAULT_TABS[i]) ?? SECTIONS_TAB,
  );
  // A specific tab (e.g. your Gym section) wins over the general Sections tab.
  const specific = tabs.findIndex((t) => t.key !== 'sections' && isActive(t, pathname));
  const activeIndex = specific >= 0 ? specific : tabs.findIndex((t) => isActive(t, pathname));
  const more: Tab = { key: 'more', label: 'More', to: '/more', icon: Ellipsis };

  return (
    <nav
      aria-label="Main navigation"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {tabs.slice(0, 2).map((t, i) => (
          <TabLink key={`${i}-${t.key}`} tab={t} active={i === activeIndex} />
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
        <TabLink tab={tabs[2] ?? SECTIONS_TAB} active={activeIndex === 2} />
        <TabLink tab={more} active={activeIndex === -1} />
      </div>
    </nav>
  );
}
