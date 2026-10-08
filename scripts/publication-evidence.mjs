import { readFile, writeFile, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validatePublication } from "../web/lib/publication-import.mjs";
import { publicationObservation, signPublicationObservation, verifyPublicationPageHtml } from "./publication-evidence-domain.mjs";

const [phase, outputFile] = process.argv.slice(2);
if (!["build", "deploy"].includes(phase) || !outputFile) throw new Error("Usage: npm run publication:evidence -- build|deploy NEW_PRIVATE_OUTPUT_JSON");
const exportFile = process.env.ARCHIVE_APPROVED_EXPORT_FILE; const verifySecret = process.env.ARCHIVE_PUBLICATION_VERIFY_SECRET; const evidenceSecret = process.env.ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET;
if (!exportFile || !evidenceSecret || evidenceSecret.length < 32 || evidenceSecret === verifySecret || evidenceSecret === process.env.ARCHIVE_API_SESSION_SECRET) throw new Error("A trusted export and separate evidence signing key are required.");
const publication = JSON.parse(await readFile(exportFile, "utf8")); validatePublication(publication, verifySecret);
const expectedSha = process.env.ARCHIVE_RELEASE_SHA || process.env.GITHUB_SHA;
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../web/out");
const readJson = async path => JSON.parse(await readFile(resolve(out, path), "utf8"));
let release, mobile, catalog;
if (phase === "build") { [release, mobile, catalog] = await Promise.all([readJson("release.json"), readJson("data/mobile-index.json"), readJson("data/catalog-v2.json")]); }
const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
async function remote(path, maxBytes = 20000000) {
  const site = new URL(configuredSite); if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash || !site.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.)/.test(site.hostname)) throw new Error("A public HTTPS publication URL is required.");
  const response = await fetch(`${configuredSite.replace(/\/$/, "")}${path}?observation=${encodeURIComponent(expectedSha)}`, { signal: AbortSignal.timeout(10000), redirect: "error", headers: { "Cache-Control": "no-cache" } }); if (!response.ok || !response.body) throw new Error("The public path could not be verified.");
  const chunks = []; let size = 0; const reader = response.body.getReader(); while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error("The public observation exceeds its byte budget."); } chunks.push(value); } return Buffer.concat(chunks);
}
if (phase === "deploy") { [release, mobile, catalog] = await Promise.all(["/release.json", "/data/mobile-index.json", "/data/catalog-v2.json"].map(async path => JSON.parse((await remote(path)).toString("utf8")))); }
if (configuredSite && release.siteUrl !== configuredSite.replace(/\/$/, "")) throw new Error("The configured and observed publication sites differ.");
const approvals = publicationObservation(release, mobile, catalog, publication, expectedSha);
if (!approvals.length) throw new Error("No human-approved record has an observable publication revision.");
for (const descriptor of catalog.records) {
  if (phase === "build") { const path = resolve(out, descriptor.detailPath.slice(1)); const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) throw new Error("The built shard is not a regular file."); const bytes = await readFile(path); if (bytes.length !== descriptor.bytes || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) throw new Error("Built record bytes differ."); }
  else { const bytes = await remote(descriptor.detailPath, 1000000); if (bytes.length !== descriptor.bytes || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) throw new Error("The published mobile shard differs."); }
}
for (const item of approvals) {
  if (phase === "build") { const pagePath = resolve(out, `archive/${item.recordId}/index.html`); const info = await lstat(pagePath); if (!info.isFile() || info.isSymbolicLink() || info.size === 0 || info.size > 2000000) throw new Error("An approved page was not safely built."); verifyPublicationPageHtml(await readFile(pagePath, "utf8"), item); }
  else verifyPublicationPageHtml((await remote(`/archive/${item.recordId}/`, 2000000)).toString("utf8"), item);
}
const entries = approvals.flatMap(item => phase === "build" ? [{ ...item, stage: "build" }] : [{ ...item, stage: "deploy" }, { ...item, stage: "feed", url: `${release.siteUrl}/data/catalog-v2.json` }]);
const evidence = signPublicationObservation(entries, evidenceSecret);
await writeFile(resolve(outputFile), JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ operation: "publication.observed", phase, records: approvals.length, commitSha: release.gitSha, entries: entries.length }));
