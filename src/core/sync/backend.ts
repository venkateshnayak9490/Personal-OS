/** What the sync engine needs from a server. Supabase implements it; tests use MemoryBackend. */

export interface ServerRow {
  tbl: string;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  /** Server-assigned, increasing on every write: the pull cursor (never client clocks). */
  seq: number;
}

export type NewRow = Omit<ServerRow, 'seq'>;

export interface SyncBackend {
  fetchByIds(tbl: string, ids: string[]): Promise<ServerRow[]>;
  /** Rows written after `seq`, oldest first. */
  fetchSince(seq: number, limit: number): Promise<ServerRow[]>;
  /** 'exists' if another device created it first. */
  insert(row: NewRow): Promise<'ok' | 'exists'>;
  /** Update only if nobody wrote it since we read it (its seq is unchanged). */
  updateIfSeq(row: NewRow, seq: number): Promise<boolean>;
  /** Append-only history rows; ones already there are skipped. */
  appendLog(rows: NewRow[]): Promise<void>;
  /** Delete every row of this account. */
  deleteAll(): Promise<void>;
}

/** In-memory server for tests (and for trying sync without an account). */
export class MemoryBackend implements SyncBackend {
  rows = new Map<string, ServerRow>();
  private seq = 0;
  private k = (tbl: string, id: string) => `${tbl}:${id}`;
  private write(row: NewRow) {
    const r = { ...structuredClone(row), seq: ++this.seq };
    this.rows.set(this.k(row.tbl, row.id), r);
  }
  async fetchByIds(tbl: string, ids: string[]) {
    return ids.flatMap((id) => {
      const r = this.rows.get(this.k(tbl, id));
      return r ? [structuredClone(r)] : [];
    });
  }
  async fetchSince(seq: number, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.seq > seq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
  async insert(row: NewRow) {
    if (this.rows.has(this.k(row.tbl, row.id))) return 'exists' as const;
    this.write(row);
    return 'ok' as const;
  }
  async updateIfSeq(row: NewRow, seq: number) {
    if (this.rows.get(this.k(row.tbl, row.id))?.seq !== seq) return false;
    this.write(row);
    return true;
  }
  async appendLog(rows: NewRow[]) {
    for (const r of rows) if (!this.rows.has(this.k(r.tbl, r.id))) this.write(r);
  }
  async deleteAll() {
    this.rows.clear();
  }
  /** Test helper: another device writes this row. */
  remoteWrite(row: NewRow) {
    this.write(row);
  }
}
