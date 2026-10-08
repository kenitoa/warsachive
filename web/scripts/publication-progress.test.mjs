import test from "node:test";
import assert from "node:assert/strict";
import { decodePublicationSnapshot, publicationProgress, selectedPublicationRelease } from "../lib/publication-progress.ts";

const contentHash = "c".repeat(64), shaA = "a".repeat(40), shaB = "b".repeat(40), artifactA = "a".repeat(64), artifactB = "b".repeat(64);
function stage(id, name, sha, artifactHash, minute, overrides = {}) {
  return { id, stage: name, revision: 5, contentHash, commitSha: sha, artifactHash, url: null, observedAt: `2026-10-08T00:${String(minute).padStart(2, "0")}:00Z`, evidenceSource: name === "export" ? "signed-local-export" : "signed-deployment-observation", ...overrides };
}
function snapshot(stages) { return decodePublicationSnapshot({ recordId: "record-a", revision: 5, contentHash, stages }); }

test("interleaved evidence keeps each complete release together and shares only the current export", () => {
  const common = stage("export-current", "export", null, "e".repeat(64), 0);
  const { exportEvidence, releases } = publicationProgress(snapshot([
    stage("b-feed", "feed", shaB, artifactB, 6), stage("a-deploy", "deploy", shaA, artifactA, 3),
    stage("a-build", "build", shaA, artifactA, 1), stage("b-build", "build", shaB, artifactB, 2),
    stage("a-feed", "feed", shaA, artifactA, 5), stage("b-deploy", "deploy", shaB, artifactB, 4), common
  ]));
  assert.equal(exportEvidence.id, common.id); assert.equal(releases.length, 2);
  assert.deepEqual(releases.map(item => item.commitSha), [shaB, shaA]);
  for (const item of releases) for (const name of ["build", "deploy", "feed"]) {
    assert.equal(item.stages[name].commitSha, item.commitSha); assert.equal(item.stages[name].artifactHash, item.artifactHash);
  }
  assert.equal(selectedPublicationRelease(releases, releases[1].key).stages.feed.id, "a-feed");
});

test("a build-only release does not borrow deploy or feed from a release with the same SHA", () => {
  const { releases } = publicationProgress(snapshot([
    stage("old-build", "build", shaA, artifactA, 1), stage("old-deploy", "deploy", shaA, artifactA, 2),
    stage("old-feed", "feed", shaA, artifactA, 3), stage("new-build", "build", shaA, artifactB, 4)
  ]));
  assert.equal(releases.length, 2);
  const selected = selectedPublicationRelease(releases, `${shaA}:${artifactB}`);
  assert.equal(selected.stages.build.id, "new-build"); assert.equal(selected.stages.deploy, undefined); assert.equal(selected.stages.feed, undefined);
  assert.equal(selectedPublicationRelease(releases, "removed-release").key, selected.key);
  assert.equal(selectedPublicationRelease([], selected.key), null);
});

test("older revisions and different content hashes never supply current stages or export", () => {
  const current = stage("current-build", "build", shaA, artifactA, 1), common = stage("current-export", "export", null, "e".repeat(64), 0);
  const { releases, exportEvidence } = publicationProgress(snapshot([
    stage("old-feed", "feed", shaB, artifactB, 8, { revision: 4 }),
    stage("old-export", "export", null, artifactB, 9, { revision: 4 }),
    stage("other-content-deploy", "deploy", shaA, artifactA, 10, { contentHash: "d".repeat(64) }),
    stage("other-content-export", "export", null, artifactA, 11, { contentHash: "d".repeat(64) }), current, common
  ]));
  assert.equal(exportEvidence.id, common.id); assert.equal(releases.length, 1);
  assert.equal(releases[0].stages.build.id, current.id); assert.equal(releases[0].stages.deploy, undefined); assert.equal(releases[0].stages.feed, undefined);
  assert.deepEqual(publicationProgress(snapshot([])), { exportEvidence: null, releases: [] });
});

test("publication responses require real revision, content, commit and artifact identities", () => {
  const valid = stage("build", "build", shaA, artifactA, 1);
  for (const change of [{ stage: ["build"] }, { commitSha: null }, { commitSha: "short" }, { artifactHash: "short" }, { revision: 0 }, { observedAt: "unverified" }, { url: "javascript:alert(1)" }]) {
    assert.throws(() => snapshot([{ ...valid, ...change }]));
  }
  assert.throws(() => decodePublicationSnapshot({ recordId: "record-a", revision: 5, contentHash: "short", stages: [] }));
});
