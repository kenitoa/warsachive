import { createHash, createHmac } from "node:crypto";
import { isArchiveRecord, isPublicRecord } from "../web/lib/archive-domain.ts";
export const jsonHash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function verifyPublicationPageHtml(html, approval) {
  if (typeof html !== "string" || !html.trim() || !approval || !/^[a-zA-Z0-9_-]{1,80}$/.test(approval.recordId) || !/^[a-f0-9]{64}$/.test(approval.contentHash) || !Number.isSafeInteger(approval.revision) || approval.revision < 1) throw new Error("An approved HTML page and its actual signed revision are required.");
  // Only actual article attributes count. Serialized RSC/script text and comments
  // may mention the fields but cannot establish that the record was rendered.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const markers = [];
  for (const tag of markup.matchAll(/<article\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    const fields = Object.create(null);
    for (const attribute of tag[1].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = attribute[1].toLowerCase();
      if (!["data-archive-publication", "data-archive-record-id", "data-archive-content-hash", "data-archive-approved-revision"].includes(name)) continue;
      if (Object.hasOwn(fields, name)) throw new Error("The approved page contains duplicate evidence attributes.");
      fields[name] = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
    }
    if (fields["data-archive-publication"] === "approved") markers.push(fields);
  }
  if (markers.length !== 1 || markers[0]["data-archive-record-id"] !== approval.recordId || markers[0]["data-archive-content-hash"] !== approval.contentHash || markers[0]["data-archive-approved-revision"] !== String(approval.revision)) throw new Error("The HTML page does not render the currently approved record hash and revision.");
  return { recordId: approval.recordId, revision: approval.revision, contentHash: approval.contentHash };
}
export function publicationObservation(release, mobile, catalog, publication, expectedSha) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha) || release.version !== 1 || release.gitSha !== expectedSha || release.mode !== "ci" || mobile.version !== 1 || !Array.isArray(mobile.records) || mobile.records.length > 10000 || !mobile.records.every(record => isArchiveRecord(record) && isPublicRecord(record)) || catalog.version !== 2 || !Array.isArray(catalog.records)) throw new Error("A verified CI release and public record contracts are required.");
  const site = new URL(release.siteUrl); if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash) throw new Error("Evidence requires the configured HTTPS publication site.");
  const hash = jsonHash(mobile.records);
  if (hash !== release.contentHash || hash !== mobile.contentHash || hash !== catalog.contentHash || release.recordCount !== mobile.records.length || release.siteUrl !== mobile.siteUrl || release.siteUrl !== catalog.siteUrl || new Set(mobile.records.map(record => record.id)).size !== mobile.records.length || catalog.records.length !== mobile.records.length || new Set(catalog.records.map(record => record.id)).size !== mobile.records.length) throw new Error("Publication channels contain different data.");
  for (const record of mobile.records) { const descriptor = catalog.records.find(item => item.id === record.id); const body = JSON.stringify(record); const sha = jsonHash(record); if (!descriptor || descriptor.sha256 !== sha || descriptor.bytes !== Buffer.byteLength(body) || descriptor.detailPath !== `/data/records/${record.id}-${sha}.json`) throw new Error("A catalog shard does not match the actual public record."); }
  if (publication.withheldIds.some(id => mobile.records.some(record => record.id === id))) throw new Error("A withdrawn record is still public.");
  return publication.approvals.map(approval => { const record = mobile.records.find(record => record.id === approval.recordId); if (!record || record.review.status !== "approved" || record.review.humanReviewed !== true || jsonHash(record) !== approval.contentHash || !Number.isSafeInteger(approval.revision) || approval.revision < 1) throw new Error("The observed release does not contain the approved revision."); return { recordId: record.id, revision: approval.revision, contentHash: approval.contentHash, commitSha: expectedSha, artifactHash: hash, url: `${release.siteUrl}/archive/${record.id}/` }; });
}
export function signPublicationObservation(entries, secret, now = new Date().toISOString()) { if (typeof secret !== "string" || secret.length < 32 || !Array.isArray(entries) || !entries.length) throw new Error("A separate evidence signing key and verified entries are required."); const body = { version: 1, observedAt: now, entries }; return { ...body, signature: createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex") }; }
