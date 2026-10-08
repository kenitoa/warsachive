import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { jsonHash, publicationObservation, signPublicationObservation } from "../../scripts/publication-evidence-domain.mjs";
const record = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8")).records[0];
test("publication observation binds signed approval revision to actual release, catalog and record bytes", () => {
  const item = structuredClone(record); item.review = { ...item.review, status: "approved", humanReviewed: true };
  const records = [item], sha = "a".repeat(40), siteUrl = "https://archive.example.org", contentHash = jsonHash(records), recordHash = jsonHash(item);
  const release = { version: 1, mode: "ci", gitSha: sha, siteUrl, contentHash, recordCount: 1 }; const mobile = { version: 1, siteUrl, contentHash, records }; const catalog = { version: 2, siteUrl, contentHash, records: [{ id: item.id, sha256: recordHash, bytes: Buffer.byteLength(JSON.stringify(item)), detailPath: `/data/records/${item.id}-${recordHash}.json` }] }; const publication = { approvals: [{ recordId: item.id, revision: 4, contentHash: recordHash }], withheldIds: [] };
  const observations = publicationObservation(release, mobile, catalog, publication, sha); assert.equal(observations[0].revision, 4); assert.equal(observations[0].contentHash, recordHash); assert.equal(signPublicationObservation(observations, "x".repeat(32)).signature.length, 64);
  for (const patch of [{ gitSha: "b".repeat(40) }, { mode: "local" }, { contentHash: "c".repeat(64) }, { recordCount: 2 }]) assert.throws(() => publicationObservation({ ...release, ...patch }, mobile, catalog, publication, sha));
  assert.throws(() => publicationObservation(release, mobile, catalog, { ...publication, withheldIds: [item.id] }, sha)); assert.throws(() => publicationObservation(release, mobile, { ...catalog, records: [{ ...catalog.records[0], bytes: 1 }] }, publication, sha));
});
