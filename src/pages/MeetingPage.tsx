import { format } from 'date-fns';
import { CalendarDays, Ellipsis, Trash } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { nodePath } from '@/app/nav';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Menu } from '@/components/Menu';
import { Confirm } from '@/components/Sheet';
import { Button, EmptyState, Field, Input, Loading, Textarea } from '@/components/ui';
import { useAllTasks, useMeetings, useProfile, useRecords } from '@/core/hooks';
import { actionItems, carryOver } from '@/core/domain/meetings';
import { deleteMeeting, saveMeetingNotes, updateMeeting } from '@/core/repos/meetings';
import { restoreFromTrash } from '@/core/repos/trash';
import { Attachments } from '@/features/attachments/Attachments';
import { ActionItemList, AddActionItem } from '@/features/meetings/ActionItems';
import { SectionSelect } from '@/features/plans/SectionSelect';
import { useNodeTree } from '@/features/structure/use-tree';

// The editor is loaded only when a page with notes opens.
const RichEditor = lazy(() => import('@/features/pages/PageEditor').then((m) => ({ default: m.RichEditor })));

const at = (date: string, time: string) => new Date(`${date}T${time}`).getTime();
const splitNames = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function MeetingPage() {
  const { meetingId = '' } = useParams();
  const meetings = useMeetings();
  const tasks = useAllTasks();
  const profile = useProfile();
  const people = useRecords('people');
  const t = useNodeTree();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!meetings || !tasks || !t) return <Loading />;
  const m = meetings.find((x) => x.id === meetingId);
  if (!m)
    return (
      <EmptyState title="This meeting doesn’t exist">
        It may have been deleted.{' '}
        <Link to="/trash" className="font-medium hover:underline">
          Open Trash
        </Link>
      </EmptyState>
    );

  const section = m.nodeId ? t.byId.get(m.nodeId) : undefined;
  const save = (changes: Parameters<typeof updateMeeting>[1]) =>
    void attempt(() => updateMeeting(m.id, changes));
  const date = format(m.start, 'yyyy-MM-dd');
  const time = format(m.start, 'HH:mm');
  const earlier = carryOver(m, meetings, tasks);
  const items = actionItems(m.id, tasks);

  const remove = async () => {
    const b = await attempt(() => deleteMeeting(m.id));
    if (b) {
      toast(`Moved “${m.title}” to Trash`, () => restoreFromTrash(b));
      navigate(section ? nodePath(section.id) : '/', { replace: true });
    }
  };

  return (
    <>
      {section && (
        <nav aria-label="Breadcrumb" className="text-muted mb-3 text-[13px] md:text-xs">
          <Link to={nodePath(section.id)} className="hover:text-fg">
            {section.title}
          </Link>
        </nav>
      )}
      <header className="mb-6 flex items-start gap-3">
        <input
          aria-label="Meeting title"
          key={m.title}
          defaultValue={m.title}
          onBlur={(e) => e.target.value.trim() !== m.title && save({ title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] outline-none md:text-4xl"
        />
        <Menu
          trigger={
            <Button variant="ghost" size="icon" aria-label="Meeting options">
              <Ellipsis className="size-5" />
            </Button>
          }
          items={[
            { label: 'Delete meeting…', icon: Trash, danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-[auto_auto_1fr]">
        {m.eventId ? (
          <p className="text-muted flex items-center gap-2 text-sm sm:col-span-2">
            <CalendarDays className="size-4" /> {format(m.start, 'EEEE d MMMM, HH:mm')}
            <Link to="/calendar" className="hover:text-fg underline-offset-2 hover:underline">
              (from your calendar)
            </Link>
          </p>
        ) : (
          <>
            <Field label="Date">
              <DatePicker
                value={date}
                weekStartsOn={profile?.weekStartsOn}
                onChange={(v) => v && save({ start: at(v, time) })}
              >
                <DateButton label="Meeting date" value={date} />
              </DatePicker>
            </Field>
            <Field label="Time" htmlFor="mt-time">
              <Input
                id="mt-time"
                type="time"
                value={time}
                onChange={(e) => e.target.value && save({ start: at(date, e.target.value) })}
                className="w-32"
              />
            </Field>
          </>
        )}
        <Field label="With" htmlFor="mt-with">
          <Input
            id="mt-with"
            key={m.attendees.join(',')}
            defaultValue={m.attendees.join(', ')}
            placeholder="Prof. KS Rajan, …"
            list="mt-people"
            onBlur={(e) => {
              const names = splitNames(e.target.value);
              if (names.join(',') !== m.attendees.join(',')) save({ attendees: names });
            }}
          />
        </Field>
        <datalist id="mt-people">
          {people?.map((p) => (
            <option key={p.id} value={p.title} />
          ))}
        </datalist>
        <Field label="Section" htmlFor="mt-node" className="sm:col-span-3 sm:max-w-xs">
          <SectionSelect id="mt-node" value={m.nodeId} onChange={(nodeId) => save({ nodeId })} />
        </Field>
      </div>

      {earlier.length > 0 && (
        <section aria-labelledby="mt-earlier" className="mb-8">
          <h2 id="mt-earlier" className="mb-1 text-sm font-semibold">
            From earlier meetings
          </h2>
          <p className="text-muted mb-2 text-xs">Still open, or flagged to follow up last time.</p>
          <ActionItemList tasks={earlier} meetings={meetings} label="From earlier meetings" />
        </section>
      )}

      <div className="mb-8">
        <Field label="Agenda" htmlFor="mt-agenda-input">
          <Textarea
            id="mt-agenda-input"
            key={m.agenda ?? ''}
            defaultValue={m.agenda ?? ''}
            placeholder="What you want to discuss"
            className="min-h-20"
            onBlur={(e) =>
              e.target.value !== (m.agenda ?? '') && save({ agenda: e.target.value || undefined })
            }
          />
        </Field>
      </div>

      <section aria-labelledby="mt-actions" className="mb-8">
        <h2 id="mt-actions" className="mb-2 text-sm font-semibold">
          Action items
        </h2>
        <div className="mb-2">
          <AddActionItem meeting={m} />
        </div>
        {items.length > 0 && <ActionItemList tasks={items} label="Action items" />}
        <p className="text-muted mt-2 text-xs">
          Action items are tasks: they show up in your task lists and on Today when they’re due. Flag one to
          bring it up at the next meeting.
        </p>
      </section>

      <section aria-labelledby="mt-notes">
        <h2 id="mt-notes" className="mb-2 text-sm font-semibold">
          Notes
        </h2>
        <Suspense fallback={<div className="min-h-10" />}>
          <RichEditor
            key={m.id}
            label="Meeting notes"
            initial={m.doc}
            placeholder="Notes and decisions. Type “/” for headings, lists and checklists."
            onSave={(doc, text) => saveMeetingNotes(m.id, doc, text)}
          />
        </Suspense>
      </section>

      <section aria-labelledby="mt-files" className="mt-8">
        <h2 id="mt-files" className="mb-2 text-sm font-semibold">
          Files
        </h2>
        <Attachments target={{ table: 'meetings', id: m.id }} nodeId={m.nodeId} />
      </section>

      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${m.title}”?`}
        description="The notes move to Trash for 30 days. Its action items stay in your tasks."
        confirmLabel="Move to Trash"
        danger
        onConfirm={remove}
      />
    </>
  );
}
