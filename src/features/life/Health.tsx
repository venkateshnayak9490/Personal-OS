import { addDays, format, parseISO, subDays } from 'date-fns';
import {
  Bed,
  CalendarPlus,
  Droplets,
  Minus,
  Plus,
  Settings2,
  Stethoscope,
  Sun,
  Utensils,
} from 'lucide-react';
import { useState } from 'react';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Input, ProgressBar, Textarea } from '@/components/ui';
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
  wakeTiming,
  type HealthPlan,
  type Meal,
  type Timing,
} from '@/core/domain/health';
import { toLocalDate } from '@/core/domain/tasks';
import type { CalendarEvent, Checkin, HealthStamp } from '@/core/domain/types';
import { createEvent, updateEvent } from '@/core/repos/events';
import { addWater, correctHealthTime, logHealthEvent } from '@/core/repos/life';
import { updateProfileSettings } from '@/core/repos/profile';
import { cn } from '@/lib/cn';
import { CheckinHistory } from './Checkin';

/** After a correction, the time you actually tapped stays visible. */
function Tapped({ stamp }: { stamp?: HealthStamp }) {
  if (!stamp?.corrected) return null;
  return <span className="text-muted text-xs tabular-nums">tapped {stamp.time}</span>;
}
const TIMING: Record<Timing, { label: string; cls: string }> = {
  on_time: { label: 'on time', cls: 'text-sec-self' },
  late: { label: 'late', cls: 'text-sec-misc' },
  early: { label: 'early', cls: 'text-sec-work' },
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
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <Icon className="text-muted size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium md:text-sm">{label}</div>
        <div className="text-muted text-xs tabular-nums">Plan {planned}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
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
  const time = (k: 'wake' | Meal | 'bed', label: string) => (
    <Field label={label} htmlFor={`plan-${k}`}>
      <Input
        id={`plan-${k}`}
        type="time"
        value={p[k]}
        onChange={(e) => e.target.value && set(k, e.target.value)}
      />
    </Field>
  );
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
      description="Reminders come at these times. Times you log are checked against them."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              void attempt(async () => {
                await updateProfileSettings({ healthPlan: p });
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
            value={p.waterTarget}
            onChange={(e) => set('waterTarget', Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
        <Field label="Water reminder every (hours)" htmlFor="plan-every">
          <Input
            id="plan-every"
            type="number"
            min={1}
            max={6}
            value={p.waterEveryH}
            onChange={(e) => set('waterEveryH', Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>
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
            <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
  const mine = events.filter((e) => e.kind === 'appointment' && !e.deletedAt);
  const upcoming = mine.filter((e) => e.end >= now).sort((a, b) => a.start - b.start);
  const past = mine
    .filter((e) => e.end < now)
    .sort((a, b) => b.start - a.start)
    .slice(0, 5);
  return (
    <section aria-labelledby="appointments-heading">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="appointments-heading" className="flex-1 text-[15px] font-semibold md:text-sm">
          Appointments
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <CalendarPlus className="size-4" /> New appointment
        </Button>
      </div>
      {upcoming.length === 0 && past.length === 0 ? (
        <p className="text-muted text-sm">
          Doctor’s visits, check-ups, tests. You get a reminder a day before and 2 hours before.
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-2xl border">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <Stethoscope className="text-sec-self mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium md:text-sm">{e.title}</div>
                <div className="text-muted text-xs">
                  {format(e.start, 'EEE d MMM, h:mm a')}
                  {e.location ? ` · ${e.location}` : ''}
                  {e.description ? ` · ${e.description}` : ''}
                </div>
              </div>
            </li>
          ))}
          {past.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="text-muted text-sm">
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
      )}
      {adding && <AppointmentSheet onClose={() => setAdding(false)} />}
    </section>
  );
}

/** Fourteen days of one item: on time, late, or not logged. */
function Dots({ days, of }: { days: string[]; of: (d: string) => Timing | undefined }) {
  return (
    <span className="flex gap-1">
      {days.map((d) => {
        const t = of(d);
        return (
          <span
            key={d}
            title={`${format(parseISO(d), 'EEE d MMM')}: ${t ? TIMING[t].label : 'not logged'}`}
            className={cn(
              'size-2.5 rounded-full',
              t === 'on_time' ? 'bg-sec-self' : t ? 'bg-sec-misc' : 'bg-surface-2',
            )}
          />
        );
      })}
    </span>
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
  if (!checkins || !events || !profile) return null;
  const saved = planOf(profile.settings);
  const plan = saved ?? DEFAULT_PLAN;
  const c = checkins.find((x) => x.date === today);
  const next = checkins.find((x) => x.date === tomorrow);
  const water = c?.waterGlasses ?? 0;
  const days = eachDay(from, today);
  const byDate = new Map<string, Checkin>(checkins.map((x) => [x.date, x]));
  const stats = onTimeStats(
    plan,
    checkins.filter((x) => x.date <= today),
  );
  const pctOf = (s: { logged: number; onTime: number }) =>
    s.logged ? `${Math.round((s.onTime / s.logged) * 100)}% on time` : 'not logged yet';

  return (
    <section aria-label="Health" className="mb-10 space-y-8">
      {!saved && (
        <div className="border-line rounded-3xl border p-5">
          <h2 className="font-display text-xl font-semibold">Set your daily plan</h2>
          <p className="text-muted mt-1 text-sm">
            Meal times, water and bedtime. You get reminded at those times, and the app tracks whether you ate
            and slept on time.
          </p>
          <Button className="mt-4" variant="primary" onClick={() => setEditing(true)}>
            Set my plan
          </Button>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-semibold md:text-sm">Today</h2>
          {saved && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Settings2 className="size-4" /> Edit plan
            </Button>
          )}
        </div>
        <ul aria-label="Today’s plan" className="border-line divide-line divide-y rounded-2xl border">
          <PlanRow icon={Sun} label="Woke up" planned={plan.wake}>
            {c?.wakeTime ? (
              // Recorded: correct it if you woke earlier (clear it to undo).
              <>
                <Status timing={wakeTiming(plan.wake, c.wakeTime)} />
                <Tapped stamp={c.stamps?.wake} />
                <TimeEdit
                  label="Woke up at"
                  value={c.wakeTime}
                  onChange={(v) => void attempt(() => correctHealthTime(today, 'wake', v))}
                />
              </>
            ) : (
              <Button size="sm" onClick={() => void attempt(() => logHealthEvent('wake'))}>
                I’m up
              </Button>
            )}
          </PlanRow>
          {MEALS.map((m) => {
            const at = c?.meals?.[m];
            return (
              <PlanRow key={m} icon={Utensils} label={MEAL_LABEL[m]} planned={plan[m]}>
                {at ? (
                  // Logged: correct the time if you ate earlier (clear it to undo).
                  <>
                    <Status timing={mealTiming(plan[m], at)} />
                    <Tapped stamp={c?.stamps?.[m]} />
                    <TimeEdit
                      label={`${MEAL_LABEL[m]} at`}
                      value={at}
                      onChange={(v) => void attempt(() => correctHealthTime(today, m, v))}
                    />
                  </>
                ) : (
                  <Button size="sm" onClick={() => void attempt(() => logHealthEvent(m))}>
                    Ate {MEAL_LABEL[m].toLowerCase()}
                  </Button>
                )}
              </PlanRow>
            );
          })}
          <li className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Droplets className="text-sec-work size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium md:text-sm">Water</div>
                <div className="text-muted text-xs tabular-nums">
                  {water} of {plan.waterTarget} glasses
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="One glass less"
                disabled={!water}
                onClick={() => void attempt(() => addWater(today, -1))}
              >
                <Minus className="size-4" />
              </Button>
              <Button
                size="sm"
                aria-label="Had a glass of water"
                onClick={() => void attempt(() => addWater(today))}
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
          <PlanRow icon={Bed} label="Tonight" planned={plan.bed}>
            {next?.bedTime ? (
              <Status at={next.bedTime} timing={bedTiming(plan.bed, next.bedTime)} />
            ) : (
              <Button size="sm" onClick={() => void attempt(() => logHealthEvent('bed'))}>
                Going to bed
              </Button>
            )}
          </PlanRow>
          <PlanRow icon={Bed} label="Bed last night" planned={plan.bed}>
            {c?.bedTime && <Status timing={bedTiming(plan.bed, c.bedTime)} />}
            <TimeEdit
              label="Went to bed at"
              value={c?.bedTime}
              onChange={(v) => void attempt(() => correctHealthTime(today, 'bed', v))}
            />
            {c?.sleepH !== undefined && (
              <span className="text-sm font-medium tabular-nums">{c.sleepH} h</span>
            )}
          </PlanRow>
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold md:text-sm">Last 14 days</h2>
        <ul className="space-y-2 text-sm">
          {[
            ...MEALS.map((m) => ({
              key: m,
              label: MEAL_LABEL[m],
              s: stats[m],
              of: (d: string) => {
                const t = byDate.get(d)?.meals?.[m];
                return t ? mealTiming(plan[m], t) : undefined;
              },
            })),
            {
              key: 'bed',
              label: 'Bedtime',
              s: stats.bed,
              of: (d: string) => {
                const t = byDate.get(d)?.bedTime;
                return t ? bedTiming(plan.bed, t) : undefined;
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
              className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-1 md:grid-cols-[6rem_auto_1fr]"
            >
              <span className="font-medium">{row.label}</span>
              <Dots days={days} of={row.of} />
              <span className="text-muted col-start-2 text-xs md:col-start-auto">{pctOf(row.s)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Appointments events={events} now={now} />

      <CheckinHistory />

      {editing && <PlanSheet plan={plan} onClose={() => setEditing(false)} />}
    </section>
  );
}
