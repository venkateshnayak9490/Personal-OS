import { CircleAlert, Undo2, X } from 'lucide-react';
import { useEffect } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/cn';

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
  undo?: () => Promise<unknown> | void;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  // One at a time: a newer message replaces the older, so toasts never stack over the page.
  push: (t) => set({ toasts: [{ ...t, id: nextId++ }] }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a message, optionally with an Undo button. */
export function toast(message: string, undo?: Toast['undo']) {
  useToasts.getState().push({ message, kind: 'info', undo });
}

export function toastError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Something went wrong';
  useToasts.getState().push({ message, kind: 'error' });
}

/** Run an async action and show any error as a toast instead of failing silently. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    toastError(err);
    return undefined;
  }
}

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.undo ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [t, dismiss]);

  return (
    <div
      role="status"
      className={cn(
        // Snackbar: inverted colors so it reads as a passing message, not part of the page.
        'anim-rise pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4 text-[15px] shadow-xl shadow-black/30 md:min-h-11 md:text-sm',
        t.kind === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg',
      )}
    >
      {t.kind === 'error' && <CircleAlert className="size-4 shrink-0" />}
      <span className="flex-1 py-1.5">{t.message}</span>
      {t.undo && (
        <button
          type="button"
          onClick={() => {
            dismiss(t.id);
            void attempt(async () => t.undo!());
          }}
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold hover:bg-current/10 md:h-8 md:text-[13px]"
        >
          <Undo2 className="size-4" /> Undo
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(t.id)}
        className="grid size-10 place-items-center rounded-xl opacity-60 hover:opacity-100 md:size-8"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
