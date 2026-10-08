import { createHash } from "node:crypto";

const raw = process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL;
const expectedSha = process.argv[3] || process.env.ARCHIVE_RELEASE_SHA || process.env.GITHUB_SHA;
if (!raw || !expectedSha) throw new Error("Usage: node post-deploy-smoke.mjs SITE_URL EXPECTED_SHA");
const siteUrl = raw.replace(/\/$/, "");
const parsed = new URL(siteUrl);
if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Deployment smoke requires an HTTPS site URL.");

async function fetchChecked(path) {
  const response = await fetch(`${siteUrl}${path}${path.includes("?") ? "&" : "?"}release=${encodeURIComponent(expectedSha)}`, { signal: AbortSignal.timeout(10_000), redirect: "error", headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`Deployment path ${path} returned ${response.status}.`);
  return response;
}
let release;
let reason = "Release metadata is unavailable.";
for (let attempt = 0; attempt < 18; attempt++) {
  try {
    const candidate = await (await fetchChecked("/release.json")).json();
    if (candidate.gitSha === expectedSha && candidate.siteUrl === siteUrl) { release = candidate; break; }
    reason = `Expected SHA ${expectedSha}; saw ${candidate.gitSha || "missing"}.`;
  } catch (error) { reason = error instanceof Error ? error.message : "Release fetch failed."; }
  await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
}
if (!release) throw new Error(reason);
for (const path of ["/", "/archive/", "/about/", "/sitemap.xml", "/robots.txt", "/feed.xml", "/data/search-index.json"]) await fetchChecked(path);
const data = await (await fetchChecked("/data/mobile-index.json")).json();
if (data.contentHash !== release.contentHash || data.records.length !== release.recordCount || createHash("sha256").update(JSON.stringify(data.records)).digest("hex") !== release.contentHash) throw new Error("Published content and release metadata differ.");
if (data.records[0]) await fetchChecked(`/archive/${data.records[0].id}/`);
console.log(JSON.stringify({ operation: "post_deploy_smoke", status: "passed", siteUrl, gitSha: release.gitSha, contentHash: release.contentHash, recordCount: release.recordCount }));
