import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { toSearchRecord } from "../lib/archive-domain.ts";
import { getSiteUrl } from "../app/site-config.ts";
import { createReleaseMetadata } from "./release-domain.mjs";
import { readArchiveContent } from "./read-archive-content.mjs";
import { createHash } from "node:crypto";
import { parseKnowledgeRegistry, buildKnowledgePublicArtifacts } from "../lib/knowledge-domain.ts";
import { pruneGeneratedRecordFiles } from "./public-record-files.mjs";

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { publicRecords: records, editorial } = await readArchiveContent();
const ids = new Set(records.map((record) => record.id));
if (ids.size !== records.length) throw new Error("Public archive contains duplicate IDs.");
const siteUrl = getSiteUrl();
let gitSha = process.env.ARCHIVE_RELEASE_SHA || process.env.GITHUB_SHA || "";
if (!gitSha) {
  try { gitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: webDirectory, encoding: "utf8" }).trim(); }
  catch { gitSha = "uncommitted"; }
}
const generatedAt = new Date().toISOString();
const mode = process.env.ARCHIVE_BUILD_PROFILE === "preview" ? "preview" : process.env.GITHUB_ACTIONS === "true" ? "ci" : "local";
const release = createReleaseMetadata(records, siteUrl, gitSha, generatedAt, mode);
const { contentHash } = release;
const mobile = { version: 1, siteUrl, contentHash, generatedAt, records };
const search = { version: 1, contentHash, records: records.map(toSearchRecord) };
const escapeXml = (text) => String(text).replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]);
const feedRecords = [...records].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)).slice(0, 50);
const feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>전쟁 역사 아카이브</title><link>${escapeXml(siteUrl)}/</link><description>출처와 맥락으로 읽는 공개 전쟁사 기록</description><language>ko-KR</language>${feedRecords.map((record) => `<item><title>${escapeXml(record.title)}</title><link>${escapeXml(siteUrl)}/archive/${record.id}/</link><guid isPermaLink="true">${escapeXml(siteUrl)}/archive/${record.id}/</guid><description>${escapeXml(record.summary)}</description><pubDate>${new Date(record.publishedAt).toUTCString()}</pubDate></item>`).join("")}</channel></rss>\n`;
await mkdir(resolve(webDirectory, "public/data"), { recursive: true });
await mkdir(resolve(webDirectory, "public/data/records"), { recursive: true });
const descriptors = [];
const activeFiles = new Set();
for (const record of records) {
  const body = JSON.stringify(record);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const detailPath = `/data/records/${record.id}-${sha256}.json`;
  activeFiles.add(`${record.id}-${sha256}.json`);
  await writeFile(resolve(webDirectory, "public", detailPath.slice(1)), body, "utf8");
  descriptors.push({ ...toSearchRecord(record), detailPath, sha256, bytes: Buffer.byteLength(body) });
}
await pruneGeneratedRecordFiles(resolve(webDirectory, "public/data/records"), activeFiles);
const catalog = { version: 2, siteUrl, contentHash, generatedAt, records: descriptors,
  collections: (editorial?.collections ?? []).map(collection => ({ id: collection.id, title: collection.title, recordIds: collection.recordIds.filter(id => ids.has(id)) })) };
await writeFile(resolve(webDirectory, "public/data/catalog-v2.json"), `${JSON.stringify(catalog)}\n`, "utf8");
const registry = parseKnowledgeRegistry(JSON.parse(await readFile(resolve(webDirectory, "content/knowledge.json"), "utf8")));
const knowledge = buildKnowledgePublicArtifacts(registry, records, siteUrl);
await writeFile(resolve(webDirectory, "public/data/knowledge-v1.json"), `${JSON.stringify({ version: 1, contentHash, ...knowledge })}\n`, "utf8");
for (const [path, body] of [["data/search-index.json", search], ["data/mobile-index.json", mobile], ["release.json", release]]) {
  await writeFile(resolve(webDirectory, "public", path), `${JSON.stringify(body)}\n`, "utf8");
}
await writeFile(resolve(webDirectory, "public/feed.xml"), feed, "utf8");
console.log(`Public artifacts: ${records.length} checked records, SHA ${gitSha}, content ${contentHash.slice(0, 12)}.`);
