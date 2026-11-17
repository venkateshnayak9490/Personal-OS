import { describe, expect, it } from 'vitest';
import { parseCapture } from './capture';
import { describeRule, nextDate, parseRRule, formatRRule } from './recurrence';
import { AOE_TZ } from './tasks';
import type { SectionNode } from './types';

const now = new Date('2026-11-18T10:00:00'); // a Wednesday
const node = (id: string, title: string) => ({ id, title }) as SectionNode;
const sections = [node('r', 'Research'), node('c', 'Coursework'), node('p', 'Physical AI')];

describe('quick capture parsing', () => {
  it('reads dates, times, tags, priority and section', () => {
    const c = parseCapture('submit review fri 5pm #thesis !high @research', now, sections);
    expect(c).toMatchObject({
      title: 'submit review',
      dueDate: '2026-11-20',
      dueTime: '17:00',
      priority: 2,
      tagNames: ['thesis'],
      nodeId: 'r',
    });
  });

  it('leaves ordinary text alone', () => {
    const c = parseCapture('Read 3 papers on RT-2', now, sections);
    expect(c).toMatchObject({ title: 'Read 3 papers on RT-2', tagNames: [] });
    expect(c.dueDate).toBeUndefined();
  });

  it('drops "due"/"by" left before a date', () => {
    expect(parseCapture('SMAI assignment due tomorrow', now).title).toBe('SMAI assignment');
  });

  it('understands AoE deadlines', () => {
    expect(parseCapture('CoRL paper deadline nov 30 aoe', now)).toMatchObject({
      title: 'CoRL paper deadline',
      dueDate: '2026-11-30',
      timezone: AOE_TZ,
    });
  });

  it('understands repeats', () => {
    const c = parseCapture('gym every monday 7am', now);
    expect(c.title).toBe('gym');
    expect(c.repeat).toEqual({ freq: 'WEEKLY', interval: 1, byDay: ['MO'] });
    expect(c.dueDate).toBe('2026-11-23');
    expect(c.dueTime).toBe('07:00');
    expect(parseCapture('stand-up daily', now).repeat?.freq).toBe('DAILY');
  });

  it('can ignore parts the user wants as plain text', () => {
    const c = parseCapture('Meet Friday team', now, [], new Set(['date']));
    expect(c.title).toBe('Meet Friday team');
    expect(c.dueDate).toBeUndefined();
  });

  it('matches sections by prefix and ignores unknown @words', () => {
    expect(parseCapture('lab report @course', now, sections).nodeId).toBe('c');
    expect(parseCapture('email @someone', now, sections)).toMatchObject({ title: 'email @someone' });
  });
});

describe('repeat rules', () => {
  it('round-trips and describes', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TH,MO');
    expect(formatRRule(r)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH');
    expect(describeRule(r)).toBe('Every 2 weeks on Mon, Thu');
    expect(describeRule(parseRRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'))).toBe('Every weekday');
  });

  it('finds the next date', () => {
    expect(nextDate({ freq: 'DAILY', interval: 1 }, '2026-11-18')).toBe('2026-11-19');
    expect(
      nextDate({ freq: 'WEEKLY', interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] }, '2026-11-20'),
    ).toBe('2026-11-23'); // Fri → Mon
    expect(nextDate({ freq: 'WEEKLY', interval: 1, byDay: ['MO', 'TH'] }, '2026-11-23')).toBe('2026-11-26');
    expect(nextDate({ freq: 'WEEKLY', interval: 2, byDay: ['MO'] }, '2026-11-23')).toBe('2026-12-07');
    expect(nextDate({ freq: 'MONTHLY', interval: 1 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextDate({ freq: 'YEARLY', interval: 1 }, '2026-11-18')).toBe('2027-11-18');
  });
});
