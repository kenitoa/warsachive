import { createHash } from "node:crypto";
import { readFile, open } from "node:fs/promises";
import { resolve } from "node:path";
import { createAiAdapter } from "../api/src/adapters/ai.ts";
import { archiveAiPromptHash } from "../api/src/adapters/ai-evaluation.ts";
import { readArchiveContent } from "../web/scripts/read-archive-content.mjs";
import { publicRecord } from "../api/src/domain/archive.ts";

// A manually invoked operator tool. Runtime HTTP routes never enable evaluationRun.
const [datasetFile, reportFile] = process.argv.slice(2);
if (!datasetFile || !reportFile) throw new Error("Usage: npm run ai:evaluate -- DATASET_JSON NEW_REPORT_JSON (real provider usage; never auto-runs in CI)");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dataset = JSON.parse(await readFile(resolve(datasetFile), "utf8"));
if (dataset.version !== 1 || typeof dataset.id !== "string" || !Array.isArray(dataset.cases) || dataset.cases.length < 3 || dataset.cases.length > 50 || new Set(dataset.cases.map(item => item.id)).size !== dataset.cases.length) throw new Error("Invalid evaluation dataset.");
const records = (await readArchiveContent()).publicRecords.map(publicRecord).toSorted((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
for (const item of dataset.cases) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || !["fact", "abstention", "injection"].includes(item.category) || typeof item.question !== "string" || !item.question.trim() || item.question.length > 2000 || !Array.isArray(item.recordIds) || !item.recordIds.length || item.recordIds.length > 8 || new Set(item.recordIds).size !== item.recordIds.length || !item.recordIds.every(id => records.some(record => record.id === id)) || typeof item.expectedAbstention !== "boolean" || !Array.isArray(item.expectedSections) || !item.expectedSections.every(id => item.recordIds.some(recordId => records.some(record => record.id === recordId && record.sections.some(section => section.id === id)))) || typeof item.criteria !== "string" || item.criteria.length > 2000) throw new Error("Invalid evaluation case. No provider requests were sent.");
}
const adapter = createAiAdapter(process.env, fetch, true);
if (!adapter.enabled) throw new Error("Configure a real provider and ARCHIVE_AI_ENABLED before manually running evaluation.");
// Reserve a safe destination before any paid request. An interrupted report stays pending.
const reportHandle = await open(resolve(reportFile), "wx", 0o600);
try {
await reportHandle.writeFile(JSON.stringify({ version: 1, state: "evaluation-in-progress", humanApproval: "pending", providerCalled: false }));
const results = []; let inputTokens = 0; let outputTokens = 0;
for (const item of dataset.cases) {
  const start = performance.now();
  try { const answer = await adapter.answer({ question: item.question, records: records.filter(record => item.recordIds.includes(record.id)), mode: "answer" }); inputTokens += answer.usage?.inputTokens ?? 0; outputTokens += answer.usage?.outputTokens ?? 0;
    const automatedPass = Boolean(answer.usage && Number.isSafeInteger(answer.usage.inputTokens) && answer.usage.inputTokens >= 0 && Number.isSafeInteger(answer.usage.outputTokens) && answer.usage.outputTokens >= 0) && Boolean(!answer.citations.length) === item.expectedAbstention && item.expectedSections.every(sectionId => answer.citations.some(citation => citation.sectionId === sectionId));
    results.push({ id: item.id, category: item.category, question: item.question, criteria: item.criteria, answer, automatedPass, durationMs: Math.round(performance.now() - start), humanReview: "pending" });
  } catch { results.push({ id: item.id, category: item.category, automatedPass: false, error: "PROVIDER_EVALUATION_FAILED", durationMs: Math.round(performance.now() - start), humanReview: "pending" }); }
}
const report = { version: 1, id: dataset.id, model: process.env.ARCHIVE_AI_MODEL, promptHash: archiveAiPromptHash, contentHash: hash(records), datasetHash: hash(dataset), generatedAt: new Date().toISOString(), providerCalled: true, inputTokens, outputTokens, caseCount: results.length, results, humanApproval: "pending" };
await reportHandle.truncate(0);
await reportHandle.write(JSON.stringify(report, null, 2), 0, "utf8");
console.log(JSON.stringify({ operation: "ai.evaluation", caseCount: results.length, automatedPass: results.filter(item => item.automatedPass).length, inputTokens, outputTokens, humanApproval: "pending" }));
} finally { await reportHandle.close(); }
