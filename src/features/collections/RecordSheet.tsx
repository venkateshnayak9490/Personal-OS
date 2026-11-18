import { Trash } from 'lucide-react';
import { attempt, toast } from '@/app/toast';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select } from '@/components/ui';
import { useProfile } from '@/core/hooks';
import type { Collection, CollectionRecord } from '@/core/domain/types';
import { deleteRecord, setRecordValue, updateRecord } from '@/core/repos/collections';
import { restoreFromTrash } from '@/core/repos/trash';
import { FieldInput } from './FieldInput';

/** Side panel for one item: title, status and every field. Changes save as you go. */
export function RecordSheet({
  collection: c,
  record: r,
  onClose,
}: {
  collection: Collection;
  record: CollectionRecord;
  onClose: () => void;
}) {
  const profile = useProfile();
  const remove = async () => {
    const b = await attempt(() => deleteRecord(r.id));
    if (b) {
      toast(`Moved “${r.title}” to Trash`, () => restoreFromTrash(b));
      onClose();
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={r.title}
      description={c.name}
      variant="side"
      footer={
        <>
          <Button variant="ghost" className="text-danger mr-auto" onClick={() => void remove()}>
            <Trash className="size-4" /> Delete
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor="rec-title">
          <Input
            id="rec-title"
            key={r.title}
            defaultValue={r.title}
            onBlur={(e) =>
              e.target.value.trim() !== r.title &&
              void attempt(() => updateRecord(r.id, { title: e.target.value }))
            }
          />
        </Field>
        <Field label={c.statusName ?? 'Status'} htmlFor="rec-status">
          <Select
            id="rec-status"
            value={r.status}
            onChange={(e) => void attempt(() => updateRecord(r.id, { status: e.target.value }))}
          >
            {c.statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        {c.fields.map((f) => (
          <Field key={f.key} label={f.name} htmlFor={`rec-${f.key}`}>
            <FieldInput
              id={`rec-${f.key}`}
              field={f}
              value={r.custom[f.key]}
              weekStartsOn={profile?.weekStartsOn}
              onChange={(v) => void attempt(() => setRecordValue(r.id, f.key, v))}
            />
          </Field>
        ))}
      </div>
    </Sheet>
  );
}
