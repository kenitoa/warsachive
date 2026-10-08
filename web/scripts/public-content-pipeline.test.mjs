import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { readArchiveContent } from "./read-archive-content.mjs";

const editorial = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8"));
async function fixture(t, records) {
  const directory = await mkdtemp(join(tmpdir(), "warsachive-ops-"));
  t.after(async () => {
    const target = resolve(directory);
    if (!target.startsWith(`${resolve(tmpdir())}${sep}warsachive-ops-`)) throw new Error("Fixture cleanup escaped the task temporary directory.");
    await rm(target, { recursive: true });
  });
  await mkdir(join(directory, "archive"));
  await writeFile(join(directory, "editorial.json"), JSON.stringify({ version: 1, records: [editorial.records[0]], themes: [], collections: [], stories: [] }));
  await writeFile(join(directory, "main.json"), JSON.stringify({ version: 1, published: ["archive/records.json"] }));
  await writeFile(join(directory, "legacy-manifest.json"), JSON.stringify({ capturedAt: "2026-10-07" }));
  await writeFile(join(directory, "archive/records.json"), JSON.stringify({ items: records }));
  return directory;
}
test("public artifacts and review queues merge legacy overlays with newly published complete records", async (t) => {
  const fresh = structuredClone(editorial.records[0]); fresh.id = "new-published-record";
  const legacy = { id: editorial.records[0].id, title: "legacy", summary: "old data", period: "미확인", region: "미분류", sourceCount: 1 };
  const pending = { ...legacy, id: "pending-legacy" };
  const directory = await fixture(t, [legacy, pending, fresh]);
  const result = await readArchiveContent(directory);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.publicRecords.map((record) => record.id), [editorial.records[0].id, "new-published-record"]);
  assert.equal(result.records.find((record) => record.id === "pending-legacy").review.status, "needs-review");
  assert.equal(result.publicRecords[1].sources[0].url, fresh.sources[0].url);
});
test("public artifact ingestion refuses malformed complete records instead of treating them as legacy", async (t) => {
  const fresh = structuredClone(editorial.records[0]); fresh.id = "malformed-v2"; fresh.sections = "wrong";
  const directory = await fixture(t, [fresh]);
  await assert.rejects(readArchiveContent(directory));
});
test("public artifact ingestion blocks paths outside the archive", async (t) => {
  const directory = await fixture(t, []);
  await writeFile(join(directory, "main.json"), JSON.stringify({ version: 1, published: ["../editorial.json"] }));
  await assert.rejects(readArchiveContent(directory), /outside/);
});
