import { z } from 'zod';
import { db, ENTITY_TABLES } from '@/core/db';
import { pathTo } from '@/core/domain/tree';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/core/domain/tasks';
import type { BaseEntity } from '@/core/domain/types';

/**
 * Full backup / restore (build.md §8.5, §15). The file is plain JSON so it is readable
 * without the app — you never depend on Personal OS to get your data back.
 */

export const BACKUP_FORMAT = 1;
const APP_ID = 'personal-os';
export const LAST_BACKUP_KEY = 'lastBackupAt';

const entityRow = z.looseObject({
  id: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number(),
  deviceId: z.string(),
});
const logRow = z.looseObject({
  id: z.string().min(1),
  ts: z.number(),
  entityTable: z.string(),
  entityId: z.string(),
  action: z.string(),
});

const tablesShape = Object.fromEntries([
  ...ENTITY_TABLES.map((t) => [t, z.array(entityRow).optional()]),
  ['activityLog', z.array(logRow).optional()],
]) as Record<string, z.ZodOptional<z.ZodArray<typeof entityRow | typeof logRow>>>;

const backupSchema = z.object({
  app: z.literal(APP_ID),
  formatVersion: z.number().int(),
  schemaVersion: z.number().int(),
  exportedAt: z.number(),
  appVersion: z.string().optional(),
  tables: z.strictObject(tablesShape),
});

export type BackupFile = z.infer<typeof backupSchema>;

export async function exportAll(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', [...ENTITY_TABLES.map((t) => db.table(t)), db.activityLog], async () => {
    for (const t of ENTITY_TABLES) tables[t] = await db.table(t).toArray();
    tables.activityLog = await db.activityLog.toArray();
  });
  return {
    app: APP_ID,
    formatVersion: BACKUP_FORMAT,
    schemaVersion: db.verno,
    exportedAt: Date.now(),
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
    tables: tables as BackupFile['tables'],
  };
}

/** Parse and validate a backup file. Throws a readable error for anything wrong. */
export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== APP_ID)
    throw new Error('This is not a Personal OS backup file.');
  const res = backupSchema.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0];
    const where = issue?.path.join('.') ?? '';
    if (issue?.code === 'unrecognized_keys')
      throw new Error(`Backup contains unknown data: ${issue.keys.join(', ')}`);
    throw new Error(`Backup file is damaged${where ? ` at ${where}` : ''}.`);
  }
  if (res.data.formatVersion > BACKUP_FORMAT || res.data.schemaVersion > db.verno)
    throw new Error('This backup was made by a newer version of Personal OS. Update the app first.');
  return res.data;
}

export interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * merge   — keep current data; add missing records; for records in both, the newer edit wins.
 * replace — wipe this device's data and load exactly what is in the file.
 */
export async function importBackup(file: BackupFile, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 };
  const all = [...ENTITY_TABLES.map((t) => db.table(t)), db.activityLog, db.outbox];
  await db.transaction('rw', all, async () => {
    if (mode === 'replace') {
      for (const t of all) await t.clear();
    }
    for (const name of ENTITY_TABLES) {
      const rows = (file.tables[name] ?? []) as BaseEntity[];
      const table = db.table<BaseEntity, string>(name);
      for (const row of rows) {
        const existing = mode === 'merge' ? await table.get(row.id) : undefined;
        if (!existing) {
          await table.put(row);
          result.added++;
        } else if (row.updatedAt > existing.updatedAt) {
          await table.put(row);
          result.updated++;
        } else result.unchanged++;
      }
    }
    for (const row of file.tables.activityLog ?? []) {
      if (mode === 'replace' || !(await db.activityLog.get(row.id))) await db.activityLog.put(row as never);
    }
  });
  return result;
}

export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `personal-os-backup-${d}.json`;
}

export function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export everything to a .json file and remember when. */
export async function downloadBackup(): Promise<void> {
  const data = await exportAll();
  download(JSON.stringify(data, null, 2), backupFileName(), 'application/json');
  await db.meta.put({ key: LAST_BACKUP_KEY, value: Date.now() });
}

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Tasks as CSV (opens in Excel / Google Sheets). Deleted tasks are excluded. */
export async function tasksCsv(): Promise<string> {
  const [tasks, nodes, tags] = await Promise.all([db.tasks.toArray(), db.nodes.toArray(), db.tags.toArray()]);
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const header = [
    'Title',
    'Status',
    'Priority',
    'Section',
    'Due date',
    'Due time',
    'Time zone',
    'Tags',
    'Created',
    'Completed',
    'Parent task',
    'Notes',
    'ID',
  ];
  const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : '');
  const rows = tasks
    .filter((t) => !t.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((t) => [
      t.title,
      STATUS_LABEL[t.status],
      PRIORITY_LABEL[t.priority],
      t.nodeId
        ? pathTo(nodes, t.nodeId)
            .map((n) => n.title)
            .join(' / ')
        : '',
      t.dueDate,
      t.dueTime,
      t.timezone,
      t.tags
        .map((id) => tagName.get(id))
        .filter(Boolean)
        .join(' '),
      iso(t.createdAt),
      iso(t.completedAt),
      t.parentTaskId ? titles.get(t.parentTaskId) : '',
      t.description,
      t.id,
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Delete every record on this device (the database itself is recreated on next load). */
export async function eraseDevice(): Promise<void> {
  db.close();
  await db.delete();
}
