import { describe, expect, it } from 'vitest';
import {
  adaptOf,
  clock,
  planDay,
  projectedWake,
  sleepCheck,
  tierOf,
  type DayInput,
  type DayItem,
} from './adapt';

const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const item = (ref: string, start: string, min: number, more: Partial<DayItem> = {}): DayItem => ({
  ref,
  title: ref,
  start: m(start),
  min,
  kind: 'flexible',
  tier: 3,
  ...more,
});
const day = (items: DayItem[], more: Partial<DayInput> = {}): DayInput => ({
  plannedWake: m('07:00'),
  wake: m('07:00'),
  bed: m('23:00'),
  now: m('07:00'),
  items,
  bufferMin: 10,
  thresholdMin: 20,
  ...more,
});
const times = (d: DayInput) => {
  const r = planDay(d);
  return {
    placed: Object.fromEntries(r.placed.map((p) => [p.ref, clock(p.start)])),
    deferred: r.deferred.map((p) => p.ref),
    propose: r.propose,
  };
};

const meeting = item('Group meeting', '10:00', 60, { kind: 'fixed' });
const morning = [
  meeting,
  item('Write intro', '07:30', 60, { tier: 1 }),
  item('Read', '09:20', 30, { tier: 2 }),
  item('Breakfast', '08:30', 30, { anchored: true }),
  item('Email', '15:00', 30),
];

describe('adaptive day: waking', () => {
  it('on time: nothing moves and nothing is proposed', () => {
    const r = planDay(day(morning));
    expect(r.placed.every((p) => p.start === p.plannedStart && p.reason === '')).toBe(true);
    expect(r.propose).toBe(false);
  });

  it('1 h 10 min late: the morning slides around what’s in the way, P1 first; the afternoon keeps its time', () => {
    const r = planDay(day(morning, { wake: m('08:10'), now: m('08:10') }));
    const at = Object.fromEntries(r.placed.map((p) => [p.ref, [clock(p.start), p.reason]]));
    expect(at).toEqual({
      'Write intro': ['08:10', 'You woke at 08:10'],
      Read: ['09:20', ''],
      Breakfast: ['11:10', 'Group meeting is at 10:00'],
      Email: ['15:00', ''],
    });
    expect(r.placed.map((p) => p.ref)).not.toContain('Group meeting'); // fixed never moves
    expect(r.propose).toBe(true);
  });

  it('a few minutes late: below the threshold, so nothing is proposed', () => {
    const t = times(day(morning, { wake: m('07:10'), now: m('07:10') }));
    expect(t.placed.Breakfast).toBe('08:40');
    expect(t.propose).toBe(false);
  });

  it('waking early never pulls things earlier', () => {
    const t = times(day(morning, { wake: m('06:00'), now: m('06:00') }));
    expect(t.placed).toMatchObject({ 'Write intro': '07:30', Breakfast: '08:30', Read: '09:20' });
    expect(t.propose).toBe(false);
  });
});

describe('adaptive day: fitting the day', () => {
  it('too full: optional goes first, and nothing is dropped', () => {
    const items = [
      item('Paper', '20:00', 60, { tier: 1 }),
      item('Revise', '22:00', 45),
      item('Guitar', '21:30', 60, { tier: 4 }),
    ];
    const t = times(day(items, { now: m('21:00') }));
    expect(t.placed).toEqual({ Paper: '21:00', Revise: '22:00' });
    expect(t.deferred).toEqual(['Guitar']);
    expect(t.propose).toBe(true);
  });

  it('done and in-progress items are never touched, and others go around them', () => {
    const r = planDay(
      day([item('Run', '07:00', 60, { kind: 'done' }), item('Stretch', '07:30', 15)], { now: m('07:40') }),
    );
    expect(r.placed.map((p) => [p.ref, clock(p.start)])).toEqual([['Stretch', '08:10']]);
    expect(r.deferred).toEqual([]);
  });

  it('a time you set yourself is kept on a re-plan', () => {
    const items = [item('Gym', '18:00', 60, { tier: 2, manual: m('19:00') }), item('Call home', '19:00', 30)];
    const t = times(day(items, { now: m('12:00') }));
    expect(t.placed).toEqual({ Gym: '19:00', 'Call home': '20:10' });
  });

  it('re-planning twice gives the same answer for the same day (deterministic)', () => {
    const d = day(morning, { wake: m('08:10'), now: m('08:10') });
    expect(planDay(d)).toEqual(planDay(d));
  });

  it('"do after" waits for that item to end', () => {
    const items = [
      item('Draft', '09:00', 90, { tier: 1 }),
      item('Send draft', '09:30', 15, { after: 'Draft' }),
    ];
    expect(times(day(items)).placed['Send draft']).toBe('10:40');
  });

  it("yesterday's unfinished task (planned before today began) lands after now", () => {
    const t = times(day([item('Leftover', '00:00', 30, { tier: 1 })], { now: m('11:05') }));
    expect(t.placed.Leftover).toBe('11:05');
  });

  it('a late bedtime after midnight is part of the same day', () => {
    const t = times(day([item('Wind down', '23:50', 30)], { bed: 24 * 60 + 30, now: m('23:00') }));
    expect(t.placed['Wind down']).toBe('23:50');
    expect(t.deferred).toEqual([]);
  });
});

describe('sleep', () => {
  const standup = [{ title: 'stand-up', start: m('08:00') }];
  it('enough sleep: nothing to say', () => {
    expect(sleepCheck(m('23:00'), standup, 7, 6)).toBeNull();
    expect(sleepCheck(24 * 60 + 30, standup, 7, 6)).toBeNull(); // 00:30 â†’ 7.5 h
  });
  it('a fixed meeting inside the sleep window is named; below the minimum it warns', () => {
    expect(sleepCheck(24 * 60 + 90, standup, 7, 6)).toEqual({
      level: 'note',
      text: 'Your 08:00 stand-up leaves 6.5 h sleep',
    });
    expect(sleepCheck(24 * 60 + 150, standup, 7, 6)?.level).toBe('warn'); // 02:30 â†’ 5.5 h
  });
  it('projected wake: bed + target, never earlier than planned', () => {
    expect(clock(projectedWake(m('23:00'), m('07:00'), 7))).toBe('07:00');
    expect(clock(projectedWake(m('21:00'), m('07:00'), 7))).toBe('07:00'); // early night
    expect(clock(projectedWake(24 * 60 + 60, m('07:00'), 7))).toBe('08:00'); // 1 h past midnight
    expect(clock(projectedWake(24 * 60 + 120, m('07:00'), 7))).toBe('09:00'); // 2 h late
  });
});

describe('settings and tiers', () => {
  it('defaults: Suggest, 20 min threshold, 10 min buffer, durations; saved values win', () => {
    expect(adaptOf()).toMatchObject({ mode: 'suggest', thresholdMin: 20, bufferMin: 10 });
    expect(adaptOf({ adapt: { defaults: { gym: 90 } } }).defaults).toEqual({
      task: 30,
      habit: 30,
      gym: 90,
      meal: 30,
    });
  });
  it('P1, then habits, then P2/P3 and plan items, then optional and P4', () => {
    expect(tierOf({ type: 'task', priority: 1 })).toBe(1);
    expect(tierOf({ type: 'habit' })).toBe(2);
    expect(tierOf({ type: 'task', priority: 3 })).toBe(3);
    expect(tierOf({ type: 'plan' })).toBe(3);
    expect(tierOf({ type: 'task', priority: 4 })).toBe(4);
    expect(tierOf({ type: 'habit', optional: true })).toBe(4);
  });
});
