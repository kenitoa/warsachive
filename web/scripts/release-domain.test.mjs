import test from "node:test";
import assert from "node:assert/strict";
import { createReleaseMetadata } from "./release-domain.mjs";

test("release preserves the application path and identifies exact content independently of build time", () => {
  const records = [{ id: "imjin-war", updatedAt: "2026-10-07" }];
  const first = createReleaseMetadata(records, "https://example.org/warsachive/", "a".repeat(40), "2026-10-07T00:00:00Z");
  const second = createReleaseMetadata(records, "https://example.org/warsachive", "a".repeat(40), "2026-10-08T00:00:00Z");
  assert.equal(first.siteUrl, "https://example.org/warsachive");
  assert.equal(first.basePath, "/warsachive");
  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.contentHash, createReleaseMetadata([...records, { id: "another" }], first.siteUrl, first.gitSha, first.generatedAt).contentHash);
});
test("release rejects unsafe configuration and incomplete deployment identity", () => {
  for (const url of ["file:///tmp/site", "https://user:secret@example.org", "https://example.org/#fragment", "https://example.org/?token=value"]) assert.throws(() => createReleaseMetadata([], url, "a".repeat(40), "2026-10-07"));
  assert.throws(() => createReleaseMetadata([], "https://example.org", "short", "2026-10-07"));
  assert.throws(() => createReleaseMetadata([], "https://example.org", "a".repeat(40), "bad date"));
});
