import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadMobileArchive, readSavedRecords, writeSavedRecords, backupAndResetSavedRecords, archiveEndpoint, validateMobileArchive } from "../archive-client.ts";

const editorial = JSON.parse(await readFile(new URL("../../web/content/editorial.json", import.meta.url), "utf8"));
const archive = { version: 1, siteUrl: "https://example.org/archive", contentHash: "a".repeat(64), generatedAt: "2026-10-07T00:00:00Z", records: editorial.records };
function memoryStorage() {
  const values = new Map();
  return { async getItem(key) { return values.get(key) || null; }, async setItem(key, value) { values.set(key, value); } };
}
const response = () => new Response(JSON.stringify(archive), { status: 200 });

test("mobile download validates and persists a public archive for later offline reading", async () => {
  const storage = memoryStorage();
  const online = await loadMobileArchive(archive.siteUrl, storage, async () => response());
  assert.equal(online.mode, "online");
  const offline = await loadMobileArchive(archive.siteUrl, storage, async () => { throw new Error("offline"); });
  assert.equal(offline.mode, "offline");
  assert.deepEqual(offline.archive.records.map((record) => record.id), archive.records.map((record) => record.id));
});
test("mobile refuses unreviewed records and caches from a different configured site", async () => {
  const withheld = structuredClone(archive); withheld.records[0].review.status = "withheld";
  assert.equal(validateMobileArchive(withheld), false);
  const storage = memoryStorage();
  await loadMobileArchive(archive.siteUrl, storage, async () => response());
  await assert.rejects(loadMobileArchive("https://other.example.org", storage, async () => { throw new Error("offline"); }), /offline/);
});
test("mobile retains a usable cache when a server response is malformed", async () => {
  const storage = memoryStorage();
  await loadMobileArchive(archive.siteUrl, storage, async () => response());
  const result = await loadMobileArchive(archive.siteUrl, storage, async () => new Response('{"version":2}'));
  assert.equal(result.mode, "offline");
  await assert.rejects(loadMobileArchive(archive.siteUrl, memoryStorage(), async () => new Response('{"version":2}')), /형식/);
});
test("mobile bookmark persistence survives reload and rejects corrupted state", async () => {
  const storage = memoryStorage();
  await writeSavedRecords(storage, ["imjin-war", "imjin-war"]);
  assert.deepEqual(await readSavedRecords(storage), ["imjin-war"]);
  await assert.rejects(writeSavedRecords(storage, ["../secret"]), /최대/);
  const broken = { async getItem() { return '{"wrong":true}'; }, async setItem() {} };
  await assert.rejects(readSavedRecords(broken), /형식/);
});
test("mobile endpoint configuration preserves project paths and rejects unsafe schemes", () => {
  assert.equal(archiveEndpoint("https://example.org/archive/"), "https://example.org/archive/data/mobile-index.json");
  for (const url of ["javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "https://example.org/?secret=a"]) assert.throws(() => archiveEndpoint(url));
});
test("mobile rejects prototype-bearing payloads before using public fields", () => {
  const poisoned = JSON.parse(JSON.stringify(archive).replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  assert.equal(validateMobileArchive(poisoned), false);
  assert.equal(validateMobileArchive(Object.create(archive)), false);
  assert.equal({}.polluted, undefined);
});
test("a damaged bookmark list cannot be replaced until explicit backup and recovery", async () => {
  const storage = memoryStorage();
  const corrupted = '{"wrong":true}';
  await storage.setItem("war-archive:saved:v1", corrupted);
  await assert.rejects(writeSavedRecords(storage, ["imjin-war"]), /형식/);
  assert.equal(await storage.getItem("war-archive:saved:v1"), corrupted);
  await backupAndResetSavedRecords(storage);
  assert.equal(await storage.getItem("war-archive:saved:v1:recovery-backup"), corrupted);
  assert.deepEqual(await readSavedRecords(storage), []);
});
