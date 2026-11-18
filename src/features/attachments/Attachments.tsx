import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { Button } from '@/components/ui';
import { db } from '@/core/db';
import type { EntityRef } from '@/core/domain/types';
import { addAttachment, deleteAttachment, fileBlob } from '@/core/repos/attachments';
import { restoreFromTrash } from '@/core/repos/trash';
import { cn } from '@/lib/cn';

const size = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;

/** Files on a task, list item or meeting. Pick or drop files; click one to open it. */
export function Attachments({ target, nodeId }: { target: EntityRef; nodeId?: string }) {
  const files = useLiveQuery(
    async () =>
      (await db.attachments.where('targetId').equals(target.id).toArray()).filter(
        (a) => !a.deletedAt && a.targetTable === target.table,
      ),
    [target.id, target.table],
  );
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | null) => {
    for (const f of Array.from(list ?? [])) void attempt(() => addAttachment(target, f, nodeId));
  };
  const open = async (fileId: string, name: string) => {
    const blob = await fileBlob(fileId);
    if (!blob)
      return toast(`“${name}” isn’t on this device. It was added on another device or before a restore.`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    // PDFs and images open in a tab; everything else downloads.
    if (!/^(image\/|application\/pdf|text\/)/.test(blob.type)) a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <section
      aria-label="Attachments"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        add(e.dataTransfer.files);
      }}
      className={cn('rounded-xl', over && 'ring-fg/30 bg-surface-2/50 ring-2')}
    >
      {files && files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void open(a.fileId, a.name)}
                className="hover:bg-surface-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
              >
                <FileText className="text-muted size-4 shrink-0" />
                <span className="truncate">{a.name}</span>
                <span className="text-muted shrink-0 text-xs">{size(a.size)}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${a.name}`}
                onClick={() =>
                  void attempt(async () => {
                    const b = await deleteAttachment(a.id);
                    if (b) toast(`Moved “${a.name}” to Trash`, () => restoreFromTrash(b));
                  })
                }
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label="Attach files"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>
        <Paperclip className="size-4" /> Attach file
      </Button>
      <span className="text-muted ml-2 text-xs">or drop files here · kept on this device, up to 25 MB</span>
    </section>
  );
}
