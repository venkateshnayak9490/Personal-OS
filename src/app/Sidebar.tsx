import type { ReactNode } from 'react';
import { useAllTasks } from '@/core/hooks';
import { isClosed } from '@/core/domain/tasks';
import { ChevronRight, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import type { SectionNode } from '@/core/domain/types';
import { updateNode } from '@/core/repos/nodes';
import { attempt, toast } from './toast';
import { NavLink, useLocation } from 'react-router';
import type { TreeNode } from '@/core/domain/tree';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { FocusBadge } from '@/features/focus/FocusTimer';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';
import { useState } from 'react';
import {
  comingSoon,
  groupItems,
  NAV_GROUPS,
  nodePath,
  SETTINGS_NAV,
  TRASH_NAV,
  type NavGroup,
  type NavItem,
} from './nav';
import { useUIStore } from './ui-store';
import { useMediaQuery } from './use-media-query';

function itemClass(active: boolean, collapsed: boolean) {
  return cn(
    'flex min-h-8 items-center gap-3 rounded-md px-2.5 text-[13.5px] transition-colors',
    collapsed && 'min-h-9 justify-center px-0',
    // On the ink-blue shell: the current screen is a lit row in bold white.
    active ? 'bg-shell-2 font-semibold text-white' : 'text-shell-fg hover:bg-shell-2/70 hover:text-white',
  );
}

function Item({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: ReactNode }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.title : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={({ isActive }) => itemClass(isActive, collapsed)}
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
      {!collapsed && !!badge && <span className="text-shell-muted text-xs">{badge}</span>}
    </NavLink>
  );
}

function NodeItem({ t, tree, collapsed }: { t: TreeNode; tree: NodeTree; collapsed: boolean }) {
  const { node, children, depth } = t;
  const expanded = useUIStore((s) => s.expandedSections.includes(node.id));
  const toggle = useUIStore((s) => s.toggleSection);
  const { pathname } = useLocation();
  const color = colorFor(tree.colorOf(node.id));
  const active = pathname === nodePath(node.id);

  if (collapsed) {
    return (
      <NavLink
        to={nodePath(node.id)}
        title={node.title}
        aria-label={node.title}
        className={() => itemClass(active, true)}
      >
        <NodeIcon name={node.icon} className="size-[18px] shrink-0" />
      </NavLink>
    );
  }

  return (
    <div>
      <div
        className={cn(itemClass(active, false), 'group/row pr-1')}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        <NavLink to={nodePath(node.id)} className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch">
          {depth === 0 ? (
            // The area's colour as a square chip, like a course code on a timetable.
            <span aria-hidden className={cn('mx-[5px] size-2 shrink-0 rounded-xs', color.dot)} />
          ) : (
            <NodeIcon name={node.icon} className="text-shell-muted size-4 shrink-0" />
          )}
          <span className={cn('truncate', depth > 0 && 'text-[13px]')}>{node.title}</span>
        </NavLink>
        <button
          type="button"
          onClick={() => hideNode(node)}
          aria-label={`Hide ${node.title}`}
          title="Hide (you can show it again below)"
          className="text-shell-muted hover:bg-shell-2 hidden size-7 shrink-0 place-items-center rounded-md hover:text-white group-hover/row:grid focus-visible:grid"
        >
          <EyeOff className="size-3.5" />
        </button>
        {children.length > 0 && (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.title}`}
            className="text-shell-muted hover:bg-shell-2 grid size-7 shrink-0 place-items-center rounded-md hover:text-white"
          >
            <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>
      {expanded && children.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {children.map((c) => (
            <NodeItem key={c.node.id} t={c} tree={tree} collapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function hideNode(node: SectionNode) {
  void attempt(async () => {
    await updateNode(node.id, { hidden: true });
    toast(`“${node.title}” hidden`, () => updateNode(node.id, { hidden: false }));
  });
}

/** Hidden sections, folded away at the bottom; one click shows a section again. */
function HiddenSections({ tree, collapsed }: { tree: NodeTree; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const hidden = tree.nodes.filter((n) => n.hidden);
  if (collapsed || hidden.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-shell-muted flex h-8 w-full items-center gap-1 px-2.5 text-xs font-medium hover:text-white"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        Hidden ({hidden.length})
      </button>
      {open &&
        hidden.map((n) => (
          <div
            key={n.id}
            className="text-shell-muted flex min-h-8 items-center gap-2.5 rounded-md pr-1 pl-2.5 text-sm"
          >
            <NodeIcon name={n.icon} className="size-4 shrink-0 opacity-60" />
            <span className="flex-1 truncate">{n.title}</span>
            <button
              type="button"
              aria-label={`Show ${n.title}`}
              title="Show again"
              onClick={() => void attempt(() => updateNode(n.id, { hidden: false }))}
              className="hover:bg-shell-2 grid size-7 place-items-center rounded-md hover:text-white"
            >
              <Eye className="size-3.5" />
            </button>
          </div>
        ))}
    </div>
  );
}

function GroupLabel({
  children,
  collapsed,
  action,
}: {
  children: string;
  collapsed: boolean;
  action?: React.ReactNode;
}) {
  if (collapsed) return <div className="border-shell-2 mx-3 my-2 border-t" />;
  return (
    <div className="flex items-center px-2.5 pt-4 pb-1">
      <span className="text-shell-muted flex-1 text-xs font-semibold">{children}</span>
      {action}
    </div>
  );
}

/** One group of screens. The day's group goes unlabelled at the top; a foldable group remembers if it is open. */
function Group({
  group,
  collapsed,
  hideLabel,
  inboxCount,
}: {
  group: NavGroup;
  collapsed: boolean;
  hideLabel?: boolean;
  inboxCount: number;
}) {
  const key = `group:${group.label}`;
  const open = useUIStore((s) => !group.foldable || s.expandedSections.includes(key));
  const toggle = useUIStore((s) => s.toggleSection);
  const items = groupItems(group.keys);
  const { pathname } = useLocation();
  // A folded group still shows the screen you are on, so the current place is never hidden.
  const shown = collapsed || open ? items : items.filter((i) => pathname.startsWith(i.path));
  return (
    <div>
      {hideLabel ? (
        <div className="h-1" />
      ) : group.foldable && !collapsed ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle(key)}
          className="text-shell-muted flex w-full items-center gap-1 px-2.5 pt-4 pb-1 text-xs font-semibold hover:text-white"
        >
          {group.label}
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
      ) : (
        <GroupLabel collapsed={collapsed}>{group.label}</GroupLabel>
      )}
      {shown.map((i) => (
        <Item
          key={i.key}
          item={i}
          collapsed={collapsed}
          badge={i.key === 'inbox' ? inboxCount : i.key === 'focus' ? <FocusBadge /> : undefined}
        />
      ))}
    </div>
  );
}

/** Screens from later milestones, folded away so the sidebar shows only what works today. */
function ComingSoon({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  if (collapsed || !comingSoon().length) return null;
  return (
    <div className="pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-shell-muted flex h-8 w-full items-center gap-1 px-2.5 text-xs font-medium hover:text-white"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        Coming soon
      </button>
      {open && (
        <div className="space-y-0.5 opacity-70">
          {comingSoon().map((i) => (
            <Item key={i.key} item={i} collapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const userCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const width = useUIStore((s) => s.sidebarWidth);
  const setWidth = useUIStore((s) => s.setSidebarWidth);
  const openComposer = useUIStore((s) => s.setComposerOpen);
  const openPalette = useUIStore((s) => s.setPaletteOpen);
  const tasks = useAllTasks();
  const openNodeDialog = useUIStore((s) => s.setNodeDialog);
  const tree = useNodeTree();
  const inboxCount = (tasks ?? []).filter(
    (t) =>
      !t.parentTaskId &&
      !t.projectId &&
      !isClosed(t.status) &&
      (!t.nodeId || (tree && !tree.byId.has(t.nodeId))),
  ).length;
  // Tablets get an icon rail; desktops follow the user's choice.
  const collapsed = !isWide || userCollapsed;

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'bg-shell text-shell-fg [&_:focus-visible]:outline-shell-fg sticky top-0 hidden h-dvh shrink-0 flex-col md:flex',
        collapsed && 'w-16',
      )}
      style={collapsed ? undefined : { width }}
    >
      {!collapsed && (
        // Drag (or arrow keys) to resize; double-click resets.
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={width}
          aria-valuemin={200}
          aria-valuemax={420}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = width;
            const move = (ev: PointerEvent) => setWidth(startW + ev.clientX - startX);
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onDoubleClick={() => setWidth(256)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setWidth(width - 16);
            if (e.key === 'ArrowRight') setWidth(width + 16);
          }}
          className="hover:bg-shell-2 focus-visible:bg-shell-2 absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
        />
      )}
      <div className={cn('flex h-14 items-center gap-2 px-3', collapsed && 'justify-center')}>
        <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
        {!collapsed && <span className="flex-1 truncate font-bold text-white">Personal OS</span>}
        {isWide && !collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="text-shell-muted hover:bg-shell-2 grid size-8 place-items-center rounded-md hover:text-white"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <div className={cn('flex gap-2 px-3 pb-2', collapsed && 'flex-col items-center')}>
        <button
          type="button"
          onClick={() => openComposer(true)}
          title="New task (N)"
          aria-label="New task"
          aria-keyshortcuts="N"
          className={cn(
            'bg-shell-fg text-shell flex h-9 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors hover:bg-white',
            collapsed ? 'size-9' : 'flex-1 pr-2 pl-3',
          )}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">New task</span>
              <kbd className="rounded border border-current/25 px-1.5 font-sans text-[11px] opacity-60">
                N
              </kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => openPalette(true)}
          title="Search (Ctrl+K)"
          aria-label="Search"
          aria-keyshortcuts="Control+K"
          className="border-shell-2 text-shell-muted hover:bg-shell-2 grid size-9 place-items-center rounded-md border hover:text-white"
        >
          <Search className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.filter((g) => g.beforeSections).map((g, gi) => (
          <Group key={g.label} group={g} collapsed={collapsed} hideLabel={gi === 0} inboxCount={inboxCount} />
        ))}
        <GroupLabel
          collapsed={collapsed}
          action={
            <button
              type="button"
              onClick={() => openNodeDialog({ mode: 'create' })}
              aria-label="New section"
              title="New section"
              className="text-shell-muted hover:bg-shell-2 grid size-6 place-items-center rounded-md hover:text-white"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          Sections
        </GroupLabel>
        {tree?.visibleTree.map((t) => (
          <NodeItem key={t.node.id} t={t} tree={tree} collapsed={collapsed} />
        ))}
        {tree && <HiddenSections tree={tree} collapsed={collapsed} />}
        {NAV_GROUPS.filter((g) => !g.beforeSections).map((g) => (
          <Group key={g.label} group={g} collapsed={collapsed} inboxCount={inboxCount} />
        ))}
        <ComingSoon collapsed={collapsed} />
      </nav>

      <div className="border-shell-2 space-y-0.5 border-t p-3">
        <Item item={SETTINGS_NAV} collapsed={collapsed} />
        <Item item={TRASH_NAV} collapsed={collapsed} />
        {isWide && collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className={cn(itemClass(false, true), 'w-full')}
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}
      </div>
    </aside>
  );
}
