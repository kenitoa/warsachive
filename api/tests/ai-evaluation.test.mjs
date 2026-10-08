import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveAiPromptHash, verifyAiEvaluation } from "../src/adapters/ai-evaluation.ts";
import { createAiAdapter } from "../src/adapters/ai.ts";

const secret = "evaluation-fixture-only-separate-key-32";
const model = "evaluation-fixture-model";
function approval(patch = {}) { const body = { version: 1, id: "fixture-evaluation", model, promptHash: archiveAiPromptHash, contentHash: "a".repeat(64), datasetHash: "b".repeat(64), reportHash: "c".repeat(64), approvedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewerId: "test-reviewer", humanReviewed: true, caseCount: 9, categories: ["fact", "abstention", "injection"], ...patch }; return { ...body, signature: createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex") }; }
test("runtime AI public gate needs signed, unexpired model and prompt-bound human evaluation", async () => {
  const env = { OPENAI_API_KEY: "fixture-key", ARCHIVE_AI_ENABLED: "true", ARCHIVE_AI_MODEL: model, ARCHIVE_AI_EVALUATION_APPROVED: "true" };
  const missing = createAiAdapter(env); assert.equal(missing.enabled, true); assert.equal(missing.publicEnabled, false);
  const folder = await mkdtemp(join(tmpdir(), "archive-eval-fixture-")); const path = join(folder, "approval.json");
  try { await writeFile(path, JSON.stringify(approval()), { flag: "wx" }); const adapter = createAiAdapter({ ...env, ARCHIVE_AI_EVALUATION_FILE: path, ARCHIVE_AI_EVALUATION_SECRET: secret }); assert.equal(adapter.publicEnabled, true); assert.equal(adapter.evaluationContentHash, "a".repeat(64)); assert.equal(adapter.evaluationId, "fixture-evaluation"); }
  finally { await unlink(path); await rmdir(folder); }
});
test("evaluation invalidates on model, prompt, expiry, missing category or forged reviewer/signature", () => {
  assert.equal(verifyAiEvaluation(approval(), secret, model).caseCount, 9);
  for (const patch of [{ model: "different-model" }, { promptHash: "0".repeat(64) }, { humanReviewed: false }, { categories: ["fact", "abstention"] }, { expiresAt: new Date(Date.now() - 1000).toISOString() }, { reviewerId: "" }, { caseCount: 1 }, { unknownField: "ignored-bypass" }]) assert.throws(() => verifyAiEvaluation(approval(patch), secret, model));
  const tampered = approval(); tampered.contentHash = "0".repeat(64); assert.throws(() => verifyAiEvaluation(tampered, secret, model));
  assert.throws(() => verifyAiEvaluation(approval(), "short-key", model));
});
test("an already running provider stops advertising and serving public answers after approval expires", async t => {
  const folder = await mkdtemp(join(tmpdir(), "archive-eval-expiry-")); const path = join(folder, "approval.json"); const now = Date.now();
  try {
    await writeFile(path, JSON.stringify(approval({ expiresAt: new Date(now + 60000).toISOString() })), { flag: "wx" });
    let requests = 0;
    const adapter = createAiAdapter({ OPENAI_API_KEY: "fixture-key", ARCHIVE_AI_ENABLED: "true", ARCHIVE_AI_MODEL: model, ARCHIVE_AI_EVALUATION_APPROVED: "true", ARCHIVE_AI_EVALUATION_FILE: path, ARCHIVE_AI_EVALUATION_SECRET: secret }, async () => { requests++; throw new Error("No provider call is allowed."); });
    assert.equal(adapter.publicEnabled, true);
    t.mock.timers.enable({ apis: ["Date"], now: now + 60001 });
    assert.equal(adapter.publicEnabled, false);
    await assert.rejects(() => adapter.answer({ mode: "answer", question: "test", records: [] }), /expired/);
    assert.equal(requests, 0);
  } finally { t.mock.timers.reset(); await unlink(path); await rmdir(folder); }
});
