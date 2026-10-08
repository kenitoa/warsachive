import { readFile, stat, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { isPublicRecord } from "../lib/archive-domain.ts";
import { readArchiveContent } from "./read-archive-content.mjs";
import { collectNestedRscFiles } from "./normalize-rsc-paths.mjs";
import { isPublicCatalog } from "../lib/public-catalog.ts";
import { fullLocaleRoutes } from "../lib/knowledge-localization.ts";
import { parseKnowledgeRegistry } from "../lib/knowledge-domain.ts";

const directory = resolve(process.cwd(), process.cwd().endsWith("web") ? "out" : "web/out");
const release = JSON.parse(await readFile(resolve(directory, "release.json"), "utf8"));
const publicData = JSON.parse(await readFile(resolve(directory, "data/mobile-index.json"), "utf8"));
const search = JSON.parse(await readFile(resolve(directory, "data/search-index.json"), "utf8"));
const catalog = JSON.parse(await readFile(resolve(directory, "data/catalog-v2.json"), "utf8"));
const knowledgeArtifact = JSON.parse(await readFile(resolve(directory, "data/knowledge-v1.json"), "utf8"));
const { editorial, records, publicRecords } = await readArchiveContent();
const knowledge = parseKnowledgeRegistry(knowledgeArtifact.registry, publicRecords);
const languageRoutes = fullLocaleRoutes(knowledge, publicRecords);
const routes = ["", "archive", "explore", "timeline", "collections", "stories", "about", "entities", "sources", "places", "teach", "services", "read", ...languageRoutes.map(route => route.href.slice(1, -1)), ...knowledge.entities.map(entity => `entities/${entity.id}`), ...knowledge.sources.map(source => `sources/${source.id}`), ...publicData.records.map((record) => `archive/${record.id}`), ...editorial.collections.map((collection) => `collections/${collection.id}`), ...editorial.stories.map((story) => `stories/${story.id}`)];
const problems = [];
for (const route of routes) {
  const html = await readFile(resolve(directory, route, "index.html"), "utf8");
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  const expected = `${release.siteUrl}/${route ? `${route}/` : ""}`;
  if (canonical !== expected) problems.push(`${route || "/"}: canonical ${canonical || "missing"}, expected ${expected}`);
  const language = languageRoutes.find(item => item.href.slice(1, -1) === route)?.locale ?? "ko";
  if (html.match(/<html[^>]+lang="([^"]+)"/)?.[1] !== language) problems.push(`${route}: language missing or incorrect`);
  if (!/<h1[\s>]/.test(html)) problems.push(`${route}: primary heading missing`);
  const image = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
  if (!image || !image.startsWith(`${release.siteUrl}/images/social/`)) { problems.push(`${route}: sharing image missing or outside the site`); continue; }
  const metadata = await sharp(resolve(directory, image.slice(release.siteUrl.length + 1))).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630) problems.push(`${route}: sharing image is not 1200×630`);
}
for (const path of ["sitemap.xml", "robots.txt", "manifest.webmanifest", "feed.xml"]) await stat(resolve(directory, path));
if (publicData.version !== 1 || search.version !== 1 || !publicData.records.every(isPublicRecord)) problems.push("Public response contract failed.");
if (!isPublicCatalog(catalog) || catalog.contentHash !== release.contentHash || catalog.siteUrl !== release.siteUrl || knowledgeArtifact.contentHash !== release.contentHash) problems.push("Partitioned catalog or knowledge contract failed.");
const shardNames = [];
for (const entry of catalog.records) {
  const file = entry.detailPath.slice(1); const body = await readFile(resolve(directory, file)); shardNames.push(file.split("/").at(-1));
  if (createHash("sha256").update(body).digest("hex") !== entry.sha256 || body.length !== entry.bytes) problems.push(`Shard ${entry.id} differs from its published hash or size.`);
  const record = JSON.parse(body.toString("utf8")); if (!isPublicRecord(record) || record.id !== entry.id) problems.push(`Shard ${entry.id} is not public.`);
}
if (JSON.stringify((await readdir(resolve(directory,"data/records"))).sort()) !== JSON.stringify(shardNames.sort())) problems.push("Obsolete shards remain in the public output.");
if (knowledge.localizations.some(item => item.locale !== "ko" && (item.review.status !== "approved" || !item.review.humanReviewed))) problems.push("Unapproved translation leaked into public knowledge.");
const contentHash = createHash("sha256").update(JSON.stringify(publicData.records)).digest("hex");
if (publicData.contentHash !== release.contentHash || search.contentHash !== release.contentHash || contentHash !== release.contentHash || publicData.records.length !== release.recordCount || search.records.length !== release.recordCount) problems.push("Release metadata and public/search data are inconsistent.");
if (JSON.stringify(publicData.records.map((record) => record.id)) !== JSON.stringify(publicRecords.map((record) => record.id))) problems.push("Merged publication records differ from exported records.");
for (const record of search.records) {
  for (const field of ["sources", "sourceUrl", "sourceUrls", "sections", "chronology", "review", "curator"]) if (field in record) problems.push(`Search record ${record.id} exposes ${field}.`);
}
const sitemap = await readFile(resolve(directory, "sitemap.xml"), "utf8");
const normalize = (url) => url.replace(/\/$/, "");
const sitemapUrls = new Set(Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => normalize(match[1])));
for (const route of routes) if (!sitemapUrls.has(normalize(`${release.siteUrl}/${route ? `${route}/` : ""}`))) problems.push(`${route}: sitemap entry missing`);
for (const record of records.filter((record) => !isPublicRecord(record))) if (sitemapUrls.has(normalize(`${release.siteUrl}/archive/${record.id}/`))) problems.push(`Held record ${record.id} leaked into sitemap.`);
for (const route of ["saved","account","admin","workspace","corrections","assist"]) {
  if (sitemapUrls.has(normalize(`${release.siteUrl}/${route}/`))) problems.push(`Private utility ${route} must not be in sitemap.`);
  const html = await readFile(resolve(directory, `${route}/index.html`), "utf8");
  if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) problems.push(`${route} must have noindex metadata.`);
}
for (const [path, budget] of [["images/hero-large.webp", 250_000], ["images/hero-small.webp", 100_000]]) {
  const information = await stat(resolve(directory, path));
  if (!information.size || information.size > budget) problems.push(`${path}: image performance budget exceeded`);
}
const rscCopies = await collectNestedRscFiles(directory);
for (const { source, target } of rscCopies) {
  try { if (!(await readFile(source)).equals(await readFile(target))) problems.push(`RSC segment copy differs: ${target}`); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") problems.push(`Client RSC path is missing: ${target}`); else throw error; }
}
await stat(resolve(directory, "archive/__next.archive.__PAGE__.txt"));
if (problems.length) throw new Error(problems.join("\n"));
console.log(`Static output verified: ${routes.length} routes; canonical/OG, sitemap privacy, merged public data/hash, minimal search projection, hero budgets and ${rscCopies.length} client RSC paths.`);
