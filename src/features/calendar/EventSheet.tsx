import { addDays, format, parseISO } from 'date-fns';
import { NotebookPen, Trash } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useProfile } from '@/core/hooks';
import {
  describeRule,
  formatRRule,
  parseRRule,
  presetOf,
  presetRule,
  repeatOptions,
  type RepeatPreset,
} from '@/core/domain/recurrence';
import type { CalendarEvent } from '@/core/domain/types';
import {
  createEvent,
  deleteEvent,
  editFollowing,
  editOccurrence,
  endSeriesBefore,
  restoreOccurrence,
  setSeriesEnd,
  skipOccurrence,
  updateEvent,
} from '@/core/repos/events';
import { cn } from '@/lib/cn';
import { meetingForOccurrence } from '@/core/repos/meetings';
import { restoreFromTrash } from '@/core/repos/trash';
import { meetingPath } from '@/features/meetings/MeetingsSection';
import { SectionSelect } from '@/features/plans/SectionSelect';

export type EventDraft =
  | {
      mode: 'create';
      start: number;
      end: number;
      allDay: boolean;
      /** Prefilled, e.g. a course's class: its name, its section, every week. */
      title?: string;
      nodeId?: string;
      repeat?: RepeatPreset;
    }
  /** `occurrence`: the start of the clicked occurrence (repeating events), for its meeting notes. */
  | { mode: 'edit'; event: CalendarEvent; occurrence?: number };

const REMINDERS = [
  { value: -1, label: 'No reminder' },
  { value: 0, label: 'At the start' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

const ymd = (ms: number) => format(ms, 'yyyy-MM-dd');
const hm = (ms: number) => format(ms, 'HH:mm');
const at = (date: string, time: string) => new Date(`${date}T${time}`).getTime();

type Scope = 'this' | 'following' | 'all';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'this', label: 'This event' },
  { value: 'following', label: 'This and following' },
  { value: 'all', label: 'All events' },
];

export function EventSheet({ draft, onClose }: { draft: EventDraft; onClose: () => void }) {
  const ev = draft.mode === 'edit' ? draft.event : undefined;
  // A repeating event opened from one of its days: the form shows that day, and changes can go to
  // just it, it and the ones after, or the whole series.
  const occ = ev?.rrule && draft.mode === 'edit' ? (draft.occurrence ?? ev.start) : undefined;
  const src =
    draft.mode === 'edit'
      ? occ !== undefined
        ? { ...draft.event, start: occ, end: occ + (draft.event.end - draft.event.start) }
        : draft.event
      : draft;
  const [scope, setScope] = useState<Scope>('this');
  const profile = useProfile();
  const navigate = useNavigate();
  const preset = draft.mode === 'create' ? draft : undefined;
  const [title, setTitle] = useState(ev?.title ?? preset?.title ?? '');
  const [allDay, setAllDay] = useState(src.allDay);
  const [date, setDate] = useState(ymd(src.start));
  // All-day ends are exclusive (midnight after the last day), like FullCalendar's.
  const [endDate, setEndDate] = useState(ymd(src.allDay ? addDays(src.end, -1).getTime() : src.end));
  const [startTime, setStartTime] = useState(src.allDay ? '09:00' : hm(src.start));
  const [endTime, setEndTime] = useState(src.allDay ? '10:00' : hm(src.end));
  const [repeat, setRepeat] = useState<RepeatPreset | 'custom'>(
    preset?.repeat ?? presetOf(ev?.rrule ? parseRRule(ev.rrule) : null),
  );
  const [reminder, setReminder] = useState(ev ? (ev.reminderOffsetsMin[0] ?? -1) : src.allDay ? -1 : 10);
  const [nodeId, setNodeId] = useState(ev?.nodeId ?? preset?.nodeId);
  const [location, setLocation] = useState(ev?.location ?? '');
  const [notes, setNotes] = useState(ev?.description ?? '');

  const start = allDay ? at(date, '00:00') : at(date, startTime);
  // A timed event ending "earlier" than it starts ends the next day (e.g. 23:00 → 00:30).
  const overnight = !allDay && endTime < startTime;
  const end = allDay
    ? at(format(addDays(parseISO(endDate < date ? date : endDate), 1), 'yyyy-MM-dd'), '00:00')
    : at(overnight ? format(addDays(parseISO(date), 1), 'yyyy-MM-dd') : date, endTime);
  const valid = title.trim() && (allDay || end > start);

  const submit = async () => {
    if (!valid) return;
    // "All events" keeps the series' first day: a moved time or day shifts every occurrence.
    const shift = ev && occ !== undefined && scope === 'all' ? ev.start - occ : 0;
    const ruleDate = shift ? ymd(start + shift) : date;
    const rule =
      occ !== undefined && scope === 'this'
        ? undefined
        : repeat === 'custom'
          ? (ev?.rrule ?? undefined)
          : formatRule(presetRule(repeat, ruleDate)) || undefined;
    const fields = {
      title,
      allDay,
      start: start + shift,
      end: end + shift,
      rrule: rule,
      reminderOffsetsMin: reminder < 0 ? [] : [reminder],
      nodeId,
      location: location.trim() || undefined,
      description: notes.trim() || undefined,
    };
    const ok = await attempt(async () => {
      if (ev && occ !== undefined && scope === 'this') await editOccurrence(ev.id, occ, fields);
      else if (ev && occ !== undefined && scope === 'following') await editFollowing(ev.id, occ, fields);
      else if (ev) await updateEvent(ev.id, fields);
      else await createEvent(fields);
      return true;
    });
    if (ok) onClose();
  };

  const openNotes = async () => {
    if (!ev) return;
    const m = await attempt(() =>
      meetingForOccurrence(ev, draft.mode === 'edit' ? (draft.occurrence ?? ev.start) : ev.start),
    );
    if (m) navigate(meetingPath(m.id));
  };

  const remove = async () => {
    if (!ev) return;
    const day = occ !== undefined ? format(occ, 'EEE d MMM') : '';
    const ok = await attempt(async () => {
      if (occ !== undefined && scope === 'this') {
        await skipOccurrence(ev.id, occ);
        toast(`Deleted “${ev.title}” on ${day}`, () => restoreOccurrence(ev.id, occ));
      } else if (occ !== undefined && scope === 'following' && occ > ev.start) {
        const was = await endSeriesBefore(ev.id, occ);
        toast(`Deleted “${ev.title}” from ${day} on`, () => setSeriesEnd(ev.id, was));
      } else {
        const b = await deleteEvent(ev.id);
        if (b) toast(`Moved “${ev.title}” to Trash`, () => restoreFromTrash(b));
      }
      return true;
    });
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={ev ? 'Edit event' : 'New event'}
      footer={
        <>
          {ev && (
            <Button variant="ghost" className="text-danger mr-auto" onClick={() => void remove()}>
              <Trash className="size-4" />{' '}
              {occ === undefined
                ? 'Delete'
                : scope === 'this'
                  ? 'Delete this one'
                  : scope === 'following'
                    ? 'Delete these'
                    : 'Delete all'}
            </Button>
          )}
          {ev && (
            <Button variant="ghost" onClick={() => void openNotes()}>
              <NotebookPen className="size-4" /> Meeting notes
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => void submit()}>
            {ev ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {occ !== undefined && (
          <div role="radiogroup" aria-label="Change or delete" className="grid grid-cols-3 gap-1.5">
            {SCOPES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={scope === o.value}
                onClick={() => setScope(o.value)}
                className={cn(
                  'min-h-10 rounded-xl border px-2 text-sm',
                  scope === o.value
                    ? 'border-fg bg-surface-2 font-medium'
                    : 'border-line text-muted hover:border-fg/40',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {occ !== undefined && (
          <p className="text-muted -mt-2 text-xs">
            {scope === 'this'
              ? `Only ${format(occ, 'EEEE d MMM')}. The rest of the series stays as it is.`
              : scope === 'following'
                ? `${format(occ, 'EEEE d MMM')} and every one after. Earlier ones stay as they were.`
                : 'Every occurrence, past and future.'}
          </p>
        )}
        <Field label="Event" htmlFor="ev-title">
          <Input
            id="ev-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Meeting with Prof. Rajan, SMAI mid-sem exam"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="accent-[var(--fg)]"
          />
          All day
        </label>
        <div className="grid grid-cols-3 gap-3">
          <Field label={allDay ? 'From' : 'Date'} className="col-span-3 sm:col-span-1">
            <DatePicker
              value={date}
              weekStartsOn={profile?.weekStartsOn}
              onChange={(v) => {
                if (!v) return;
                if (endDate === date) setEndDate(v);
                setDate(v);
              }}
            >
              <DateButton label="Event date" value={date} />
            </DatePicker>
          </Field>
          {allDay ? (
            <Field label="To" className="col-span-3 sm:col-span-1">
              <DatePicker
                value={endDate}
                weekStartsOn={profile?.weekStartsOn}
                onChange={(v) => v && setEndDate(v)}
              >
                <DateButton label="Event end date" value={endDate} />
              </DatePicker>
            </Field>
          ) : (
            <>
              <Field label="Starts" htmlFor="ev-start">
                <Input
                  id="ev-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    // Keep the length when the start moves.
                    const len = end - start;
                    setStartTime(e.target.value);
                    if (e.target.value && len > 0) setEndTime(hm(at(date, e.target.value) + len));
                  }}
                />
              </Field>
              <Field label="Ends" htmlFor="ev-end">
                <Input id="ev-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        {!allDay && end <= start && <p className="text-danger text-xs">The end must be after the start.</p>}
        {overnight && <p className="text-muted text-xs">Ends the next day.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeat" htmlFor="ev-repeat">
            <Select
              id="ev-repeat"
              value={occ !== undefined && scope === 'this' ? 'none' : repeat}
              disabled={occ !== undefined && scope === 'this'}
              onChange={(e) => setRepeat(e.target.value as RepeatPreset)}
            >
              {repeat === 'custom' && ev?.rrule && (
                <option value="custom">{describeRule(parseRRule(ev.rrule))}</option>
              )}
              {repeatOptions(date).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reminder" htmlFor="ev-reminder">
            <Select id="ev-reminder" value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
              {REMINDERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section" htmlFor="ev-node">
            <SectionSelect id="ev-node" value={nodeId} onChange={setNodeId} />
          </Field>
          <Field label="Where" htmlFor="ev-loc">
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room, link…"
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="ev-notes">
          <Textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

const formatRule = (r: ReturnType<typeof presetRule>) => (r ? formatRRule(r) : '');
