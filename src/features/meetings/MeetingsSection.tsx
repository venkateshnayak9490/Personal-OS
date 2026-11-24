import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { attempt } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Badge, BlockHeader, Button } from '@/components/ui';
import { useAllTasks, useMeetings } from '@/core/hooks';
import { actionItems } from '@/core/domain/meetings';
import { isClosed } from '@/core/domain/tasks';
import { createMeeting } from '@/core/repos/meetings';

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
    <section aria-labelledby="meetings-heading" className="mb-10">
      <BlockHeader
        id="meetings-heading"
        title="Meetings"
        action={
          // On a meetings section this is the page's main action; elsewhere it stays quiet.
          <Button
            size="sm"
            variant={isMeetingsSection ? 'primary' : 'ghost'}
            className={isMeetingsSection ? undefined : '-mr-2'}
            onClick={create}
          >
            <Plus className="size-4" /> New meeting
          </Button>
        }
      />
      {mine.length === 0 ? (
        <p className="text-muted py-2 text-[15px] md:text-sm">
          Keep notes and action items per meeting. Open items carry over to the next one. You can also open
          notes from a meeting on your calendar.
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {(all ? mine : mine.slice(0, SHOWN)).map((m) => {
            const open = actionItems(m.id, tasks).filter((t) => !isClosed(t.status)).length;
            return (
              <li key={m.id}>
                <Link
                  to={meetingPath(m.id)}
                  className="hover:bg-surface-2 flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5"
                >
                  <span className="text-meta text-muted w-32 shrink-0 tabular-nums max-md:order-2 max-md:w-auto">
                    {format(m.start, 'EEE d MMM, HH:mm')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium max-md:basis-full md:text-sm">
                    {m.title}
                  </span>
                  {m.start > now && (
                    <Badge className="max-md:order-3" tone="info">
                      Upcoming
                    </Badge>
                  )}
                  {open > 0 && <span className="text-meta text-muted max-md:order-4">{open} open</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {mine.length > SHOWN && (
        <Button size="sm" variant="ghost" className="mt-1 -ml-2.5" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${mine.length}`}
        </Button>
      )}
    </section>
  );
}
