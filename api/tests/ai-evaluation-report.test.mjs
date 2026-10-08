import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEvaluationUsage } from "../../scripts/ai-evaluation-report.mjs";
import { separateEvaluationKey } from "../src/adapters/ai-evaluation.ts";

test("approval requires every case usage and exactly matching safe aggregate usage", () => {
  const report = { inputTokens: 9, outputTokens: 5, results: [{ answer: { usage: { inputTokens: 4, outputTokens: 2 } } }, { answer: { usage: { inputTokens: 5, outputTokens: 3 } } }] };
  assert.deepEqual(verifyEvaluationUsage(report), { inputTokens: 9, outputTokens: 5 });
  for (const changed of [{ ...report, inputTokens: undefined }, { ...report, outputTokens: -1 }, { ...report, inputTokens: 8 }, { ...report, results: [{ answer: {} }] }, { ...report, results: [{ answer: { usage: { inputTokens: .5, outputTokens: 1 } } }] }]) assert.throws(() => verifyEvaluationUsage(changed));
});
test("evaluation signing keys cannot reuse any runtime/provider purpose key", () => {
  const key = "evaluation-only-signing-key-at-least-32";
  assert.equal(separateEvaluationKey({ ARCHIVE_AI_EVALUATION_SECRET: key }), true);
  for (const name of ["OPENAI_API_KEY", "ARCHIVE_API_SESSION_SECRET", "ARCHIVE_PUBLICATION_SECRET", "ARCHIVE_PUBLICATION_VERIFY_SECRET", "ARCHIVE_SECURITY_ENCRYPTION_KEY", "ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET", "ARCHIVE_NOTIFICATION_SECRET", "ARCHIVE_NOTIFICATION_RECEIPT_SECRET", "ARCHIVE_FILE_SCAN_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) assert.equal(separateEvaluationKey({ ARCHIVE_AI_EVALUATION_SECRET: key, [name]: key }), false);
});
