import { ChevronRight, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import {
  COLOR_CLASSES,
  PRIMARY_NAV,
  PRIVATE_NAV,
  SECTIONS,
  SETTINGS_NAV,
  TOOLS_NAV,
  type NavItem,
} from './nav';
import { useUIStore } from './ui-store';
import { useMediaQuery } from './use-media-query';

function itemClass(active: boolean, collapsed: boolean) {
  return cn(
    'flex min-h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
    collapsed && 'justify-center px-0',
    active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
  );
}

function Item({ item, collapsed, nested = false }: { item: NavItem; collapsed: boolean; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.title : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={({ isActive }) => cn(itemClass(isActive, collapsed), nested && 'min-h-8 pl-9 text-[13px]')}
    >
      {!nested && (
        <Icon
          className={cn('size-[18px] shrink-0', item.color !== 'neutral' && COLOR_CLASSES[item.color].text)}
        />
      )}
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  );
}

function SectionGroup({ section, collapsed }: { section: NavItem; collapsed: boolean }) {
  const expanded = useUIStore((s) => s.expandedSections.includes(section.key));
  const toggle = useUIStore((s) => s.toggleSection);
  const { pathname } = useLocation();
  const Icon = section.icon;
  const inSection = pathname === section.path || pathname.startsWith(section.path + '/');

  if (collapsed) return <Item item={section} collapsed />;

  return (
    <div>
      <div className={cn(itemClass(pathname === section.path, false), 'pr-1', inSection && 'text-fg')}>
        <NavLink to={section.path} className="flex min-w-0 flex-1 items-center gap-3 self-stretch">
          <Icon className={cn('size-[18px] shrink-0', COLOR_CLASSES[section.color].text)} />
          <span className="truncate">{section.title}</span>
        </NavLink>
        <button
          type="button"
          onClick={() => toggle(section.key)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.title}`}
          className="text-muted hover:bg-surface-2 hover:text-fg grid size-7 place-items-center rounded-md"
        >
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {section.children?.map((c) => (
            <Item key={c.key} item={c} collapsed={false} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return <div className="border-line mx-3 my-2 border-t" />;
  return (
    <div className="text-muted px-2.5 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase">
      {children}
    </div>
  );
}

export function Sidebar() {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const userCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openCapture = useUIStore((s) => s.setQuickCaptureOpen);
  // Tablets get an icon rail; desktops follow the user's choice.
  const collapsed = !isWide || userCollapsed;

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'border-line bg-surface sticky top-0 hidden h-dvh shrink-0 flex-col border-r md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2 px-3', collapsed && 'justify-center')}>
        <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
        {!collapsed && <span className="flex-1 truncate font-semibold tracking-tight">Personal OS</span>}
        {isWide && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'text-muted hover:bg-surface-2 hover:text-fg grid size-8 place-items-center rounded-md',
              collapsed && 'hidden',
            )}
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <div className={cn('flex gap-2 px-3 pb-2', collapsed && 'flex-col items-center')}>
        <button
          type="button"
          onClick={() => openCapture(true)}
          title="Quick Capture"
          aria-label="Quick Capture"
          className={cn(
            'bg-accent text-accent-fg flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:opacity-90',
            collapsed ? 'size-9' : 'flex-1',
          )}
        >
          <Plus className="size-4" />
          {!collapsed && 'Quick Capture'}
        </button>
        <button
          type="button"
          disabled
          title="Search (arrives in M2)"
          aria-label="Search (arrives in M2)"
          className="border-line text-muted grid size-9 place-items-center rounded-lg border opacity-60"
        >
          <Search className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {PRIMARY_NAV.map((i) => (
          <Item key={i.key} item={i} collapsed={collapsed} />
        ))}
        <GroupLabel collapsed={collapsed}>Sections</GroupLabel>
        {SECTIONS.map((s) => (
          <SectionGroup key={s.key} section={s} collapsed={collapsed} />
        ))}
        <GroupLabel collapsed={collapsed}>Insights</GroupLabel>
        {TOOLS_NAV.map((i) => (
          <Item key={i.key} item={i} collapsed={collapsed} />
        ))}
        <GroupLabel collapsed={collapsed}>Private</GroupLabel>
        {PRIVATE_NAV.map((i) => (
          <Item key={i.key} item={i} collapsed={collapsed} />
        ))}
      </nav>

      <div className="border-line space-y-0.5 border-t p-3">
        <Item item={SETTINGS_NAV} collapsed={collapsed} />
        {isWide && collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className={itemClass(false, true) + ' w-full'}
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}
      </div>
    </aside>
  );
}
