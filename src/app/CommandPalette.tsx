import { useLiveQuery } from 'dexie-react-hooks';
import { CornerDownLeft, FileText, Plus, Search, type LucideIcon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '@/core/db';
import { useAllTasks, useCollections, useJournal, useMeetings, useNotes, useRecords } from '@/core/hooks';
import { noteTitle } from '@/core/repos/notes';
import { parseCapture } from '@/core/domain/capture';
import { isClosed } from '@/core/domain/tasks';
import { listPath } from '@/features/collections/ListsSection';
import { meetingPath } from '@/features/meetings/MeetingsSection';
import { useNodeTree } from '@/features/structure/use-tree';
import { addCapturedTask } from '@/features/tasks/actions';
import { cn } from '@/lib/cn';
import { NodeIcon } from '@/lib/NodeIcon';
import { colorFor } from '@/lib/palette';
import { allNavItems, isBuilt, nodePath, SETTINGS_NAV, TRASH_NAV } from './nav';
import { toast } from './toast';
import { useUIStore } from './ui-store';

interface Item {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon?: LucideIcon;
  nodeIcon?: { name?: string; className: string };
  muted?: boolean;
  run: () => void | Promise<void>;
}

const MAX_PER_GROUP = 8;

function snippet(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 80);
  const start = Math.max(0, i - 30);
  return `${start > 0 ? '…' : ''}${text.slice(start, i + q.length + 50).replace(/\s+/g, ' ')}…`;
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const tasks = useAllTasks();
  const tree = useNodeTree();
  const pages = useLiveQuery(async () => (await db.pages.toArray()).filter((p) => !p.deletedAt), []);
  const lists = useCollections();
  const records = useRecords();
  const meetings = useMeetings();
  const notes = useNotes();
  const journal = useJournal();
  const ctx = useUIStore((s) => s.composerContext);
  const openTask = useUIStore((s) => s.setEditingTaskId);
  const openNodeDialog = useUIStore((s) => s.setNodeDialog);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const q = query.trim().toLowerCase();

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => navigate(path);
    const nav: Item[] = [
      // Every screen that works (also Reviews, Analytics, Notes, Journal, Vault).
      ...allNavItems()
        .filter((n) => isBuilt(n) || n === SETTINGS_NAV || n === TRASH_NAV)
        .map((n) => ({
          id: `nav-${n.key}`,
          group: 'Go to',
          label: n.title,
          icon: n.icon,
          run: go(n.path),
        })),
      {
        id: 'nav-structure',
        group: 'Go to',
        label: 'Edit sections',
        icon: Search,
        run: go('/settings/sections'),
      },
      { id: 'nav-tags', group: 'Go to', label: 'Tags', icon: Search, run: go('/settings/tags') },
      {
        id: 'new-section',
        group: 'Actions',
        label: 'New section',
        icon: Plus,
        run: () => openNodeDialog({ mode: 'create' }),
      },
    ];
    const sections: Item[] = (tree?.nodes ?? []).map((n) => ({
      id: `node-${n.id}`,
      group: 'Sections',
      label: n.title,
      detail: tree!
        .path(n.id)
        .slice(0, -1)
        .map((p) => p.title)
        .join(' / '),
      nodeIcon: { name: n.icon, className: colorFor(tree!.colorOf(n.id)).text },
      muted: n.hidden,
      run: go(nodePath(n.id)),
    }));
    if (!q) return [...nav, ...sections.filter((s) => !s.detail)];

    const has = (s: string | undefined) => !!s && s.toLowerCase().includes(q);
    const matchedTasks: Item[] = (tasks ?? [])
      .filter((t) => has(t.title) || has(t.description))
      .sort((a, b) => Number(isClosed(a.status)) - Number(isClosed(b.status)) || b.updatedAt - a.updatedAt)
      .slice(0, MAX_PER_GROUP)
      .map((t) => ({
        id: `task-${t.id}`,
        group: 'Tasks',
        label: t.title,
        detail: t.nodeId ? tree?.byId.get(t.nodeId)?.title : 'Inbox',
        muted: isClosed(t.status),
        run: () => openTask(t.id),
      }));
    const matchedPages: Item[] = (pages ?? [])
      .filter((p) => has(p.text) && tree?.byId.has(p.nodeId))
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({
        id: `page-${p.id}`,
        group: 'In pages',
        label: tree!.byId.get(p.nodeId)!.title,
        detail: snippet(p.text, q),
        icon: FileText,
        run: go(nodePath(p.nodeId)),
      }));
    // Lists by name, and their items by title or any text value (authors, notes, summary…).
    const listById = new Map((lists ?? []).map((c) => [c.id, c]));
    const matchedLists: Item[] = (lists ?? [])
      .filter((c) => has(c.name))
      .map((c) => ({
        id: `list-${c.id}`,
        group: 'Lists',
        label: c.name,
        icon: FileText,
        run: go(listPath(c.id)),
      }));
    const matchedRecords: Item[] = (records ?? [])
      .filter(
        (r) =>
          listById.has(r.collectionId) &&
          (has(r.title) || Object.values(r.custom).some((v) => typeof v === 'string' && has(v))),
      )
      .slice(0, MAX_PER_GROUP)
      .map((r) => ({
        id: `rec-${r.id}`,
        group: 'In lists',
        label: r.title,
        detail: `${listById.get(r.collectionId)!.name} · ${r.status}`,
        run: go(`${listPath(r.collectionId)}?item=${r.id}`),
      }));
    const matchedMeetings: Item[] = (meetings ?? [])
      .filter((m) => has(m.title) || has(m.text) || has(m.agenda) || m.attendees.some(has))
      .slice(0, MAX_PER_GROUP)
      .map((m) => ({
        id: `meeting-${m.id}`,
        group: 'Meetings',
        label: m.title,
        detail: has(m.text) ? snippet(m.text!, q) : new Date(m.start).toLocaleDateString(),
        icon: FileText,
        run: go(meetingPath(m.id)),
      }));
    const matchedNotes: Item[] = (notes ?? [])
      .filter((n) => has(n.title) || has(n.text))
      .slice(0, MAX_PER_GROUP)
      .map((n) => ({
        id: `note-${n.id}`,
        group: 'Notes',
        label: noteTitle(n),
        detail: has(n.text) ? snippet(n.text, q) : undefined,
        icon: FileText,
        run: go(`/notes/${n.id}`),
      }));
    // Private entries never show up in search.
    const matchedJournal: Item[] = (journal ?? [])
      .filter((e) => !e.isPrivate && has(e.text))
      .slice(0, MAX_PER_GROUP)
      .map((e) => ({
        id: `journal-${e.id}`,
        group: 'Journal',
        label: new Date(`${e.date}T00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }),
        detail: snippet(e.text, q),
        icon: FileText,
        run: go(`/journal?date=${e.date}`),
      }));
    const parsed = parseCapture(query, new Date(), tree?.nodes ?? []);
    const add: Item = {
      id: 'add-task',
      group: 'Actions',
      label: `Add task: ${parsed.title}`,
      detail: [parsed.dueDate, parsed.nodeTitle ?? (ctx.nodeId ? tree?.byId.get(ctx.nodeId)?.title : 'Inbox')]
        .filter(Boolean)
        .join(' · '),
      icon: Plus,
      run: async () => {
        const where =
          parsed.nodeTitle ?? (ctx.nodeId ? tree?.byId.get(ctx.nodeId)?.title : undefined) ?? 'Inbox';
        const t = await addCapturedTask(
          {
            title: parsed.title,
            nodeId: parsed.nodeId ?? ctx.nodeId,
            ...(parsed.priority ? { priority: parsed.priority } : {}),
            ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
            ...(parsed.dueTime ? { dueTime: parsed.dueTime } : {}),
            ...(parsed.timezone ? { timezone: parsed.timezone } : {}),
          },
          parsed.tagNames,
          parsed.repeat,
        );
        if (t) toast(`Added “${t.title}” to ${where}`);
      },
    };
    return [
      ...matchedTasks,
      ...sections.filter((s) => has(s.label)).slice(0, MAX_PER_GROUP),
      ...matchedPages,
      ...matchedLists,
      ...matchedRecords,
      ...matchedMeetings,
      ...matchedNotes,
      ...matchedJournal,
      ...nav.filter((n) => has(n.label)),
      add,
    ];
  }, [
    q,
    query,
    tasks,
    tree,
    pages,
    lists,
    records,
    meetings,
    notes,
    journal,
    ctx,
    navigate,
    openTask,
    openNodeDialog,
  ]);

  const active = Math.min(index, Math.max(items.length - 1, 0));
  const run = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    void item.run();
  };

  let lastGroup = '';
  return (
    <>
      <div className="border-line flex items-center gap-3 border-b px-4">
        <Search className="text-muted size-4 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((active + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((active - 1 + items.length) % items.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(items[active]);
            }
          }}
          placeholder="Search, jump to a section, or type a task to add it"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          className="placeholder:text-muted/80 h-14 flex-1 bg-transparent text-base focus:outline-none"
        />
        <kbd className="border-line text-muted rounded border px-1.5 text-[11px]">Esc</kbd>
      </div>
      <div
        id="palette-list"
        role="listbox"
        aria-label="Results"
        className="max-h-[55dvh] overflow-y-auto p-2"
      >
        {items.map((it, i) => {
          const header = it.group !== lastGroup ? it.group : null;
          lastGroup = it.group;
          const Icon = it.icon;
          return (
            <div key={it.id}>
              {header && <div className="text-muted px-2 pt-2 pb-1 text-xs font-medium">{header}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseMove={() => i !== active && setIndex(i)}
                onClick={() => run(it)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm',
                  i === active && 'bg-surface-2',
                  it.muted && 'text-muted',
                )}
              >
                {it.nodeIcon ? (
                  <NodeIcon
                    name={it.nodeIcon.name}
                    className={cn('size-4 shrink-0', it.nodeIcon.className)}
                  />
                ) : Icon ? (
                  <Icon className="text-muted size-4 shrink-0" />
                ) : (
                  <span className="border-muted/60 size-3.5 shrink-0 rounded-full border-2" />
                )}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.detail && <span className="text-muted max-w-[45%] truncate text-xs">{it.detail}</span>}
                {i === active && <CornerDownLeft className="text-muted size-3.5 shrink-0" />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Ctrl+K / ⌘K: search everything, jump anywhere, or add a task from the same box. */
export function CommandPalette() {
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPaletteOpen);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content className="anim-pop border-line bg-surface fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search tasks, sections and pages, or add a task
          </Dialog.Description>
          {open && <Palette onClose={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
