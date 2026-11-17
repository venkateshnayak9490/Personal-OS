import { ChevronRight, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import type { SectionNode } from '@/core/domain/types';
import { updateNode } from '@/core/repos/nodes';
import { attempt, toast } from './toast';
import { NavLink, useLocation } from 'react-router';
import type { TreeNode } from '@/core/domain/tree';
import { useNodeTree, type NodeTree } from '@/features/structure/use-tree';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';
import { useState } from 'react';
import { comingSoon, isBuilt, nodePath, PRIMARY_NAV, SETTINGS_NAV, TRASH_NAV, type NavItem } from './nav';
import { useUIStore } from './ui-store';
import { useMediaQuery } from './use-media-query';

function itemClass(active: boolean, collapsed: boolean) {
  return cn(
    'flex min-h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
    collapsed && 'justify-center px-0',
    active ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
  );
}

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
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
      {!collapsed && <span className="truncate">{item.title}</span>}
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
        <NodeIcon name={node.icon} className={cn('size-[18px] shrink-0', color.text)} />
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
          <NodeIcon
            name={node.icon}
            className={cn('shrink-0', depth === 0 ? 'size-[18px]' : 'size-4', color.text)}
          />
          <span className={cn('truncate', depth > 0 && 'text-[13px]')}>{node.title}</span>
        </NavLink>
        <button
          type="button"
          onClick={() => hideNode(node)}
          aria-label={`Hide ${node.title}`}
          title="Hide (you can show it again below)"
          className="text-muted hover:bg-surface-2 hover:text-fg hidden size-7 shrink-0 place-items-center rounded-md group-hover/row:grid focus-visible:grid"
        >
          <EyeOff className="size-3.5" />
        </button>
        {children.length > 0 && (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.title}`}
            className="text-muted hover:bg-surface-2 hover:text-fg grid size-7 shrink-0 place-items-center rounded-md"
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
        className="text-muted hover:text-fg flex h-8 w-full items-center gap-1 px-2.5 text-xs font-medium"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        Hidden ({hidden.length})
      </button>
      {open &&
        hidden.map((n) => (
          <div
            key={n.id}
            className="text-muted flex min-h-8 items-center gap-2.5 rounded-lg pr-1 pl-2.5 text-sm"
          >
            <NodeIcon name={n.icon} className="size-4 shrink-0 opacity-60" />
            <span className="flex-1 truncate">{n.title}</span>
            <button
              type="button"
              aria-label={`Show ${n.title}`}
              title="Show again"
              onClick={() => void attempt(() => updateNode(n.id, { hidden: false }))}
              className="hover:bg-surface-2 hover:text-fg grid size-7 place-items-center rounded-md"
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
  if (collapsed) return <div className="border-line mx-3 my-2 border-t" />;
  return (
    <div className="flex items-center px-2.5 pt-4 pb-1">
      <span className="text-muted flex-1 text-xs font-medium">{children}</span>
      {action}
    </div>
  );
}

/** Screens from later milestones, folded away so the sidebar shows only what works today. */
function ComingSoon({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  if (collapsed) return null;
  return (
    <div className="pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-muted hover:text-fg flex h-8 w-full items-center gap-1 px-2.5 text-xs font-medium"
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
  const openComposer = useUIStore((s) => s.setComposerOpen);
  const openNodeDialog = useUIStore((s) => s.setNodeDialog);
  const tree = useNodeTree();
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
        {isWide && !collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="text-muted hover:bg-surface-2 hover:text-fg grid size-8 place-items-center rounded-md"
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
            'bg-accent text-accent-fg flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90',
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
          disabled
          title="Search (arrives in M2)"
          aria-label="Search (arrives in M2)"
          className="border-line text-muted grid size-9 place-items-center rounded-lg border opacity-60"
        >
          <Search className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {PRIMARY_NAV.filter(isBuilt).map((i) => (
          <Item key={i.key} item={i} collapsed={collapsed} />
        ))}
        <GroupLabel
          collapsed={collapsed}
          action={
            <button
              type="button"
              onClick={() => openNodeDialog({ mode: 'create' })}
              aria-label="New section"
              title="New section"
              className="text-muted hover:bg-surface-2 hover:text-fg grid size-6 place-items-center rounded-md"
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
        <ComingSoon collapsed={collapsed} />
      </nav>

      <div className="border-line space-y-0.5 border-t p-3">
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
