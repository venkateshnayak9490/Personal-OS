import { X } from 'lucide-react';
import { AlertDialog, Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './ui';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "side": panel from the right on desktop (task editor). "center": dialog. Both are bottom sheets on phones. */
  variant?: 'center' | 'side';
  /** Hide the visible header (the title stays available to screen readers). */
  bare?: boolean;
  /** Override where focus goes on open (e.g. keep the keyboard closed on phones). */
  onOpenAutoFocus?: (e: Event) => void;
  className?: string;
}

/**
 * Responsive modal: bottom sheet on phones (thumb reach), centered dialog or side panel on larger screens.
 * No backdrop blur: it's costly on phones and can render black on some Android GPUs.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = 'center',
  bare,
  onOpenAutoFocus,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content
          onOpenAutoFocus={onOpenAutoFocus}
          className={cn(
            'anim-sheet border-line bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border-t shadow-2xl focus:outline-none',
            variant === 'center' &&
              'sheet-center md:inset-x-auto md:top-[14vh] md:bottom-auto md:left-1/2 md:max-h-[76dvh] md:w-full md:max-w-lg md:-translate-x-1/2 md:rounded-2xl md:border',
            variant === 'side' &&
              'sheet-side md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-full md:max-w-xl md:rounded-none md:border-t-0 md:border-l',
            className,
          )}
        >
          {/* Grab handle: tells phone users this is a sheet they can dismiss. */}
          <div aria-hidden className="flex justify-center pt-2.5 md:hidden">
            <div className="bg-line h-1 w-10 rounded-full" />
          </div>
          {bare ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
            </>
          ) : (
            <div className="flex items-start gap-3 px-5 pt-3 pb-2 md:pt-4">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-[17px] font-semibold md:text-base">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-muted mt-0.5 text-sm">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-2">
                  <X className="size-[18px]" />
                </Button>
              </Dialog.Close>
            </div>
          )}
          <div
            className={cn(
              'flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-5',
              !footer && 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5',
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="border-line flex justify-end gap-2 border-t px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Confirmation for destructive or irreversible actions. */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
}: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/55" />
        <AlertDialog.Content className="anim-pop border-line bg-surface fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl">
          <AlertDialog.Title className="text-[17px] font-semibold md:text-base">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-muted mt-2 text-sm leading-relaxed">{description}</div>
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button>Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
