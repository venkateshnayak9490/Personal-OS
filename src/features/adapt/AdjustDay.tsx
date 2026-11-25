import { addDays, format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { attempt, toast } from '@/app/toast';
import { useNow } from '@/app/use-now';
import { Sheet } from '@/components/Sheet';
import { Button, Input } from '@/components/ui';
import {
  adaptOf,
  clock,
  planDay,
  projectedWake,
  sleepCheck,
  type AdaptSettings,
  type DayItem,
  type PlanResult,
  type SleepNote,
} from '@/core/domain/adapt';
import { adjustedOf, dayItems } from '@/core/domain/day-input';
import { DEFAULT_PLAN, planOf, shownTime, toMin } from '@/core/domain/health';
import { logsByDate, weekProgress } from '@/core/domain/progress';
import { toLocalDate } from '@/core/domain/tasks';
import type { DayPlan, DayPlanItem, LocalDate } from '@/core/domain/types';
import {
  useAllTasks,
  useCheckins,
  useDayPlans,
  useEvents,
  useHabitLogs,
  useHabits,
  useProfile,
} from '@/core/hooks';
import { restorePlanned, saveDayPlan } from '@/core/repos/day-plans';
import { cn } from '@/lib/cn';

interface Proposal {
  date: LocalDate;
  wake: number;
  bed: number;
  basedOn?: number;
  /** "Woke at 08:10", "Re-planned at 11:05", … */
  trigger: string;
  items: DayItem[];
  result: PlanResult;
  note: SleepNote | null;
}

const useProposal = create<{ p: Proposal | null }>(() => ({ p: null }));

/** Today's accepted adjusted starts by ref, kept by the runner, for lists that show times (task rows). */
export const useAdjustedToday = create<{ date: LocalDate; at: Map<string, number> }>(() => ({
  date: '',
  at: new Map(),
}));

/** Day minutes of a bedtime: after midnight counts as late the evening before. */
const bedMin = (hhmm: string) => (toMin(hhmm) < 12 * 60 ? toMin(hhmm) + 1440 : toMin(hhmm));
const plusDay = (d: LocalDate, n: number) => format(addDays(parseISO(d), n), 'yyyy-MM-dd');
/** Changes worth showing: moved items, without times you set yourself earlier. */
const movesOf = (r: PlanResult) =>
  r.placed.filter((x) => x.start !== x.plannedStart && x.reason !== 'Your time');

/**
 * Works out an adjusted day from your live data. Null while loading. `wake` and `now` in that day's
 * minutes; for tomorrow (after Going to bed), now is the projected wake.
 */
function useAdjuster() {
  const profile = useProfile();
  const now = useNow();
  const today = toLocalDate(now, profile?.timezone);
  const tasks = useAllTasks();
  const habits = useHabits();
  const events = useEvents();
  const logs = useHabitLogs(plusDay(today, -7));
  const checkins = useCheckins(plusDay(today, -1));
  const plans = useDayPlans(today);
  if (!profile || !tasks || !habits || !events || !logs || !checkins || !plans) return null;
  const adapt = adaptOf(profile.settings);
  const plan = planOf(profile.settings);
  const p = plan ?? DEFAULT_PLAN;

  const build = (date: LocalDate, wake: number, nowMin: number) => {
    const quiet = new Set<string>();
    for (const h of habits) {
      const byDate = logsByDate(logs, h.id);
      const wp = weekProgress(h, byDate, date, profile.weekStartsOn);
      if (byDate.has(date) || (h.target.type === 'perWeek' && wp.done >= wp.target)) quiet.add(h.id);
    }
    const items = dayItems({
      date,
      tasks,
      habits,
      events,
      quiet,
      plan,
      checkin: checkins.find((c) => c.date === date),
      existing: plans.find((d) => d.date === date),
      adapt,
    });
    const bed = bedMin(p.bed);
    const result = planDay({
      plannedWake: toMin(p.wake),
      wake,
      bed,
      now: nowMin,
      items,
      bufferMin: adapt.bufferMin,
      thresholdMin: adapt.thresholdMin,
    });
    // A meal that no longer fits is just missed today, not something to move to another day.
    const deferred = result.deferred.filter((d) => !d.ref.startsWith('health:'));
    // Worth proposing only if something moves enough from where it is now (accepted times count).
    const current = adjustedOf(plans.find((d) => d.date === date));
    const propose =
      deferred.length > 0 ||
      result.placed.some(
        (x) => Math.abs(x.start - (current.get(x.ref) ?? x.plannedStart)) >= adapt.thresholdMin,
      );
    return { date, wake, bed, items, result: { ...result, deferred, propose } };
  };

  const c = checkins.find((x) => x.date === today);
  const wakeStamp = c?.stamps?.wake;
  return {
    adapt,
    today,
    plans,
    checkins,
    sleep: p,
    /** The rest of today, from when you woke (or planned to) and now. */
    forToday: (trigger: string): Proposal => {
      const wake = wakeStamp ? toMin(shownTime(wakeStamp)) : c?.wakeTime ? toMin(c.wakeTime) : toMin(p.wake);
      const nowMin = Math.round((now - parseISO(today).getTime()) / 60_000);
      return { ...build(today, wake, nowMin), basedOn: wakeStamp?.at, trigger, note: null };
    },
    /** The day after a bedtime: wake projected from target sleep, with a note if sleep runs short. */
    afterBed: (date: LocalDate, bedTime: string, basedOn: number): Proposal => {
      const bedAt = bedMin(bedTime);
      const wake = projectedWake(bedAt, toMin(p.wake), p.sleepTargetH);
      const b = build(date, wake, wake);
      const fixed = b.items.filter((i) => i.kind === 'fixed');
      return {
        ...b,
        basedOn,
        trigger: `Went to bed at ${bedTime}`,
        note: sleepCheck(bedAt, fixed, p.sleepTargetH, p.sleepMinH),
      };
    },
  };
}

/** Save a proposal: picked moves accepted (at your time, if you changed it), the rest rejected. */
async function apply(p: Proposal, picks: Map<string, { on: boolean; at: number }>, existing?: DayPlan) {
  const kept = (existing?.items ?? []).filter((i) => i.source === 'manual' && i.state === 'accepted');
  const moves: DayPlanItem[] = movesOf(p.result).map((m) => {
    const pick = picks.get(m.ref) ?? { on: true, at: m.start };
    return {
      ref: m.ref,
      title: m.title,
      plannedStart: m.plannedStart,
      plannedMin: p.items.find((i) => i.ref === m.ref)?.min ?? 30,
      adjustedStart: pick.at,
      reason: pick.at === m.start ? m.reason : 'Your time',
      source: pick.at === m.start ? 'auto' : 'manual',
      state: pick.on ? 'accepted' : 'rejected',
    };
  });
  const n = moves.filter((m) => m.state === 'accepted').length;
  return saveDayPlan(
    p.date,
    {
      wake: p.wake,
      bed: p.bed,
      basedOn: p.basedOn,
      items: [...kept.filter((k) => !moves.some((m) => m.ref === k.ref)), ...moves],
      deferred: p.result.deferred.map((d) => ({ ref: d.ref, title: d.title })),
    },
    `${p.trigger}: ${n} of ${moves.length} changes accepted`,
  );
}

/** Suggest shows the sheet; Automatic applies with Undo. Nothing to move: a short note at most. */
function offer(p: Proposal, mode: AdaptSettings['mode'], existing?: DayPlan, manual = false) {
  if (!p.result.propose) {
    void saveDayPlan(
      p.date,
      { wake: p.wake, bed: p.bed, basedOn: p.basedOn },
      `${p.trigger}: nothing to move`,
    );
    if (p.note) toast(p.note.text);
    else if (manual) toast('Nothing needs to move.');
    return;
  }
  if (mode === 'suggest') return useProposal.setState({ p });
  void attempt(async () => {
    const before = await apply(p, new Map(), existing);
    toast(
      `${p.note ? `${p.note.text}. ` : ''}Your day was adjusted: ${movesOf(p.result).length} changes.`,
      () =>
        saveDayPlan(
          p.date,
          { items: before?.items ?? [], deferred: before?.deferred ?? [] },
          'Adjustment undone',
        ),
    );
  });
}

/**
 * Adjusts the day when you tap I'm up (the rest of today) or Going to bed (tomorrow). Mounted once;
 * a tap counts only while fresh (30 min), and each one adjusts once (`basedOn`).
 */
export function AdaptRunner() {
  const a = useAdjuster();
  const done = useRef(new Set<number>());
  const now = useNow();
  const todayPlan = a?.plans.find((d) => d.date === a.today);
  useEffect(() => {
    if (a) useAdjustedToday.setState({ date: a.today, at: adjustedOf(todayPlan) });
  }, [a?.today, todayPlan]); // eslint-disable-line react-hooks/exhaustive-deps -- `a` is rebuilt each render
  useEffect(() => {
    if (!a || a.adapt.mode === 'off') return;
    for (const c of a.checkins) {
      const handled = (at: number) =>
        done.current.has(at) ||
        a.plans.some((d) => d.date === c.date && d.basedOn === at) ||
        now - at > 30 * 60_000;
      const wake = c.stamps?.wake;
      if (c.date === a.today && wake && !handled(wake.at)) {
        done.current.add(wake.at);
        offer(
          a.forToday(`Woke at ${shownTime(wake)}`),
          a.adapt.mode,
          a.plans.find((d) => d.date === c.date),
        );
      }
      const bed = c.stamps?.bed;
      // Bedtime is filed on the next morning's check-in (already today after midnight).
      if (c.date >= a.today && !c.stamps?.wake && bed && !handled(bed.at)) {
        done.current.add(bed.at);
        offer(
          a.afterBed(c.date, shownTime(bed), bed.at),
          a.adapt.mode,
          a.plans.find((d) => d.date === c.date),
        );
      }
    }
  }, [a, now]);
  return <AdjustSheet existing={a?.plans} />;
}

/** "Re-plan the rest of today" (Today's schedule). */
export function ReplanButton({ className }: { className?: string }) {
  const a = useAdjuster();
  if (!a || a.adapt.mode === 'off') return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        offer(
          a.forToday(`Re-planned at ${format(Date.now(), 'HH:mm')}`),
          a.adapt.mode,
          a.plans.find((d) => d.date === a.today),
          true,
        )
      }
    >
      Re-plan
    </button>
  );
}

/** "Your day, adjusted": each move as planned → adjusted, with why; pick, change a time, accept. */
function AdjustSheet({ existing }: { existing?: DayPlan[] }) {
  const p = useProposal((s) => s.p);
  const now = useNow();
  const [picks, setPicks] = useState(new Map<string, { on: boolean; at: number }>());
  const [forDate, setForDate] = useState<Proposal | null>(null);
  if (p !== forDate) {
    setForDate(p);
    setPicks(new Map(p ? movesOf(p.result).map((m) => [m.ref, { on: true, at: m.start }]) : []));
  }
  if (!p) return null;
  const moves = movesOf(p.result);
  const close = () => useProposal.setState({ p: null });
  const prior = existing?.find((d) => d.date === p.date);
  const accepted = [...picks.values()].filter((x) => x.on).length;
  const save = (rejectAll: boolean) =>
    void attempt(async () => {
      await apply(
        p,
        rejectAll ? new Map(moves.map((m) => [m.ref, { on: false, at: m.start }])) : picks,
        prior,
      );
      close();
    });
  const today = p.date === toLocalDate(now);
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && close()}
      title={today ? 'Your day, adjusted' : 'Tomorrow, adjusted'}
      description={`${p.trigger}. Planned times stay as they are; accept the changes you want.`}
      footer={
        <>
          <Button onClick={() => save(true)}>Keep my plan</Button>
          <Button variant="primary" disabled={!accepted && !moves.length} onClick={() => save(false)}>
            {accepted === moves.length ? 'Accept all' : `Accept ${accepted}`}
          </Button>
        </>
      }
    >
      {p.note && (
        <p
          role={p.note.level === 'warn' ? 'alert' : undefined}
          className={cn(
            'mb-4 rounded-xl px-3 py-2 text-sm',
            p.note.level === 'warn' ? 'bg-danger/10 text-danger' : 'bg-surface-2/60',
          )}
        >
          {p.note.text}.
        </p>
      )}
      <ul className="border-line divide-line divide-y border-y">
        {moves.map((m) => {
          const pick = picks.get(m.ref) ?? { on: true, at: m.start };
          const set = (v: Partial<typeof pick>) => setPicks(new Map(picks).set(m.ref, { ...pick, ...v }));
          return (
            <li key={m.ref} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                aria-label={`Accept the change to ${m.title}`}
                checked={pick.on}
                onChange={(e) => set({ on: e.target.checked })}
                className="mt-1 accent-[var(--fg)]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium md:text-sm">{m.title}</div>
                <div className="text-meta text-muted">{m.reason}</div>
              </div>
              <span className="text-muted mt-2 text-sm tabular-nums line-through">
                {clock(m.plannedStart)}
              </span>
              <Input
                type="time"
                aria-label={`New time for ${m.title}`}
                value={clock(pick.at)}
                disabled={!pick.on}
                onChange={(e) => e.target.value && set({ at: toMin(e.target.value) })}
                className="w-28"
              />
            </li>
          );
        })}
      </ul>
      {p.result.deferred.length > 0 && (
        <div className="mt-4">
          <div className="text-muted mb-1 text-xs font-medium">
            Doesn’t fit {today ? 'today' : 'tomorrow'}
          </div>
          <p className="text-sm">
            {p.result.deferred.map((d) => d.title).join(', ')}. They stay as planned; move them to another day
            when you like.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** On Today: the day's accepted moves (planned struck through), what didn't fit, Restore, history. */
export function AdjustedSummary() {
  const date = toLocalDate(useNow());
  const plans = useDayPlans(date);
  const dp = plans?.find((d) => d.date === date);
  const moved = (dp?.items ?? [])
    .filter((i) => i.state === 'accepted')
    .sort((a, b) => a.adjustedStart - b.adjustedStart);
  if (!dp || (!moved.length && !dp.deferred?.length)) return null;
  return (
    <div className="border-line mt-3 rounded-2xl border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Adjusted today</span>
        <button
          type="button"
          className="text-muted hover:text-fg ml-auto text-xs font-medium"
          onClick={() =>
            void attempt(async () => {
              const before = await restorePlanned(date);
              toast('Planned times restored.', () =>
                saveDayPlan(
                  date,
                  { items: before?.items ?? [], deferred: before?.deferred ?? [] },
                  'Restore undone',
                ),
              );
            })
          }
        >
          Restore planned times
        </button>
      </div>
      <ul className="mt-1 text-sm">
        {moved.map((i) => (
          <li key={i.ref} className="flex items-baseline gap-2 py-0.5">
            <span className="text-muted w-11 tabular-nums line-through">{clock(i.plannedStart)}</span>
            <span className="w-11 font-semibold tabular-nums">{clock(i.adjustedStart)}</span>
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            <span className="text-meta text-muted hidden truncate md:inline">{i.reason}</span>
          </li>
        ))}
      </ul>
      {dp.deferred && dp.deferred.length > 0 && (
        <p className="text-meta text-muted mt-1">
          Doesn’t fit today: {dp.deferred.map((d) => d.title).join(', ')}
        </p>
      )}
      <details className="mt-1">
        <summary className="text-meta text-muted hover:text-fg cursor-pointer">History</summary>
        <ul className="text-meta text-muted mt-1">
          {[...dp.history].reverse().map((h) => (
            <li key={h.at}>
              {format(h.at, 'HH:mm')} · {h.text}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
