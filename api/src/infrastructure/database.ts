import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
export type Row = Record<string, string | number | bigint | null | Uint8Array>;
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    this.migrate();
  }
  get(sql: string, ...params: SQLInputValue[]): Row | undefined { return this.db.prepare(sql).get(...params); }
  all(sql: string, ...params: SQLInputValue[]): Row[] { return this.db.prepare(sql).all(...params); }
  run(sql: string, ...params: SQLInputValue[]): number { return Number(this.db.prepare(sql).run(...params).changes); }
  transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  migrate(): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const folder = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");
    for (const version of readdirSync(folder).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      const sql = readFileSync(resolve(folder, version), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      this.transaction(() => {
        const existing = this.get("SELECT checksum FROM schema_migrations WHERE version=?", version);
        if (existing) { if (existing.checksum !== checksum) throw new Error(`Applied migration changed: ${version}`); return; }
        this.db.exec(sql); this.run("INSERT INTO schema_migrations VALUES (?,?,?)", version, checksum, new Date().toISOString());
      });
    }
  }
  audit(actorId: string | null, operation: string, targetId: string | null, requestId: string, status = "success"): void {
    this.run("INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)", randomUUID(), actorId, operation, targetId, status, requestId, new Date().toISOString());
  }
  close(): void { this.db.close(); }
}
export function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function rowJson(row: Row): Record<string, unknown> { const raw = row.payload; if (typeof raw !== "string") throw new Error("Stored payload is invalid."); return JSON.parse(raw) as Record<string, unknown>; }
