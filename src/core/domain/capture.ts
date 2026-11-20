import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import type { Rule, Weekday } from './recurrence';
import { AOE_TZ } from './tasks';
import type { Priority, SectionNode } from './types';

/**
 * Plain-language quick capture, parsed on the device (offline, instant, free):
 *   "submit review fri 5pm #thesis !high @research"
 *   "gym every monday 7am"   "paper deadline nov 30 aoe"
 */

export interface Capture {
  title: string;
  dueDate?: string;
  dueTime?: string;
  /** The words that produced the date, for the preview ("fri 5pm"). */
  dateText?: string;
  timezone?: string;
  priority?: Priority;
  tagNames: string[];
  nodeId?: string;
  nodeTitle?: string;
  repeat?: Rule;
  repeatText?: string;
}

/** Parts of the input the user chose to ignore in the preview. */
export type CapturePart = 'date' | 'priority' | 'tags' | 'section' | 'repeat';

const PRIORITY_WORDS: Record<string, Priority> = {
  '1': 1,
  p1: 1,
  urgent: 1,
  '2': 2,
  p2: 2,
  high: 2,
  '3': 3,
  p3: 3,
  medium: 3,
  med: 3,
  '4': 4,
  p4: 4,
  low: 4,
};

const DAY: Record<string, Weekday> = {
  monday: 'MO',
  mon: 'MO',
  tuesday: 'TU',
  tue: 'TU',
  tues: 'TU',
  wednesday: 'WE',
  wed: 'WE',
  thursday: 'TH',
  thu: 'TH',
  thurs: 'TH',
  friday: 'FR',
  fri: 'FR',
  saturday: 'SA',
  sat: 'SA',
  sunday: 'SU',
  sun: 'SU',
};

const REPEAT_RE =
  /\b(every\s+(?:(\d+)\s+)?(day|days|weekday|weekdays|week|weeks|month|months|year|years|monday|mon|tuesday|tues?|wednesday|wed|thursday|thurs?|friday|fri|saturday|sat|sunday|sun)|daily|weekly|monthly|yearly|annually)\b/i;

function parseRepeat(text: string): { rule: Rule; match: string; firstDay?: Weekday } | null {
  const m = REPEAT_RE.exec(text);
  if (!m) return null;
  const word = (m[3] ?? m[1]!).toLowerCase();
  const n = Math.max(1, Number(m[2]) || 1);
  let rule: Rule;
  let firstDay: Weekday | undefined;
  if (word === 'daily' || word.startsWith('day')) rule = { freq: 'DAILY', interval: n };
  else if (word.startsWith('weekday'))
    rule = { freq: 'WEEKLY', interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] };
  else if (word === 'weekly' || word.startsWith('week')) rule = { freq: 'WEEKLY', interval: n };
  else if (word === 'monthly' || word.startsWith('month')) rule = { freq: 'MONTHLY', interval: n };
  else if (word === 'yearly' || word === 'annually' || word.startsWith('year'))
    rule = { freq: 'YEARLY', interval: n };
  else {
    firstDay = DAY[word];
    rule = { freq: 'WEEKLY', interval: n, byDay: firstDay ? [firstDay] : undefined };
  }
  return { rule, match: m[0], firstDay };
}

const clean = (s: string) =>
  s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/(?:^|\s)(?:due|by|on|at)\s*$/i, '')
    .trim();

function sectionFor(word: string, sections: SectionNode[]): SectionNode | undefined {
  const w = word.toLowerCase().replace(/[-_]/g, '');
  const key = (n: SectionNode) => n.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    sections.find((n) => key(n) === w) ??
    sections.find((n) => key(n).startsWith(w)) ??
    (w.length >= 3 ? sections.find((n) => key(n).includes(w)) : undefined)
  );
}

const VAGUE_PERIOD = /^(?:the|this|that|a|one)\s+(?:week|weekend|month|year|day)$/i;

export function parseCapture(
  input: string,
  now: Date,
  sections: SectionNode[] = [],
  ignore: ReadonlySet<CapturePart> = new Set(),
): Capture {
  let text = ` ${input} `;
  const out: Capture = { title: '', tagNames: [] };

  // #tags
  if (!ignore.has('tags')) {
    text = text.replace(/(\s)#([\p{L}\p{N}_-]+)(?=\s)/gu, (_m, sp: string, tag: string) => {
      out.tagNames.push(tag);
      return sp;
    });
  }
  // !priority
  if (!ignore.has('priority')) {
    text = text.replace(/(\s)!(\w+)(?=\s)/g, (m, sp: string, w: string) => {
      const p = PRIORITY_WORDS[w.toLowerCase()];
      if (!p || out.priority) return m;
      out.priority = p;
      return sp;
    });
  }
  // @section
  if (!ignore.has('section')) {
    text = text.replace(/(\s)@([\p{L}\p{N}_-]+)(?=\s)/gu, (m, sp: string, w: string) => {
      const node = out.nodeId ? undefined : sectionFor(w, sections);
      if (!node) return m;
      out.nodeId = node.id;
      out.nodeTitle = node.title;
      return sp;
    });
  }
  // AoE deadlines
  text = text.replace(/(\s)aoe(?=\s)/i, (_m, sp: string) => {
    out.timezone = AOE_TZ;
    return sp;
  });
  // every monday / daily / every 2 weeks
  let repeatDay: Weekday | undefined;
  if (!ignore.has('repeat')) {
    const r = parseRepeat(text);
    if (r) {
      out.repeat = r.rule;
      out.repeatText = r.match.trim();
      repeatDay = r.firstDay;
      text = text.replace(r.match, ' ');
    }
  }
  // dates and times
  if (!ignore.has('date')) {
    // A vague period ("for the week", "this month") is part of the title, not a due date. Of the
    // remaining date phrases, the last one wins: people type the date at the end ("… tomorrow").
    const res = chrono
      .parse(text, now, { forwardDate: true })
      .filter((r) => !VAGUE_PERIOD.test(r.text.trim()))
      .at(-1);
    if (res) {
      let d = res.start.date();
      // "every monday 7am": a time without a day belongs to the repeat's first day.
      if (repeatDay && !res.start.isCertain('day') && !res.start.isCertain('weekday')) {
        const [day] = chrono.parse(Object.entries(DAY).find(([, v]) => v === repeatDay)![0], now, {
          forwardDate: true,
        });
        if (day) {
          const base = day.start.date();
          d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), d.getHours(), d.getMinutes());
        }
      }
      out.dueDate = format(d, 'yyyy-MM-dd');
      if (res.start.isCertain('hour')) out.dueTime = format(d, 'HH:mm');
      out.dateText = res.text;
      text = text.slice(0, res.index) + ' ' + text.slice(res.index + res.text.length);
    } else if (repeatDay) {
      // "every monday" with no date: start on the next Monday.
      const [next] = chrono.parse(Object.entries(DAY).find(([, v]) => v === repeatDay)![0], now, {
        forwardDate: true,
      });
      if (next) out.dueDate = format(next.start.date(), 'yyyy-MM-dd');
    }
  }
  if (out.repeat && !out.dueDate) out.dueDate = format(now, 'yyyy-MM-dd');
  if (out.timezone && !out.dueDate) out.timezone = undefined;

  out.title = clean(text) || input.trim();
  return out;
}
