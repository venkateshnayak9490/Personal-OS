import { addDays, format, parseISO, subDays } from 'date-fns';
import {
  Bed,
  CalendarPlus,
  Droplets,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Stethoscope,
  Sun,
  Utensils,
} from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Sheet } from '@/components/Sheet';
import { DateButton, DatePicker } from '@/components/DatePicker';
import { Card } from '@/components/PageHeader';
import {
  BlockHeader,
  Button,
  Field,
  Input,
  ProgressBar,
  SaveHint,
  StatusMark,
  Textarea,
} from '@/components/ui';
import { useCheckins, useEvents, useProfile } from '@/core/hooks';
import { eachDay } from '@/core/domain/analytics';
import {
  bedTiming,
  DEFAULT_PLAN,
  MEAL_LABEL,
  mealTiming,
  MEALS,
  onTimeStats,
  planOf,
  planTime,
  stampAt,
  windowProblem,
  toMin,
  wakeTiming,
  type HealthPlan,
  type PlanTime,
  type Timing,
} from '@/core/domain/health';
import { toLocalDate } from '@/core/domain/tasks';
import type { CalendarEvent, Checkin, HealthEvent, HealthStamp } from '@/core/domain/types';
import { createEvent, updateEvent } from '@/core/repos/events';
import {
  addWater,
  correctHealthTime,
  logHealthEvent,
  resetHealthEvent,
  resetWater,
  restoreHealthEvent,
  restoreWater,
  undoHealthEvent,
} from '@/core/repos/life';
import { updateProfileSettings } from '@/core/repos/profile';
import { cn } from '@/lib/cn';
import { CheckinHistory } from './Checkin';
import { HealthRemindersToday, HealthRoutines } from './HealthRoutines';

/** After a correction, the time you actually tapped stays visible. */
function Tapped({ stamp }: { stamp?: HealthStamp }) {
  if (!stamp?.corrected) return null;
  return <span className="text-muted text-xs tabular-nums">tapped {stamp.time}</span>;
}
const TIMING: Record<Timing, { label: string; cls: string }> = {
  on_time: { label: 'on time', cls: 'text-success' },
  late: { label: 'late', cls: 'text-warning' },
  early: { label: 'early', cls: 'text-info' },
};

/** "on time" / "late", optionally with the time. */
function Status({ at, timing }: { at?: string; timing: Timing }) {
  return (
    <span className="text-sm tabular-nums">
      {at && `${at} · `}
      <span className={cn('font-medium', TIMING[timing].cls)}>{TIMING[timing].label}</span>
    </span>
  );
}

/** A row of today's plan: what, when planned, and either a one-tap log or when you did it. */
function PlanRow({
  icon: Icon,
  label,
  planned,
  children,
}: {
  icon: typeof Sun;
  label: string;
  planned: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <Icon aria-hidden className="text-muted size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        <div className="text-meta text-muted tabular-nums">Plan {planned}</div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </li>
  );
}

/** A logged time you can set or correct (empty clears it). */
function TimeEdit({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v?: string) => void;
}) {
  return (
    <Input
      type="time"
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-28"
    />
  );
}

function PlanSheet({ plan, onClose }: { plan: HealthPlan; onClose: () => void }) {
  const [p, setP] = useState(plan);
  const set = <K extends keyof HealthPlan>(k: K, v: HealthPlan[K]) => setP({ ...p, [k]: v });
  // Each time is exact, or a window if you give it an end ("between 05:00 and 06:00").
  const time = (k: PlanTime, label: string) => (
    <div className="col-span-2 grid grid-cols-2 gap-3">
      <Field label={label} htmlFor={`plan-${k}`}>
        <Input
          id={`plan-${k}`}
          type="time"
          value={p[k]}
          onChange={(e) => e.target.value && set(k, e.target.value)}
        />
      </Field>
      <Field
        label={`${label}: until (optional)`}
        htmlFor={`plan-${k}-to`}
        hint={windowProblem({ ...p, windows: { [k]: p.windows?.[k] } }) ?? undefined}
      >
        <Input
          id={`plan-${k}-to`}
          type="time"
          aria-invalid={!!windowProblem({ ...p, windows: { [k]: p.windows?.[k] } })}
          value={p.windows?.[k] ?? ''}
          onChange={(e) => set('windows', { ...p.windows, [k]: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
  // Numbers are kept as typed; an empty or out-of-range value is named, never quietly replaced.
  const [waterRaw, setWaterRaw] = useState(String(plan.waterTarget));
  const [everyRaw, setEveryRaw] = useState(String(plan.waterEveryH));
  const inRange = (v: string, max: number) => /^\d+$/.test(v) && +v >= 1 && +v <= max;
  const problem =
    windowProblem(p) ??
    (!inRange(waterRaw, 20)
      ? 'Glasses of water a day: enter a number from 1 to 20'
      : !inRange(everyRaw, 6)
        ? 'Water reminder: enter every 1 to 6 hours'
        : null);
  const remind = (k: keyof HealthPlan['remind'], label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={p.remind[k]}
        onChange={(e) => set('remind', { ...p.remind, [k]: e.target.checked })}
        className="accent-[var(--fg)]"
      />
      {label}
    </label>
  );
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Your daily plan"
      description="Reminders come at these times. Give a time an end to make it a window: anything inside it is on time."
      footer={
        <>
          <SaveHint>{windowProblem(p) ? 'Fix the time marked above' : problem}</SaveHint>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!!problem}
            onClick={() =>
              void attempt(async () => {
                // Keep plan items as they are now (they're edited on their own).
                await updateProfileSettings((cur) => ({
                  healthPlan: { ...p, routines: planOf(cur)?.routines ?? p.routines },
                }));
                onClose();
              })
            }
          >
            Save plan
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {time('wake', 'Wake up')}
        {time('bed', 'Bedtime')}
        {time('breakfast', 'Breakfast')}
        {time('lunch', 'Lunch')}
        {time('dinner', 'Dinner')}
        <Field label="Glasses of water a day" htmlFor="plan-water">
          <Input
            id="plan-water"
            type="number"
            min={1}
            max={20}
            value={waterRaw}
            aria-invalid={!inRange(waterRaw, 20)}
            onChange={(e) => {
              setWaterRaw(e.target.value);
              if (inRange(e.target.value, 20)) set('waterTarget', +e.target.value);
            }}
          />
        </Field>
        <Field label="Water reminder every (hours)" htmlFor="plan-every">
          <Input
            id="plan-every"
            type="number"
            min={1}
            max={6}
            value={everyRaw}
            aria-invalid={!inRange(everyRaw, 6)}
            onChange={(e) => {
              setEveryRaw(e.target.value);
              if (inRange(e.target.value, 6)) set('waterEveryH', +e.target.value);
            }}
          />
        </Field>
      </div>
      <p className="text-muted mt-3 text-xs">
        Things that repeat during the day (water every 2 hours, a walk every hour) go under Reminders through
        the day on the Health page.
      </p>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-muted mb-1 text-xs font-medium">Remind me</legend>
        {remind('meals', 'At meal times')}
        {remind('water', 'To drink water, when I’m behind')}
        {remind('bed', 'At bedtime')}
      </fieldset>
    </Sheet>
  );
}

/** Book a doctor's (or any health) appointment: a calendar event with reminders. */
function AppointmentSheet({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(format(addDays(now, 1), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [place, setPlace] = useState('');
  const [dayBefore, setDayBefore] = useState(true);
  const [twoHours, setTwoHours] = useState(true);
  const save = () =>
    void attempt(async () => {
      const start = new Date(`${date}T${time}`).getTime();
      await createEvent({
        title,
        description: reason.trim() || undefined,
        location: place.trim() || undefined,
        start,
        end: start + 60 * 60_000,
        allDay: false,
        reminderOffsetsMin: [...(dayBefore ? [24 * 60] : []), ...(twoHours ? [120] : [])],
        kind: 'appointment',
      });
      toast('Appointment saved. It’s on your calendar too.');
      onClose();
    });
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="New appointment"
      footer={
        <>
          <SaveHint>{!title.trim() ? 'Say what it is' : (!date || !time) && 'Pick a date and time'}</SaveHint>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim() || !date || !time} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="With" htmlFor="ap-title">
          <Input
            id="ap-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dr. Rao, dentist"
          />
        </Field>
        <Field label="Reason (optional)" htmlFor="ap-reason">
          <Input
            id="ap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Check-up"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="ap-date">
            <DatePicker value={date} onChange={(v) => v && setDate(v)}>
              <DateButton id="ap-date" label="Appointment date" value={date} />
            </DatePicker>
          </Field>
          <Field label="Time" htmlFor="ap-time">
            <Input id="ap-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Where (optional)" htmlFor="ap-place">
          <Input
            id="ap-place"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Clinic, hospital"
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-muted mb-1 text-xs font-medium">Remind me</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dayBefore}
              onChange={(e) => setDayBefore(e.target.checked)}
              className="accent-[var(--fg)]"
            />
            A day before
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={twoHours}
              onChange={(e) => setTwoHours(e.target.checked)}
              className="accent-[var(--fg)]"
            />
            2 hours before
          </label>
        </fieldset>
      </div>
    </Sheet>
  );
}

function Appointments({ events, now }: { events: CalendarEvent[]; now: number }) {
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState(false);
  const mine = events.filter((e) => e.kind === 'appointment' && !e.deletedAt);
  const upcoming = mine.filter((e) => e.end >= now).sort((a, b) => a.start - b.start);
  const past = mine
    .filter((e) => e.end < now)
    .sort((a, b) => b.start - a.start)
    .slice(0, 5);
  return (
    <section aria-labelledby="appointments-heading">
      <BlockHeader
        id="appointments-heading"
        title="Appointments"
        action={
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <CalendarPlus className="size-4" /> New appointment
          </Button>
        }
      />
      {upcoming.length === 0 && past.length === 0 ? (
        <p className="text-muted text-[15px] md:text-sm">
          Doctor’s visits, check-ups, tests. You get a reminder a day before and 2 hours before.
        </p>
      ) : (
        <>
          {upcoming.length === 0 && <p className="text-meta text-muted mb-2">Nothing coming up.</p>}
          <ul className="divide-line divide-y">
            {/* The next two; later ones and past visits (with their notes) sit behind "Show all". */}
            {(more ? upcoming : upcoming.slice(0, 2)).map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <Stethoscope aria-hidden className="text-muted mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium md:text-sm">{e.title}</div>
                  <div className="text-meta text-muted">
                    {format(e.start, 'EEE d MMM, h:mm a')}
                    {e.location ? ` · ${e.location}` : ''}
                    {e.description ? ` · ${e.description}` : ''}
                  </div>
                </div>
              </li>
            ))}
            {more &&
              past.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="text-muted text-[15px] md:text-sm">
                    {e.title} · {format(e.start, 'd MMM yyyy')}
                  </div>
                  <Textarea
                    aria-label={`Notes from ${e.title}`}
                    key={e.description ?? ''}
                    defaultValue={e.description ?? ''}
                    placeholder="What did the doctor say? Medicines, next visit…"
                    onBlur={(ev) =>
                      ev.target.value !== (e.description ?? '') &&
                      void attempt(() => updateEvent(e.id, { description: ev.target.value || undefined }))
                    }
                    className="mt-1 min-h-14"
                  />
                </li>
              ))}
          </ul>
          {(upcoming.length > 2 || past.length > 0) && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-1"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              {more
                ? 'Show fewer'
                : `Show all${upcoming.length > 2 ? ` · ${upcoming.length - 2} more coming up` : ''}${past.length ? ` · ${past.length} past` : ''}`}
            </Button>
          )}
        </>
      )}
      {adding && <AppointmentSheet onClose={() => setAdding(false)} />}
    </section>
  );
}

/** Letters for the timings that aren't on time (on time is the ink tick). */
const OFF_LETTER: Record<Exclude<Timing, 'on_time'>, { letter: string; cls: string }> = {
  late: { letter: 'L', cls: 'text-warning' },
  early: { letter: 'E', cls: 'text-info' },
};

/** Fourteen days of one item, as register marks: ✓ on time, L late, E early, blank not logged. */
function Dots({ days, of }: { days: string[]; of: (d: string) => Timing | undefined }) {
  return (
    <span className="flex flex-wrap gap-0.5">
      {days.map((d) => {
        const t = of(d);
        const label = `${format(parseISO(d), 'EEE d MMM')}: ${t ? TIMING[t].label : 'not logged'}`;
        return (
          <span
            key={d}
            role="img"
            aria-label={label}
            title={label}
            className="border-line grid size-5 place-items-center rounded-sm border text-[12px] leading-none font-bold"
          >
            {t === 'on_time' ? (
              <StatusMark mark="done" className="[&_svg]:size-3.5" />
            ) : t ? (
              <span aria-hidden className={OFF_LETTER[t].cls}>
                {OFF_LETTER[t].letter}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/** Reset a logged item (any time, any day shown). */
function Reset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" aria-label={`Reset ${label}`} onClick={onClick}>
      <RotateCcw className="size-3.5" /> Reset
    </Button>
  );
}

/** The Health section: today's plan, on-time record, appointments, and the check-in history. */
export function HealthSection() {
  const now = useNow();
  const profile = useProfile();
  const today = toLocalDate(now, profile?.timezone);
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
  const from = format(subDays(parseISO(today), 13), 'yyyy-MM-dd');
  const checkins = useCheckins(from);
  const events = useEvents();
  const [editing, setEditing] = useState(false);
  // The day shown (today, or one of the last 14 days to fix or reset what was logged).
  const [picked, setPicked] = useState<string | null>(null);
  if (!checkins || !events || !profile) return null;
  const saved = planOf(profile.settings);
  const plan = saved ?? DEFAULT_PLAN;
  const day = picked && picked >= from && picked < today ? picked : today;
  const isToday = day === today;
  const c = checkins.find((x) => x.date === day);
  const next = checkins.find((x) => x.date === tomorrow);
  const water = c?.waterGlasses ?? 0;
  const days = eachDay(from, today);
  const byDate = new Map<string, Checkin>(checkins.map((x) => [x.date, x]));
  const stats = onTimeStats(
    plan,
    checkins.filter((x) => x.date <= today),
  );
  /** One tap logs the device time now; Undo takes back just that tap (as if never pressed). */
  const tap = (event: HealthEvent, label: string) =>
    void attempt(async () => {
      const r = await logHealthEvent(event);
      if (r.logged) toast(`${label} at ${r.stamp.time}`, () => undoHealthEvent(r.date, event, r.stamp.at));
    });
  /** Reset any time (also days later): as if never logged. Undo puts it back. */
  const reset = (date: string, event: HealthEvent, label: string) =>
    void attempt(async () => {
      const was = await resetHealthEvent(date, event);
      if (was.time) toast(`${label} reset`, () => restoreHealthEvent(date, event, was));
    });
  const pctOf = (s: { logged: number; onTime: number }) =>
    s.logged ? `${Math.round((s.onTime / s.logged) * 100)}% on time` : 'not logged yet';

  return (
    <section aria-label="Health" className="mb-10 space-y-8">
      {/* 1. Today: the plan, and today's reminders through the day */}
      <div>
        <BlockHeader
          title={isToday ? 'Today' : format(parseISO(day), 'EEEE d MMM')}
          action={
            saved && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Settings2 className="size-4" /> Edit plan
              </Button>
            )
          }
        />
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Input
            type="date"
            aria-label="Day"
            min={from}
            max={today}
            value={day}
            onChange={(e) => setPicked(e.target.value || null)}
            className="w-44"
          />
          {!isToday && (
            <p className="text-meta text-muted">
              Fixing an earlier day: set or clear a time, or reset it.{' '}
              <button type="button" className="min-h-11 underline md:min-h-0" onClick={() => setPicked(null)}>
                Back to today
              </button>
            </p>
          )}
        </div>
        {!saved && (
          <Card className="my-3">
            <h3 className="title-block">Set your daily plan</h3>
            <p className="text-muted mt-1 text-[15px] md:text-sm">
              Meal times, water and bedtime. You get reminded at those times, and the app tracks whether you
              ate and slept on time.
            </p>
            <Button className="mt-3" variant="primary" onClick={() => setEditing(true)}>
              Set my plan
            </Button>
          </Card>
        )}
        <ul aria-label="Today’s plan" className="border-line divide-line divide-y border-y">
          <PlanRow icon={Sun} label="Woke up" planned={planTime(plan, 'wake')}>
            {c?.wakeTime ? (
              // Recorded: correct it if you woke earlier (clear it to undo).
              <>
                <Status timing={wakeTiming(plan.wake, c.wakeTime, plan.windows?.wake)} />
                <Tapped stamp={c.stamps?.wake} />
                <TimeEdit
                  label="Woke up at"
                  value={c.wakeTime}
                  onChange={(v) => void attempt(() => correctHealthTime(day, 'wake', v))}
                />
                <Reset label="woke up" onClick={() => reset(day, 'wake', 'Woke up')} />
              </>
            ) : isToday ? (
              <Button size="sm" className="max-md:h-11" onClick={() => tap('wake', 'Woke up')}>
                I’m up
              </Button>
            ) : (
              <TimeEdit
                label="Woke up at"
                value={undefined}
                onChange={(v) => void attempt(() => correctHealthTime(day, 'wake', v))}
              />
            )}
          </PlanRow>
          {MEALS.map((m) => {
            const at = c?.meals?.[m];
            return (
              <PlanRow key={m} icon={Utensils} label={MEAL_LABEL[m]} planned={planTime(plan, m)}>
                {at ? (
                  // Logged: correct the time if you ate earlier (clear it to undo).
                  <>
                    <Status timing={mealTiming(plan[m], at, plan.windows?.[m])} />
                    <Tapped stamp={c?.stamps?.[m]} />
                    <TimeEdit
                      label={`${MEAL_LABEL[m]} at`}
                      value={at}
                      onChange={(v) => void attempt(() => correctHealthTime(day, m, v))}
                    />
                    <Reset label={MEAL_LABEL[m].toLowerCase()} onClick={() => reset(day, m, MEAL_LABEL[m])} />
                  </>
                ) : isToday ? (
                  <Button size="sm" className="max-md:h-11" onClick={() => tap(m, MEAL_LABEL[m])}>
                    Ate {MEAL_LABEL[m].toLowerCase()}
                  </Button>
                ) : (
                  <TimeEdit
                    label={`${MEAL_LABEL[m]} at`}
                    value={undefined}
                    onChange={(v) => void attempt(() => correctHealthTime(day, m, v))}
                  />
                )}
              </PlanRow>
            );
          })}
          <li className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Droplets aria-hidden className="text-muted size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium md:text-sm">Water</div>
                <div className="text-meta text-muted tabular-nums">
                  {water} of {plan.waterTarget} glasses
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="One glass less"
                disabled={!water}
                onClick={() => void attempt(() => addWater(day, -1))}
              >
                <Minus className="size-4" />
              </Button>
              {water > 0 && (
                <Reset
                  label="water"
                  onClick={() =>
                    void attempt(async () => {
                      const was = await resetWater(day);
                      toast('Water reset', () => restoreWater(day, was));
                    })
                  }
                />
              )}
              <Button
                size="sm"
                className="max-md:h-11"
                aria-label="Had a glass of water"
                onClick={() =>
                  void attempt(async () => {
                    await addWater(day);
                    toast('Glass of water logged', () => addWater(day, -1));
                  })
                }
              >
                <Plus className="size-4" /> Glass
              </Button>
            </div>
            <ProgressBar
              pct={Math.min(100, Math.round((water / plan.waterTarget) * 100))}
              label="Water today"
              className="mt-2"
            />
          </li>
          {isToday && (
            <PlanRow icon={Bed} label="Tonight" planned={planTime(plan, 'bed')}>
              {next?.bedTime ? (
                <>
                  <Status at={next.bedTime} timing={bedTiming(plan.bed, next.bedTime, plan.windows?.bed)} />
                  <Reset label="tonight’s bedtime" onClick={() => reset(tomorrow, 'bed', 'Bedtime')} />
                </>
              ) : (
                <Button size="sm" className="max-md:h-11" onClick={() => tap('bed', 'Going to bed')}>
                  Going to bed
                </Button>
              )}
            </PlanRow>
          )}
          <PlanRow icon={Bed} label="Bed last night" planned={planTime(plan, 'bed')}>
            {c?.bedTime && <Status timing={bedTiming(plan.bed, c.bedTime, plan.windows?.bed)} />}
            <TimeEdit
              label="Went to bed at"
              value={c?.bedTime}
              onChange={(v) => void attempt(() => correctHealthTime(day, 'bed', v))}
            />
            {c?.bedTime && <Reset label="bed last night" onClick={() => reset(day, 'bed', 'Bedtime')} />}
            {c?.sleepH !== undefined && (
              <span className="text-sm font-medium tabular-nums">{c.sleepH} h</span>
            )}
          </PlanRow>
        </ul>
        <HealthRemindersToday
          routines={plan.routines ?? []}
          today={today}
          checkin={c}
          nowMin={toMin(stampAt(now, profile.timezone || undefined).time)}
        />
      </div>

      {/* 2. Appointments */}
      <Appointments events={events} now={now} />

      {/* 3. History: the on-time register and the check-ins */}
      <section aria-labelledby="health-history">
        <BlockHeader id="health-history" title="History" />
        <p className="text-meta text-muted mb-3">
          Last 14 days: ✓ on time, L late, E early, empty not logged.
        </p>
        <ul className="divide-line divide-y text-[15px] md:text-sm">
          {[
            ...MEALS.map((m) => ({
              key: m,
              label: MEAL_LABEL[m],
              s: stats[m],
              of: (d: string) => {
                const t = byDate.get(d)?.meals?.[m];
                return t ? mealTiming(plan[m], t, plan.windows?.[m]) : undefined;
              },
            })),
            {
              key: 'bed',
              label: 'Bedtime',
              s: stats.bed,
              of: (d: string) => {
                const t = byDate.get(d)?.bedTime;
                return t ? bedTiming(plan.bed, t, plan.windows?.bed) : undefined;
              },
            },
            {
              key: 'water',
              label: 'Water',
              s: stats.water,
              of: (d: string): Timing | undefined => {
                const w = byDate.get(d)?.waterGlasses;
                if (w === undefined || (d === today && w < plan.waterTarget)) return undefined; // today isn't over
                return w >= plan.waterTarget ? 'on_time' : 'late';
              },
            },
          ].map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 py-2 md:grid-cols-[6rem_auto_1fr]"
            >
              <span className="font-medium">{row.label}</span>
              <Dots days={days} of={row.of} />
              <span className="text-meta text-muted col-start-2 md:col-start-auto">{pctOf(row.s)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <CheckinHistory />
        </div>
      </section>

      {/* 4. Managing reminders through the day, collapsed */}
      <HealthRoutines routines={plan.routines ?? []} today={today} />

      {editing && <PlanSheet plan={plan} onClose={() => setEditing(false)} />}
    </section>
  );
}
