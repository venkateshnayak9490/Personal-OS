import { addDays, format, parseISO } from 'date-fns';
import { Trash } from 'lucide-react';
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
import { createEvent, deleteEvent, updateEvent } from '@/core/repos/events';
import { restoreFromTrash } from '@/core/repos/trash';
import { SectionSelect } from '@/features/plans/SectionSelect';

export type EventDraft =
  { mode: 'create'; start: number; end: number; allDay: boolean } | { mode: 'edit'; event: CalendarEvent };

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

export function EventSheet({ draft, onClose }: { draft: EventDraft; onClose: () => void }) {
  const ev = draft.mode === 'edit' ? draft.event : undefined;
  const src = draft.mode === 'edit' ? draft.event : draft;
  const profile = useProfile();
  const [title, setTitle] = useState(ev?.title ?? '');
  const [allDay, setAllDay] = useState(src.allDay);
  const [date, setDate] = useState(ymd(src.start));
  // All-day ends are exclusive (midnight after the last day), like FullCalendar's.
  const [endDate, setEndDate] = useState(ymd(src.allDay ? addDays(src.end, -1).getTime() : src.end));
  const [startTime, setStartTime] = useState(src.allDay ? '09:00' : hm(src.start));
  const [endTime, setEndTime] = useState(src.allDay ? '10:00' : hm(src.end));
  const [repeat, setRepeat] = useState<RepeatPreset | 'custom'>(
    presetOf(ev?.rrule ? parseRRule(ev.rrule) : null),
  );
  const [reminder, setReminder] = useState(ev ? (ev.reminderOffsetsMin[0] ?? -1) : src.allDay ? -1 : 10);
  const [nodeId, setNodeId] = useState(ev?.nodeId);
  const [location, setLocation] = useState(ev?.location ?? '');
  const [notes, setNotes] = useState(ev?.description ?? '');

  const start = allDay ? at(date, '00:00') : at(date, startTime);
  const end = allDay
    ? at(format(addDays(parseISO(endDate < date ? date : endDate), 1), 'yyyy-MM-dd'), '00:00')
    : at(date, endTime);
  const valid = title.trim() && (allDay || end > start);

  const submit = async () => {
    if (!valid) return;
    const rule =
      repeat === 'custom' ? (ev?.rrule ?? undefined) : formatRule(presetRule(repeat, date)) || undefined;
    const fields = {
      title,
      allDay,
      start,
      end,
      rrule: rule,
      reminderOffsetsMin: reminder < 0 ? [] : [reminder],
      nodeId,
      location: location.trim() || undefined,
      description: notes.trim() || undefined,
    };
    const ok = await attempt(async () => {
      if (ev) await updateEvent(ev.id, fields);
      else await createEvent(fields);
      return true;
    });
    if (ok) onClose();
  };

  const remove = async () => {
    if (!ev) return;
    const b = await attempt(() => deleteEvent(ev.id));
    if (b) {
      toast(`Moved “${ev.title}” to Trash`, () => restoreFromTrash(b));
      onClose();
    }
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
              <Trash className="size-4" /> Delete
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
                    const len = at(date, endTime) - at(date, startTime);
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeat" htmlFor="ev-repeat">
            <Select id="ev-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatPreset)}>
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
