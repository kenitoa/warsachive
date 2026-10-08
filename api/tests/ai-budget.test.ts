import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Store } from "../src/infrastructure/database.ts";
import { readConfig } from "../src/config.ts";
import { AiService } from "../src/application/ai.ts";
import { EditorialService } from "../src/application/editorial.ts";
import { AuthService } from "../src/application/auth.ts";
import { disabledAdapters } from "../src/adapters/contracts.ts";
import { object } from "../src/domain/validation.ts";
import { AppError } from "../src/domain/errors.ts";

test("AI atomically reserves a shared daily budget and keeps failed/unknown calls consumed across restarts", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "war-ai-budget-"));
  const config = readConfig({ ARCHIVE_API_DB_PATH: resolve(directory, "api.sqlite"), ARCHIVE_AI_DAILY_REQUEST_LIMIT: "2" });
  const store = new Store(config.dbPath); t.after(async () => { store.close(); assert.ok(directory.startsWith(resolve(tmpdir(), "war-ai-budget-"))); await rm(directory, { recursive: true }); });
  const raw = object(JSON.parse(await readFile(new URL("../../web/content/editorial.json", import.meta.url), "utf8")) as unknown); assert.ok(Array.isArray(raw.records)); const record = object(raw.records[0]);
  const adapters = disabledAdapters(); let release: () => void = () => {}; const gate = new Promise<void>(done => { release = done; }); let calls = 0;
  adapters.ai = { enabled: true, publicEnabled: true, async answer() { const call = ++calls; await gate; if (call === 2) throw new Error("Supplier result unknown"); return { text: "Supported passage", citations: [], usage: { inputTokens: 20, outputTokens: 10 } }; } };
  const editorial = new EditorialService(store, adapters); const admin = await new AuthService(store, config).bootstrapAdmin("admin@example.org", "Admin", "tested-password-123"); editorial.importStatic(admin, { version: 1, records: [record] }, "test");
  const ai = new AiService(store, adapters, config, editorial); const input = { mode: "answer", question: "What evidence is available?", recordIds: [record.id] };
  const outcomes = Promise.allSettled([ai.answer(admin, input, "test-1"), ai.answer(admin, input, "test-2"), ai.answer(admin, input, "test-3")]); release(); const results = await outcomes;
  assert.equal(calls, 2); assert.equal(results.filter(item => item.status === "fulfilled").length, 1); const denied = results[2]; assert.ok(denied.status === "rejected" && denied.reason instanceof AppError && denied.reason.code === "AI_DAILY_LIMIT");
  const date = new Date().toISOString().slice(0, 10); const usage = store.get("SELECT * FROM ai_daily_usage WHERE date=?", date); assert.equal(usage?.reserved_calls, 2); assert.equal(usage?.input_tokens, 20); assert.equal(usage?.output_tokens, 10);
  const restarted = new Store(config.dbPath); try { const next = new AiService(restarted, adapters, config, new EditorialService(restarted, adapters)); await assert.rejects(() => next.answer(admin, input, "test-4"), (error: unknown) => error instanceof AppError && error.code === "AI_DAILY_LIMIT"); assert.equal(calls, 2); } finally { restarted.close(); }
  assert.ok(!JSON.stringify(store.all("SELECT * FROM audit_events")).includes(String(input.question)));
});

test("disabled AI does not consume reservations and invalid budget configuration fails early", async () => {
  for (const value of ["", "0", "-1", "NaN", "1.5", "1000001"]) assert.throws(() => readConfig({ ARCHIVE_AI_DAILY_REQUEST_LIMIT: value }), /일일 요청 한도/);
  assert.equal(readConfig({}).aiDailyRequestLimit, 100); const config = readConfig({}); const store = new Store(":memory:");
  try { const adapters = disabledAdapters(); const ai = new AiService(store, adapters, config, new EditorialService(store, adapters)); await assert.rejects(() => ai.answer({ id: "account", email: "user@example.org", name: "User", role: "member" }, { mode: "answer", question: "Question", recordIds: ["imjin-war"] }, "test"), (error: unknown) => error instanceof AppError && error.code === "AI_DISABLED"); assert.equal(store.get("SELECT count(*) AS count FROM ai_daily_usage")?.count, 0); } finally { store.close(); }
});
