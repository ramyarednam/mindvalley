import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import type { Cue, CutRow, ResolvedSource, Role, Sample, SessionRow, SourceType, TestConfig, TestRow, UserRow, ViewerEvent } from './types.ts';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  config TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS cuts (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  resolved TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  cut_id TEXT NOT NULL REFERENCES cuts(id) ON DELETE CASCADE,
  pid TEXT NOT NULL,
  age_band TEXT, gender TEXT, country TEXT, member TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  calib_passed INTEGER NOT NULL DEFAULT 0,
  calibration TEXT,
  max_pt REAL NOT NULL DEFAULT 0,
  pauses INTEGER NOT NULL DEFAULT 0,
  pause_sec REAL NOT NULL DEFAULT 0,
  checks_total INTEGER NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  survey TEXT,
  synthetic INTEGER NOT NULL DEFAULT 0,
  valid INTEGER,
  exclude_reason TEXT,
  completion_code TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_test ON sessions(test_id, cut_id, valid);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_pid ON sessions(test_id, pid);

-- Per-second aggregate of the 4 Hz samples (PRD SC-2). Raw frames never reach the server.
CREATE TABLE IF NOT EXISTS session_seconds (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sec INTEGER NOT NULL,
  samples INTEGER NOT NULL,
  face INTEGER NOT NULL,
  attentive INTEGER NOT NULL,
  PRIMARY KEY (session_id, sec)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  pt REAL NOT NULL,
  ts INTEGER NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_session ON events(session_id, type);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login INTEGER
);

-- Cached Claude-written summaries, keyed by "<cutId>:<all|real>".
CREATE TABLE IF NOT EXISTS summaries (
  cut_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  responses INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/** Columns added after the first release; added in place so existing databases keep their data. */
const MIGRATIONS: [table: string, column: string, ddl: string][] = [
  ['tests', 'description', "ALTER TABLE tests ADD COLUMN description TEXT NOT NULL DEFAULT ''"],
  ['sessions', 'resume_key', 'ALTER TABLE sessions ADD COLUMN resume_key TEXT'],
  ['sessions', 'feedback_at', 'ALTER TABLE sessions ADD COLUMN feedback_at INTEGER'],
];

export function newId(prefix: string, bytes = 9): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url')}`;
}

type Raw = Record<string, unknown>;

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
    for (const [table, column, ddl] of MIGRATIONS) {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === column)) this.db.exec(ddl);
    }
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_resume ON sessions(resume_key)');
  }

  close(): void {
    this.db.close();
  }

  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // ---- tests & cuts ----

  createTest(input: { title: string; description?: string; config: TestConfig; transcript: Cue[]; cuts: { label: string; sourceType: SourceType; sourceUrl: string; resolved: ResolvedSource }[] }): TestRow {
    const id = newId('t', 6);
    this.tx(() => {
      this.db
        .prepare('INSERT INTO tests (id, title, description, status, created_at, config, transcript) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, input.title, input.description ?? '', 'draft', Date.now(), JSON.stringify(input.config), JSON.stringify(input.transcript));
      for (const cut of input.cuts) {
        this.db
          .prepare('INSERT INTO cuts (id, test_id, label, source_type, source_url, resolved) VALUES (?, ?, ?, ?, ?, ?)')
          .run(newId('c', 6), id, cut.label, cut.sourceType, cut.sourceUrl, JSON.stringify(cut.resolved));
      }
    });
    return this.getTest(id)!;
  }

  getTest(id: string): TestRow | undefined {
    const row = this.db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as Raw | undefined;
    return row ? parseTest(row) : undefined;
  }

  listTests(): TestRow[] {
    return (this.db.prepare('SELECT * FROM tests ORDER BY created_at DESC').all() as Raw[]).map(parseTest);
  }

  updateTest(id: string, patch: { title?: string; description?: string; status?: TestRow['status']; config?: TestConfig; transcript?: Cue[] }): void {
    const cur = this.getTest(id);
    if (!cur) return;
    this.db
      .prepare('UPDATE tests SET title = ?, description = ?, status = ?, config = ?, transcript = ? WHERE id = ?')
      .run(patch.title ?? cur.title, patch.description ?? cur.description, patch.status ?? cur.status, JSON.stringify(patch.config ?? cur.config), JSON.stringify(patch.transcript ?? cur.transcript), id);
  }

  deleteTest(id: string): void {
    for (const c of this.getCuts(id)) this.db.prepare("DELETE FROM summaries WHERE cut_key LIKE ?").run(`${c.id}:%`);
    this.db.prepare('DELETE FROM tests WHERE id = ?').run(id);
  }

  getCuts(testId: string): CutRow[] {
    return (this.db.prepare('SELECT * FROM cuts WHERE test_id = ? ORDER BY rowid').all(testId) as Raw[]).map(parseCut);
  }

  getCut(id: string): CutRow | undefined {
    const row = this.db.prepare('SELECT * FROM cuts WHERE id = ?').get(id) as Raw | undefined;
    return row ? parseCut(row) : undefined;
  }

  setCutResolved(id: string, resolved: ResolvedSource): void {
    this.db.prepare('UPDATE cuts SET resolved = ? WHERE id = ?').run(JSON.stringify(resolved), id);
  }

  // ---- sessions ----

  findSessionByPid(testId: string, pid: string): SessionRow | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE test_id = ? AND pid = ?').get(testId, pid) as SessionRow | undefined;
  }

  getSession(id: string): SessionRow | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  }

  createSession(s: { testId: string; cutId: string; pid: string; demographics: Record<string, string | null>; synthetic?: boolean; userAgent?: string; status?: SessionRow['status'] }): SessionRow {
    const id = newId('s', 12);
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO sessions (id, test_id, cut_id, pid, age_band, gender, country, member, status, synthetic, user_agent, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, s.testId, s.cutId, s.pid,
        s.demographics.age_band ?? null, s.demographics.gender ?? null, s.demographics.country ?? null, s.demographics.member ?? null,
        s.status ?? 'started', s.synthetic ? 1 : 0, s.userAgent ?? null, now, now,
      );
    return this.getSession(id)!;
  }

  findSessionByResumeKey(key: string): SessionRow | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE resume_key = ?').get(key) as SessionRow | undefined;
  }

  updateSession(id: string, patch: Partial<Pick<SessionRow, 'status' | 'calib_passed' | 'calibration' | 'max_pt' | 'pauses' | 'pause_sec' | 'checks_total' | 'checks_passed' | 'survey' | 'valid' | 'exclude_reason' | 'completion_code' | 'completed_at' | 'last_seen' | 'resume_key' | 'feedback_at'>>): void {
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (!keys.length) return;
    const sql = `UPDATE sessions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...keys.map((k) => (patch[k] ?? null) as string | number | null), id);
  }

  /** Counts per cut for balanced assignment of a new viewer to a cut (PRD TS-6). */
  sessionCountsByCut(testId: string): Map<string, number> {
    const rows = this.db.prepare(`SELECT cut_id, COUNT(*) AS n FROM sessions WHERE test_id = ? AND status != 'screened_out' GROUP BY cut_id`).all(testId) as { cut_id: string; n: number }[];
    return new Map(rows.map((r) => [r.cut_id, r.n]));
  }

  /** Counts of non-screened sessions per option of one demographic, for quota checks. */
  quotaCounts(testId: string, key: string): Map<string, number> {
    const rows = this.db
      .prepare(`SELECT ${key} AS v, COUNT(*) AS n FROM sessions WHERE test_id = ? AND status != 'screened_out' AND synthetic = 0 GROUP BY ${key}`)
      .all(testId) as { v: string; n: number }[];
    return new Map(rows.map((r) => [r.v, r.n]));
  }

  listSessions(testId: string): SessionRow[] {
    return this.db.prepare('SELECT * FROM sessions WHERE test_id = ? ORDER BY created_at').all(testId) as SessionRow[];
  }

  deleteSyntheticSessions(testId: string): number {
    const r = this.db.prepare('DELETE FROM sessions WHERE test_id = ? AND synthetic = 1').run(testId);
    return Number(r.changes);
  }

  /** Player seconds of one kind of key press, for the "your moments" feedback steps. */
  pressMoments(sessionId: string, type: 'interest' | 'bored'): number[] {
    return (this.db.prepare('SELECT pt FROM events WHERE session_id = ? AND type = ? ORDER BY pt').all(sessionId, type) as { pt: number }[]).map((r) => r.pt);
  }

  /** Journey events (key presses and saves) for every session of a cut, in one query. */
  journeyEvents(cutId: string): { session_id: string; type: string; pt: number; data: string | null }[] {
    return this.db
      .prepare(`SELECT e.session_id, e.type, e.pt, e.data FROM events e JOIN sessions s ON s.id = e.session_id WHERE s.cut_id = ? AND e.type IN ('interest', 'bored', 'save_later') ORDER BY e.pt`)
      .all(cutId) as { session_id: string; type: string; pt: number; data: string | null }[];
  }

  /** One viewer's attention, averaged into `buckets` equal slices of the range. */
  attentionBuckets(sessionId: string, start: number, end: number, buckets: number): (number | null)[] {
    const rows = this.db.prepare('SELECT sec, samples, attentive FROM session_seconds WHERE session_id = ? AND sec >= ? AND sec < ?').all(sessionId, Math.floor(start), Math.ceil(end)) as { sec: number; samples: number; attentive: number }[];
    const sum = new Array(buckets).fill(0);
    const n = new Array(buckets).fill(0);
    const width = Math.max(1, (end - start) / buckets);
    for (const r of rows) {
      const b = Math.min(buckets - 1, Math.floor((r.sec - start) / width));
      if (r.samples > 0) {
        sum[b] += r.attentive / r.samples;
        n[b]++;
      }
    }
    return sum.map((v, i) => (n[i] ? Math.round((1000 * v) / n[i]) / 1000 : null));
  }

  // ---- users ----

  countUsers(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  createUser(u: { email: string; name: string; role: Role; passHash: string }): UserRow {
    const id = newId('u', 8);
    this.db.prepare('INSERT INTO users (id, email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, u.email.toLowerCase(), u.name, u.role, u.passHash, Date.now());
    return this.getUser(id)!;
  }

  getUser(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  getUserByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined;
  }

  listUsers(): UserRow[] {
    return this.db.prepare('SELECT * FROM users ORDER BY role, name').all() as UserRow[];
  }

  updateUser(id: string, patch: Partial<Pick<UserRow, 'name' | 'role' | 'pass_hash' | 'last_login'>>): void {
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (!keys.length) return;
    this.db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => (patch[k] ?? null) as string | number | null), id);
  }

  deleteUser(id: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  // ---- summaries ----

  getSummary(key: string): { source: string; responses: number; content: unknown; created_at: number } | undefined {
    const row = this.db.prepare('SELECT * FROM summaries WHERE cut_key = ?').get(key) as { source: string; responses: number; content: string; created_at: number } | undefined;
    return row ? { ...row, content: JSON.parse(row.content) } : undefined;
  }

  saveSummary(key: string, source: string, responses: number, content: unknown): void {
    this.db
      .prepare('INSERT INTO summaries (cut_key, source, responses, content, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cut_key) DO UPDATE SET source = excluded.source, responses = excluded.responses, content = excluded.content, created_at = excluded.created_at')
      .run(key, source, responses, JSON.stringify(content), Date.now());
  }

  // ---- signals ----

  /** Aggregates a batch of 4 Hz samples into per-second rows. */
  addSamples(sessionId: string, samples: Sample[]): void {
    const bySec = new Map<number, { n: number; face: number; att: number }>();
    for (const [pt, face, att, visible] of samples) {
      const sec = Math.floor(pt);
      const agg = bySec.get(sec) ?? { n: 0, face: 0, att: 0 };
      agg.n += 1;
      agg.face += face;
      agg.att += att && visible ? 1 : 0;
      bySec.set(sec, agg);
    }
    const stmt = this.db.prepare(
      `INSERT INTO session_seconds (session_id, sec, samples, face, attentive) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, sec) DO UPDATE SET samples = samples + excluded.samples, face = face + excluded.face, attentive = attentive + excluded.attentive`,
    );
    this.tx(() => {
      for (const [sec, a] of bySec) stmt.run(sessionId, sec, a.n, a.face, a.att);
    });
  }

  addEvents(sessionId: string, events: ViewerEvent[]): void {
    const stmt = this.db.prepare('INSERT INTO events (session_id, type, pt, ts, data) VALUES (?, ?, ?, ?, ?)');
    this.tx(() => {
      for (const e of events) stmt.run(sessionId, e.type, e.pt, e.ts, e.data ? JSON.stringify(e.data) : null);
    });
  }

  /** Per-session totals used by the quality rules (PRD SQ-5). */
  sessionSignalTotals(sessionId: string, range: { start: number; end: number }): { watchedSec: number; samples: number; face: number; presses: number } {
    const s = this.db
      .prepare('SELECT COUNT(*) AS watched, COALESCE(SUM(samples), 0) AS samples, COALESCE(SUM(face), 0) AS face FROM session_seconds WHERE session_id = ? AND sec >= ? AND sec < ?')
      .get(sessionId, Math.floor(range.start), Math.ceil(range.end)) as { watched: number; samples: number; face: number };
    const p = this.db.prepare(`SELECT COUNT(*) AS n FROM events WHERE session_id = ? AND type = 'interest'`).get(sessionId) as { n: number };
    return { watchedSec: s.watched, samples: s.samples, face: s.face, presses: p.n };
  }
}

function parseTest(row: Raw): TestRow {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    status: row.status as TestRow['status'],
    created_at: row.created_at as number,
    config: JSON.parse(row.config as string) as TestConfig,
    transcript: JSON.parse(row.transcript as string) as Cue[],
  };
}

function parseCut(row: Raw): CutRow {
  return {
    id: row.id as string,
    test_id: row.test_id as string,
    label: row.label as string,
    source_type: row.source_type as SourceType,
    source_url: row.source_url as string,
    resolved: row.resolved ? (JSON.parse(row.resolved as string) as ResolvedSource) : null,
  };
}
