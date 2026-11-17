import { Inbox, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useUIStore } from './ui-store';

/**
 * Quick Capture shell. M0 only opens the sheet; saving to the Inbox
 * (with natural-language dates, #tags and !priority) arrives in M2.
 */
export function QuickCapture() {
  const open = useUIStore((s) => s.quickCaptureOpen);
  const setOpen = useUIStore((s) => s.setQuickCaptureOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="border-line bg-surface fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:inset-x-auto md:top-[20vh] md:bottom-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:rounded-2xl md:pb-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="bg-surface-2 grid size-9 place-items-center rounded-lg">
              <Inbox className="text-accent size-5" />
            </div>
            <Dialog.Title className="flex-1 font-semibold">Quick Capture</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="text-muted hover:bg-surface-2 hover:text-fg grid size-8 place-items-center rounded-md"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-muted text-sm leading-relaxed">
            Capture any idea, task, link or note in a couple of seconds, without deciding where it belongs.
            Typing{' '}
            <code className="bg-surface-2 text-fg rounded px-1 py-0.5">
              read RT-2 paper fri #research !high
            </code>{' '}
            will create a task due Friday. This arrives in <span className="text-fg font-medium">M2</span>.
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
