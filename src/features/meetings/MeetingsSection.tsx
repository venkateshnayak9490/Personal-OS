import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Button } from '@/components/ui';
import { useAllTasks, useMeetings } from '@/core/hooks';
import { actionItems } from '@/core/domain/meetings';
import { isClosed } from '@/core/domain/tasks';
import { createMeeting } from '@/core/repos/meetings';
import { cn } from '@/lib/cn';

export const meetingPath = (id: string) => `/meetings/${id}`;

const SHOWN = 6;

/** A section's meetings, newest first. Shown on meeting sections, or any section that has meetings. */
export function MeetingsSection({
  nodeId,
  isMeetingsSection,
}: {
  nodeId: string;
  isMeetingsSection: boolean;
}) {
  const meetings = useMeetings();
  const tasks = useAllTasks();
  const now = useNow();
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  if (!meetings || !tasks) return null;
  const mine = meetings.filter((m) => m.nodeId === nodeId);
  if (!mine.length && !isMeetingsSection) return null;

  const create = () =>
    void attempt(async () => {
      const d = new Date(now);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
      // Most meetings repeat; reuse the last title ("Meeting with Prof. KS Rajan").
      const m = await createMeeting({ title: mine[0]?.title ?? 'Meeting', start, nodeId });
      navigate(meetingPath(m.id));
    });

  return (
    <section aria-labelledby="meetings-heading" className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 id="meetings-heading" className="title-block flex-1">
          Meetings
        </h2>
        <Button size="sm" variant="ghost" onClick={create}>
          <Plus className="size-4" /> New meeting
        </Button>
      </div>
      {mine.length === 0 ? (
        <p className="text-muted text-sm">
          Keep notes and action items per meeting. Open items carry over to the next one. You can also open
          notes from a meeting on your calendar.
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {(all ? mine : mine.slice(0, SHOWN)).map((m) => {
            const open = actionItems(m.id, tasks).filter((t) => !isClosed(t.status)).length;
            return (
              <li key={m.id}>
                <Link
                  to={meetingPath(m.id)}
                  className={cn(
                    'hover:bg-surface-2/60 flex items-center gap-4 px-4 py-3',
                    m.start > now && 'bg-surface-2/30',
                  )}
                >
                  <span className="text-muted w-32 shrink-0 text-sm tabular-nums">
                    {format(m.start, 'EEE d MMM, HH:mm')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</span>
                  {open > 0 && <span className="text-muted text-xs">{open} open</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > SHOWN && (
        <Button size="sm" variant="ghost" className="text-muted mt-2" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${mine.length}`}
        </Button>
      )}
    </section>
  );
}
