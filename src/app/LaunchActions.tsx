import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { useUIStore } from '@/app/ui-store';
import { logHealthEvent, undoHealthEvent } from '@/core/repos/life';
import { useNodeTree } from '@/features/structure/use-tree';

/**
 * App-icon shortcuts (long press the icon; manifest `shortcuts`) open "/?do=task|wake|workout|search";
 * a notification about a task opens "/?do=open&task=<id>".
 * Each runs once, then the address goes back to plain Today (or the Gym page for a workout).
 */
export function LaunchActions() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tree = useNodeTree();
  const action = params.get('do');
  // Once per launch (React may run an effect twice in development).
  const ran = useRef(false);

  useEffect(() => {
    if (!action) {
      ran.current = false;
      return;
    }
    if (ran.current || (action === 'workout' && !tree)) return;
    ran.current = true;
    const ui = useUIStore.getState();
    if (action === 'task') ui.setComposerOpen(true);
    if (action === 'search') ui.setPaletteOpen(true);
    // From a notification: open that task.
    if (action === 'open' && params.get('task')) ui.setEditingTaskId(params.get('task'));
    if (action === 'wake')
      // Idempotent, so a repeated launch can't log twice.
      void attempt(async () => {
        const r = await logHealthEvent('wake');
        if (r.logged) toast(`Woke up at ${r.stamp.time}`, () => undoHealthEvent(r.date, 'wake', r.stamp.at));
        else toast('Wake-up is already logged for today');
      });
    const gym =
      action === 'workout' ? tree?.nodes.find((n) => n.moduleKey === 'fitness' && !n.deletedAt) : undefined;
    if (gym) navigate(nodePath(gym.id), { replace: true });
    else setParams({}, { replace: true });
  }, [action, tree, navigate, setParams, params]);

  return null;
}
