import { useEffect } from 'react';
import { useUIStore, type ComposerContext } from '@/app/ui-store';

/**
 * While this page is on screen, the ＋ / New task sheet and Ctrl+K file new tasks here by default.
 * One rule: a task goes where you are (section or project page), anywhere else to the Inbox;
 * it's due today only when added on Today or when you type a date.
 */
export function useComposerContext(ctx: ComposerContext) {
  const { nodeId, projectId, due } = ctx;
  useEffect(() => {
    const set = useUIStore.getState().setComposerContext;
    set({ nodeId, projectId, due });
    return () => set({});
  }, [nodeId, projectId, due]);
}
