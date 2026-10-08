import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { publicRecord } from "../../api/src/domain/archive.ts";
import { approvedPageEvidence } from "../lib/publication-page-evidence.ts";
import { applyPublication, validatePublication } from "../lib/publication-import.mjs";
import { jsonHash, publicationObservation, verifyPublicationPageHtml } from "../../scripts/publication-evidence-domain.mjs";

const source = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8")).records[0];
const secret = "test-only-publication-secret-".repeat(2);
function approved() { return publicRecord({ ...source, review: { ...source.review, status: "approved", humanReviewed: true } }); }
function signedPublication(record, withheldIds = []) {
  const items = record ? [record] : [], approvals = items.map(item => ({ recordId: item.id, revision: 7, contentHash: jsonHash(item), reviewerId: "test-reviewer", approvedAt: "2026-10-08T00:00:00Z" }));
  const body = { version: 1, generatedAt: "2026-10-08T00:00:00Z", contentHash: jsonHash(items), items, approvals, withheldIds }, payloadHash = jsonHash(body);
  return { ...body, publication: { algorithm: "hmac-sha256", payloadHash, signature: createHmac("sha256", secret).update(payloadHash).digest("hex") } };
}
function html(evidence) { return `<html><body><article class="recordSheet" data-archive-publication="approved" data-archive-record-id="${evidence.recordId}" data-archive-content-hash="${evidence.contentHash}" data-archive-approved-revision="${evidence.revision}"><h1>Test approved record</h1></article></body></html>`; }

test("approved page metadata derives only from a verified signed approval and the actual canonical public record", () => {
  const record = approved(), payload = signedPublication(record), publication = validatePublication(payload, secret), evidence = approvedPageEvidence(record, publication);
  assert.deepEqual(evidence, { recordId: record.id, revision: 7, contentHash: jsonHash(publicRecord(record)) });
  assert.equal(publication.approvals[0].revision, 7); assert.equal(approvedPageEvidence(source, publication), null);
  assert.equal(approvedPageEvidence(record, { approvals: [], withheldIds: [] }), null);
  assert.equal(approvedPageEvidence(record, { ...publication, withheldIds: [record.id] }), null);
  assert.equal(approvedPageEvidence(applyPublication([record], validatePublication(signedPublication(null, [record.id]), secret))[0], publication), null);
  assert.throws(() => approvedPageEvidence({ ...record, summary: "changed current rendered summary" }, publication), /signed public record/);
  assert.throws(() => approvedPageEvidence(record, { ...publication, approvals: [{ ...publication.approvals[0], revision: 0 }] }), /signed public record/);
});
test("HTML evidence requires exactly one real article with the signed hash, record ID and approved revision", () => {
  const record = approved(), evidence = approvedPageEvidence(record, validatePublication(signedPublication(record), secret));
  assert.deepEqual(verifyPublicationPageHtml(html(evidence), evidence), evidence);
  for (const page of ["", "<html><article>Old page</article></html>", html({ ...evidence, contentHash: "0".repeat(64) }), html({ ...evidence, revision: 6 }), html({ ...evidence, recordId: "another-record" }), "<article class=reviewHolding>Withheld record</article>", html(evidence) + html(evidence)]) assert.throws(() => verifyPublicationPageHtml(page, evidence));
  for (const page of [`<script type="application/json">${html(evidence)}</script>`, `<!--${html(evidence)}-->`, `<style>${html(evidence)}</style>`, `<article title='${html(evidence)}'>No evidence attributes</article>`]) assert.throws(() => verifyPublicationPageHtml(page, evidence));
  assert.throws(() => verifyPublicationPageHtml(html(evidence).replace('class="recordSheet"', 'data-archive-approved-revision="6"'), evidence), /duplicate/);
});
test("latest release and mobile shards cannot establish deployment of a stale or withdrawn HTML page", () => {
  const record = approved(), payload = signedPublication(record), records = [record], contentHash = jsonHash(records), sha = "a".repeat(40), siteUrl = "https://archive.example.org";
  const release = { version: 1, mode: "ci", gitSha: sha, siteUrl, contentHash, recordCount: 1 }, mobile = { version: 1, siteUrl, contentHash, records }, catalog = { version: 2, siteUrl, contentHash, records: [{ id: record.id, sha256: jsonHash(record), bytes: Buffer.byteLength(JSON.stringify(record)), detailPath: `/data/records/${record.id}-${jsonHash(record)}.json` }] };
  const observations = publicationObservation(release, mobile, catalog, payload, sha); assert.deepEqual(verifyPublicationPageHtml(html(observations[0]), observations[0]), { recordId: record.id, revision: 7, contentHash: jsonHash(record) });
  for (const page of [html({ ...observations[0], contentHash: "b".repeat(64) }), html({ ...observations[0], revision: 5 }), "<article>Withdrawn record</article>"]) assert.throws(() => verifyPublicationPageHtml(page, observations[0]));
  assert.throws(() => publicationObservation(release, mobile, catalog, { ...payload, withheldIds: [record.id] }, sha), /withdrawn/);
});
