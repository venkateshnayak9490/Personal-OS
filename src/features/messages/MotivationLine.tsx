import { X } from 'lucide-react';
import { useState } from 'react';
import { BUILT_IN_MESSAGES } from '@/content/messages';
import { useMessages, useMeta } from '@/core/hooks';

export const MESSAGES_OFF_KEY = 'messages.off';

/**
 * One quiet line under a page title (build.md §12): picked once per visit, dismissible, never a pop-up.
 * `keys`: built-in groups to draw from, most specific first. `nodeIds`: sections whose own lines apply.
 */
export function MotivationLine({ keys, nodeIds = [] }: { keys: string[]; nodeIds?: string[] }) {
  const own = useMessages();
  const off = useMeta<boolean>(MESSAGES_OFF_KEY);
  const [seed] = useState(() => Math.random());
  const [dismissed, setDismissed] = useState(false);
  if (!own || off || dismissed) return null;

  const builtIn = BUILT_IN_MESSAGES[keys.find((k) => BUILT_IN_MESSAGES[k]) ?? ''] ?? [];
  const mine = own
    .filter((m) => m.enabled && (m.contexts.length === 0 || m.contexts.some((c) => nodeIds.includes(c))))
    .map((m) => m.text);
  const pool = [...builtIn, ...mine];
  if (!pool.length) return null;
  const text = pool[Math.floor(seed * pool.length)];

  return (
    <p className="text-muted group mt-2 flex items-start gap-1 text-[15px] md:text-sm">
      <span>{text}</span>
      <button
        type="button"
        aria-label="Hide this message"
        onClick={() => setDismissed(true)}
        className="hover:text-fg relative -my-0.5 rounded p-0.5 opacity-60 group-hover:opacity-100 before:absolute before:-inset-3 focus:opacity-100 md:before:hidden"
      >
        <X className="size-3.5" />
      </button>
    </p>
  );
}
