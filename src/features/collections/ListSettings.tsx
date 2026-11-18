import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { attempt } from '@/app/toast';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select } from '@/components/ui';
import { FIELD_TYPES } from '@/core/domain/collections';
import type { Collection, FieldDef } from '@/core/domain/types';
import {
  addField,
  moveField,
  removeField,
  setStatuses,
  updateCollection,
  updateField,
} from '@/core/repos/collections';

const typeLabel = (t: FieldDef['type']) => FIELD_TYPES.find((x) => x.value === t)?.label ?? t;
const splitOptions = (s: string) => s.split(',');

/** Name, statuses (lanes) and fields of a list. */
export function ListSettings({ collection: c, onClose }: { collection: Collection; onClose: () => void }) {
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Fields & statuses"
      description={`Shape “${c.name}” the way you work. Removing a field hides it; values aren’t lost.`}
      variant="side"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-8">
        <Field label="List name" htmlFor="list-name">
          <Input
            id="list-name"
            key={c.name}
            defaultValue={c.name}
            onBlur={(e) =>
              e.target.value.trim() !== c.name &&
              void attempt(() => updateCollection(c.id, { name: e.target.value }))
            }
          />
        </Field>
        <Statuses c={c} />
        <Fields c={c} />
      </div>
    </Sheet>
  );
}

function Statuses({ c }: { c: Collection }) {
  const initial = () => c.statusOptions.map((s) => ({ from: s, name: s, done: c.doneStatuses.includes(s) }));
  const [rows, setRows] = useState<{ from?: string; name: string; done: boolean }[]>(initial);
  const changed = JSON.stringify(rows) !== JSON.stringify(initial());
  const save = () =>
    void attempt(async () => {
      await setStatuses(c.id, rows);
      await updateCollection(c.id, { doneStatuses: rows.filter((r) => r.done).map((r) => r.name.trim()) });
      setRows(rows.map((r) => ({ ...r, from: r.name.trim(), name: r.name.trim() })));
    });
  const edit = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <section aria-labelledby="statuses-h">
      <h3 id="statuses-h" className="mb-1 text-sm font-semibold">
        {c.statusName ? `${c.statusName} options` : 'Statuses'}
      </h3>
      <p className="text-muted mb-3 text-xs">
        The board’s columns, in order. Tick the ones that mean “done”: those items leave the calendar and
        Today.
      </p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Status ${i + 1}`}
              value={r.name}
              onChange={(e) => edit(i, { name: e.target.value })}
            />
            <label className="text-muted flex shrink-0 items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={r.done}
                onChange={(e) => edit(i, { done: e.target.checked })}
                className="accent-[var(--fg)]"
              />
              Done
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove status ${r.name}`}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { name: '', done: false }])}>
          <Plus className="size-4" /> Add status
        </Button>
        {changed && (
          <>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRows(initial())}>
              Undo changes
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Save statuses
            </Button>
          </>
        )}
      </div>
      {changed && c.statusOptions.some((s) => !rows.some((r) => r.from === s)) && (
        <p className="text-muted mt-2 text-xs">Items in a removed status move to the first one.</p>
      )}
    </section>
  );
}

function Fields({ c }: { c: Collection }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldDef['type']>('text');
  const [options, setOptions] = useState('');
  const add = () =>
    void attempt(async () => {
      await addField(c.id, { name, type, options: type === 'select' ? splitOptions(options) : undefined });
      setName('');
      setOptions('');
    });

  return (
    <section aria-labelledby="fields-h">
      <h3 id="fields-h" className="mb-3 text-sm font-semibold">
        Fields
      </h3>
      {c.fields.length === 0 && <p className="text-muted mb-3 text-xs">No fields yet. Add one below.</p>}
      <ul className="divide-line divide-y">
        {c.fields.map((f, i) => (
          <li key={f.key} className="py-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Field name ${f.name}`}
                key={f.name}
                defaultValue={f.name}
                onBlur={(e) =>
                  e.target.value.trim() !== f.name &&
                  void attempt(() => updateField(c.id, f.key, { name: e.target.value, options: f.options }))
                }
              />
              <span className="text-muted w-28 shrink-0 truncate text-xs">{typeLabel(f.type)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${f.name} up`}
                disabled={i === 0}
                onClick={() => void attempt(() => moveField(c.id, f.key, -1))}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${f.name} down`}
                disabled={i === c.fields.length - 1}
                onClick={() => void attempt(() => moveField(c.id, f.key, 1))}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove field ${f.name}`}
                onClick={() => void attempt(() => removeField(c.id, f.key))}
              >
                <X className="size-4" />
              </Button>
            </div>
            {f.type === 'select' && (
              <Input
                aria-label={`Choices for ${f.name}`}
                key={(f.options ?? []).join(',')}
                defaultValue={(f.options ?? []).join(', ')}
                placeholder="Choices, separated by commas"
                className="mt-2"
                onBlur={(e) =>
                  void attempt(() =>
                    updateField(c.id, f.key, { name: f.name, options: splitOptions(e.target.value) }),
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>
      <form
        className="border-line mt-3 space-y-2 rounded-xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex gap-2">
          <Input
            aria-label="New field name"
            placeholder="New field, e.g. Venue"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            aria-label="New field type"
            value={type}
            onChange={(e) => setType(e.target.value as FieldDef['type'])}
            className="w-44 shrink-0"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {type === 'select' && (
          <Input
            aria-label="New field choices"
            placeholder="Choices, separated by commas"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        )}
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          <Plus className="size-4" /> Add field
        </Button>
      </form>
    </section>
  );
}
