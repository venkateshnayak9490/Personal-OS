import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { attempt, toast } from '@/app/toast';
import { Loading } from '@/components/ui';
import { taskFromShare } from '@/core/domain/share';
import { createTask, deleteTask } from '@/core/repos/tasks';

/** Target of the PWA share_target: saves what was shared to the Inbox, then shows the Inbox. */
export function SharePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const done = useRef(false); // effects run twice in dev; add once
  const input = taskFromShare({
    title: params.get('title'),
    text: params.get('text'),
    url: params.get('url'),
  });

  useEffect(() => {
    if (!input || done.current) return;
    done.current = true;
    void attempt(async () => {
      const task = await createTask(input);
      toast(`Saved “${task.title}” to Inbox`, () => deleteTask(task.id));
    }).finally(() => navigate('/inbox', { replace: true })); // replace: a reload won't add it twice
  });

  return input ? <Loading /> : <Navigate to="/inbox" replace />;
}
