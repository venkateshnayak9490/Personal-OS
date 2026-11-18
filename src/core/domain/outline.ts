import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { OrderKey, ProjectHeading, Task } from './types';

/**
 * Tasks as a Notion-style outline (a project's, or a section's own): headings and top-level tasks
 * share one order (tasks' `order`, headings' `order`); subtasks hang under their task.
 */
export type OutlineRow =
  | { kind: 'heading'; id: string; heading: ProjectHeading; order: OrderKey; at: number }
  | { kind: 'task'; id: string; task: Task; order: OrderKey; at: number; subtasks: Task[] };

const byOrder = (a: { order: OrderKey; at: number }, b: { order: OrderKey; at: number }) =>
  a.order < b.order ? -1 : a.order > b.order ? 1 : a.at - b.at;

export function outlineOf(headings: ProjectHeading[] | undefined, tasks: Task[]): OutlineRow[] {
  const mine = tasks.filter((t) => !t.deletedAt);
  const rows: OutlineRow[] = [
    ...(headings ?? []).map((h) => ({
      kind: 'heading' as const,
      id: h.id,
      heading: h,
      order: h.order,
      at: h.createdAt,
    })),
    ...mine
      .filter((t) => !t.parentTaskId || !mine.some((p) => p.id === t.parentTaskId))
      .map((t) => ({
        kind: 'task' as const,
        id: t.id,
        task: t,
        order: t.order,
        at: t.createdAt,
        subtasks: mine
          .filter((s) => s.parentTaskId === t.id)
          .sort((a, b) => byOrder({ order: a.order, at: a.createdAt }, { order: b.order, at: b.createdAt })),
      })),
  ];
  return rows.sort(byOrder);
}

/** Rows whose keys are shared or out of order can't take a key "between" them: renumber first. */
export function needsRenumber(rows: { order: OrderKey }[]): boolean {
  return rows.some((r, i) => i > 0 && !(rows[i - 1]!.order < r.order));
}

/** Fresh, evenly spread keys for rows in their current order. */
export const renumber = (n: number): OrderKey[] => generateNKeysBetween(null, null, n);

/** A key that sorts between two (either may be missing: start or end). */
export const keyBetween = (a?: OrderKey, b?: OrderKey): OrderKey => generateKeyBetween(a ?? null, b ?? null);

/** Rows under a heading until the next heading of the same or higher level (for collapsing). */
export function hiddenBy(rows: OutlineRow[], collapsed: Set<string>): Set<string> {
  const hidden = new Set<string>();
  let hideLevel: number | null = null;
  for (const r of rows) {
    if (r.kind === 'heading') {
      if (hideLevel !== null && r.heading.level <= hideLevel) hideLevel = null;
      if (hideLevel !== null) {
        hidden.add(r.id);
        continue;
      }
      if (collapsed.has(r.id)) hideLevel = r.heading.level;
    } else if (hideLevel !== null) hidden.add(r.id);
  }
  return hidden;
}

/** "# Title" → heading, "## Title" → subheading, anything else → a task. */
export function parseLine(
  text: string,
): { kind: 'heading'; level: 1 | 2; title: string } | { kind: 'task'; title: string } {
  const m = /^(#{1,2})\s+(.*)$/.exec(text);
  if (m) return { kind: 'heading', level: m[1]!.length as 1 | 2, title: m[2]!.trim() };
  return { kind: 'task', title: text.replace(/^\[\s?\]\s+/, '').trim() };
}
