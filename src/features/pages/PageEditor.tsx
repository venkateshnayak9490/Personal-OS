import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { attempt } from '@/app/toast';
import { db } from '@/core/db';
import { savePage } from '@/core/repos/pages';
import { cn } from '@/lib/cn';

interface BlockType {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
  run: (e: Editor) => void;
}

/** The "/" menu. Markdown shortcuts also work while typing: "# ", "## ", "- ", "1. ", "[] ", "> ", "---". */
const BLOCKS: BlockType[] = [
  {
    key: 'text',
    label: 'Text',
    hint: 'Plain paragraph',
    icon: Type,
    keywords: 'text paragraph p',
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    key: 'h1',
    label: 'Heading 1',
    hint: '#',
    icon: Heading1,
    keywords: 'heading h1 title big',
    run: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    key: 'h2',
    label: 'Heading 2',
    hint: '##',
    icon: Heading2,
    keywords: 'heading h2 subtitle',
    run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    label: 'Heading 3',
    hint: '###',
    icon: Heading3,
    keywords: 'heading h3 small',
    run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    key: 'bullet',
    label: 'Bulleted list',
    hint: '-',
    icon: List,
    keywords: 'bullet list ul unordered',
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'number',
    label: 'Numbered list',
    hint: '1.',
    icon: ListOrdered,
    keywords: 'numbered ordered list ol',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'check',
    label: 'Checklist',
    hint: '[]',
    icon: CheckSquare,
    keywords: 'checklist todo task checkbox',
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    key: 'quote',
    label: 'Quote',
    hint: '>',
    icon: Quote,
    keywords: 'quote blockquote',
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: 'divider',
    label: 'Divider',
    hint: '---',
    icon: Minus,
    keywords: 'divider line hr separator',
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    key: 'code',
    label: 'Code',
    hint: '```',
    icon: Code,
    keywords: 'code snippet pre',
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

interface SlashState {
  from: number;
  to: number;
  query: string;
  top: number;
  left: number;
  index: number;
}

function matchesFor(query: string) {
  const q = query.trim().toLowerCase();
  return q ? BLOCKS.filter((b) => b.label.toLowerCase().includes(q) || b.keywords.includes(q)) : BLOCKS;
}

/** Find "/query" right before the cursor. */
function readSlash(editor: Editor): Omit<SlashState, 'index'> | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if ($from.parent.type.name === 'codeBlock') return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const m = /(?:^|\s)\/([a-zA-Z0-9]{0,20})$/.exec(before);
  if (!m) return null;
  const from = $from.pos - m[1]!.length - 1;
  const coords = editor.view.coordsAtPos(from);
  return { from, to: $from.pos, query: m[1]!, top: coords.bottom + 6, left: coords.left };
}

const SAVE_DELAY_MS = 400;

/** Notion-style rich text: "/" menu, markdown shortcuts, saves shortly after you stop typing. */
export function RichEditor({
  initial,
  placeholder,
  onSave,
  label = 'Page',
}: {
  initial: unknown;
  placeholder: string;
  onSave: (doc: unknown, text: string) => Promise<unknown>;
  label?: string;
}) {
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const slashRef = useRef<SlashState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const updateSlash = (next: SlashState | null) => {
    slashRef.current = next;
    setSlash(next);
  };

  const apply = (editor: Editor, s: SlashState, block: BlockType) => {
    editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    block.run(editor);
    updateSlash(null);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ editor: e }) => (e.isEmpty ? placeholder : 'Type “/” for headings, lists and more'),
        showOnlyCurrent: true,
      }),
    ],
    content: (initial as object | undefined) ?? '',
    immediatelyRender: true,
    editorProps: {
      attributes: { class: 'pos-doc-body', 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        const s = slashRef.current;
        if (!s || !editorRef.current) return false;
        const items = matchesFor(s.query);
        if (event.key === 'ArrowDown') {
          updateSlash({ ...s, index: (s.index + 1) % Math.max(items.length, 1) });
          return true;
        }
        if (event.key === 'ArrowUp') {
          updateSlash({ ...s, index: (s.index - 1 + items.length) % Math.max(items.length, 1) });
          return true;
        }
        if (event.key === 'Enter' && items[s.index]) {
          apply(editorRef.current, s, items[s.index]!);
          return true;
        }
        if (event.key === 'Escape') {
          updateSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const found = readSlash(e);
      updateSlash(
        found
          ? { ...found, index: slashRef.current?.query === found.query ? slashRef.current.index : 0 }
          : null,
      );
      // Debounced save: the page is saved shortly after you stop typing.
      setSaved('saving');
      pending.current = () =>
        void attempt(() => save.current(e.getJSON(), e.getText())).then(() => setSaved('saved'));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pending.current?.();
        pending.current = null;
      }, SAVE_DELAY_MS);
    },
    onSelectionUpdate: ({ editor: e }) => {
      if (slashRef.current && !readSlash(e)) updateSlash(null);
    },
    onBlur: () => {
      // Save right away when you click elsewhere.
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
      pending.current = null;
    },
  });
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Flush unsaved typing when leaving the page, switching apps or closing the window.
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
      pending.current = null;
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const items = slash ? matchesFor(slash.query) : [];

  return (
    <div className="pos-doc relative">
      <EditorContent editor={editor} />
      <p aria-live="polite" className="text-muted absolute -top-6 right-0 text-xs">
        {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}
      </p>
      {slash && items.length > 0 && (
        <div
          role="listbox"
          aria-label="Insert block"
          className="anim-pop border-line bg-surface fixed z-[70] w-64 overflow-hidden rounded-xl border p-1 shadow-2xl"
          style={{ top: slash.top, left: slash.left }}
        >
          {items.map((b, i) => {
            const Icon = b.icon;
            return (
              <button
                key={b.key}
                type="button"
                role="option"
                aria-selected={i === slash.index}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep the editor focused
                  apply(editor, slash, b);
                }}
                onMouseEnter={() => updateSlash({ ...slash, index: i })}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm',
                  i === slash.index && 'bg-surface-2',
                )}
              >
                <span className="border-line grid size-6 place-items-center rounded-md border">
                  <Icon className="size-3.5" />
                </span>
                <span className="flex-1">{b.label}</span>
                <span className="text-muted font-mono text-[11px]">{b.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A section's Notion-style page. Loads once, then saves as you type. */
export default function PageEditor({ nodeId, placeholder }: { nodeId: string; placeholder: string }) {
  const page = useLiveQuery(async () => ({ nodeId, page: (await db.pages.get(nodeId)) ?? null }), [nodeId]);
  if (!page || page.nodeId !== nodeId) return <div className="min-h-10" />;
  const initial = page.page && !page.page.deletedAt ? page.page.doc : undefined;
  return (
    <RichEditor
      key={nodeId}
      initial={initial}
      placeholder={placeholder}
      onSave={(doc, text) => savePage(nodeId, doc, text)}
    />
  );
}
