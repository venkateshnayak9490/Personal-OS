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
  push: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: nextId++ }] })),
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
        'bg-surface pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 text-sm shadow-xl',
        t.kind === 'error' ? 'border-danger/40' : 'border-line',
      )}
    >
      {t.kind === 'error' && <CircleAlert className="text-danger size-4 shrink-0" />}
      <span className="flex-1">{t.message}</span>
      {t.undo && (
        <button
          type="button"
          onClick={() => {
            dismiss(t.id);
            void attempt(async () => t.undo!());
          }}
          className="text-accent hover:bg-surface-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"
        >
          <Undo2 className="size-3.5" /> Undo
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(t.id)}
        className="text-muted hover:text-fg rounded-md p-1"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
