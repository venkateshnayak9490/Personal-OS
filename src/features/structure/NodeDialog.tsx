import { Check } from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select, SaveHint } from '@/components/ui';
import { descendantIds, flatten } from '@/core/domain/tree';
import type { SectionNode } from '@/core/domain/types';
import { createNode, moveNodeToParent, updateNode } from '@/core/repos/nodes';
import { purge } from '@/core/repos/write';
import { cn } from '@/lib/cn';
import { ICON_NAMES, iconFor } from '@/lib/icons';
import { COLOR_NAMES, colorFor } from '@/lib/palette';
import { useNodeTree } from './use-tree';

export type NodeDialogState =
  { mode: 'create'; parentId?: string } | { mode: 'edit'; node: SectionNode } | null;

/** Create or edit a section: name, parent, icon, color. */
export function NodeDialog({ state, onClose }: { state: NodeDialogState; onClose: () => void }) {
  if (!state) return null;
  // Remount per target so the form starts from that section's values.
  const key = state.mode === 'edit' ? `edit-${state.node.id}` : `create-${state.parentId ?? 'root'}`;
  return <NodeForm key={key} state={state} onClose={onClose} />;
}

function NodeForm({ state, onClose }: { state: NonNullable<NodeDialogState>; onClose: () => void }) {
  const t = useNodeTree();
  const editing = state.mode === 'edit' ? state.node : undefined;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [parentId, setParentId] = useState<string>(
    (editing ? editing.parentId : state.mode === 'create' ? state.parentId : undefined) ?? '',
  );
  const [icon, setIcon] = useState(editing?.icon ?? 'folder');
  const [color, setColor] = useState<string>(editing ? (editing.color ?? '') : parentId ? '' : 'sky');

  if (!t) return null;

  // A section can't be moved under itself or its own descendants.
  const blocked = editing ? new Set([editing.id, ...descendantIds(t.nodes, editing.id)]) : new Set<string>();
  const parents = flatten(t.tree).filter((x) => !blocked.has(x.node.id));
  const inherited = parentId ? t.colorOf(parentId) : undefined;

  const save = async () => {
    const ok = await attempt(async () => {
      const p = parentId || undefined;
      const c = color || undefined;
      if (editing) {
        await updateNode(editing.id, { title, icon, color: c });
        if ((editing.parentId ?? undefined) !== p) await moveNodeToParent(editing.id, p);
        return true;
      }
      const node = await createNode({ title, parentId: p, icon, color: c });
      toast(`Created “${node.title}”`, () => purge([{ tableName: 'nodes', id: node.id }]));
      return true;
    });
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? 'Edit section' : 'New section'}
      footer={
        <>
          <SaveHint>{!title.trim() && 'Give it a name'}</SaveHint>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={() => void save()}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name" htmlFor="node-title">
          <Input
            id="node-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Robotics Lab"
          />
        </Field>

        <Field label="Inside" htmlFor="node-parent">
          <Select id="node-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Top level (main section) —</option>
            {parents.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(depth * 2)}
                {node.title}
                {node.hidden ? ' (hidden)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {parentId && (
              <button
                type="button"
                onClick={() => setColor('')}
                aria-pressed={color === ''}
                className={cn(
                  'h-8 rounded-md border px-3 text-xs',
                  color === '' ? 'border-accent text-fg' : 'border-line text-muted',
                )}
              >
                Same as parent
                {inherited && (
                  <span className={cn('ml-1.5 inline-block size-2 rounded-full', colorFor(inherited).dot)} />
                )}
              </button>
            )}
            {COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  'grid size-8 place-items-center rounded-sm',
                  colorFor(c).dot,
                  color === c && 'ring-fg ring-offset-surface ring-2 ring-offset-2',
                )}
              >
                {color === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {ICON_NAMES.map((name) => {
              const Icon = iconFor(name);
              const on = icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={on}
                  onClick={() => setIcon(name)}
                  className={cn(
                    'grid aspect-square place-items-center rounded-lg border',
                    on
                      ? cn('border-accent', colorFor(color || inherited).soft)
                      : 'hover:bg-surface-2 border-transparent',
                  )}
                >
                  <Icon
                    className={cn('size-[18px]', on ? colorFor(color || inherited).text : 'text-muted')}
                  />
                </button>
              );
            })}
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
