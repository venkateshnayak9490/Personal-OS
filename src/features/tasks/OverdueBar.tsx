import { addDays, format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { attempt, toast } from '@/app/toast';
import { DatePicker } from '@/components/DatePicker';
import { Button } from '@/components/ui';
import { moveTasksTo, restoreDue } from '@/core/repos/tasks';

/**
 * "3 overdue: move them all to today / tomorrow / a date": re-plan everything overdue in one go
 * instead of task by task. Undo puts each back where it was.
 */
export function OverdueBar({
  ids,
  today,
  timezone,
  weekStartsOn,
}: {
  ids: string[];
  today: string;
  timezone?: string;
  weekStartsOn?: 0 | 1;
}) {
  if (!ids.length) return null;
  const n = ids.length;
  const move = (date: string, label: string) =>
    void attempt(async () => {
      const before = await moveTasksTo(ids, date, Date.now(), timezone);
      toast(`Moved ${before.length} overdue ${before.length === 1 ? 'task' : 'tasks'} to ${label}`, () =>
        restoreDue(before),
      );
    });
  const tomorrow = format(addDays(new Date(`${today}T12:00`), 1), 'yyyy-MM-dd');

  return (
    <div
      role="region"
      aria-label="Overdue tasks"
      className="border-danger/60 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-y py-2"
    >
      <CalendarClock className="text-danger size-4 shrink-0" />
      <span className="mr-auto text-sm">
        <span className="font-medium">{n} overdue</span>
        <span className="text-muted"> · move {n === 1 ? 'it' : 'them all'} to</span>
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" onClick={() => move(today, 'today')}>
          Today
        </Button>
        <Button size="sm" variant="ghost" onClick={() => move(tomorrow, 'tomorrow')}>
          Tomorrow
        </Button>
        <DatePicker
          value=""
          weekStartsOn={weekStartsOn}
          onChange={(d) => d && move(d, format(new Date(`${d}T12:00`), 'EEE d MMM'))}
        >
          <Button size="sm" variant="ghost" aria-label="Move overdue tasks to a date">
            Pick a date
          </Button>
        </DatePicker>
      </div>
    </div>
  );
}
