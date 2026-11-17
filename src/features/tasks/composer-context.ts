import { useEffect } from 'react';
import { useUIStore, type ComposerContext } from '@/app/ui-store';

/** While this page is on screen, the ＋ / New task sheet files new tasks here by default. */
export function useComposerContext(ctx: ComposerContext) {
  const { nodeId, due } = ctx;
  useEffect(() => {
    const set = useUIStore.getState().setComposerContext;
    set({ nodeId, due });
    return () => set({});
  }, [nodeId, due]);
}
