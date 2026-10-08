import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicRecord } from "../lib/archive-domain.ts";
import { readArchiveContent } from "./read-archive-content.mjs";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../content");
const { records } = await readArchiveContent();
const hosts = new Set((process.env.ARCHIVE_SOURCE_HOSTS || "encykorea.aks.ac.kr,www.encykorea.aks.ac.kr,www.archives.go.kr,archives.go.kr,contents.history.go.kr,db.history.go.kr,sillok.history.go.kr,www.history.go.kr,www.loc.gov,loc.gov,archive.org,www.unesco.org,www.unescoicdh.org").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));

export function isPublicAddress(address) {
  if (isIP(address) === 6) return /^[23][0-9a-f]{0,3}:/i.test(address);
  if (isIP(address) !== 4) return false;
  const [first, second, third] = address.split(".").map(Number);
  return first !== 0 && first !== 10 && first !== 127 && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && (second === 168 || second === 0 || (second === 2)))
    && !(first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100)))
    && !(first === 203 && second === 0 && third === 113);
}

async function checkUrl(raw, redirects = 0) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !hosts.has(url.hostname.toLowerCase())) {
    return { status: "blocked", reason: "URL must use HTTPS and an explicitly approved source host." };
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    return { status: "blocked", reason: "Source DNS must resolve only to public IP addresses." };
  }
  const selected = addresses[0];
  async function probe(method) { return new Promise((resolveResponse, reject) => {
    const outgoing = request(url, {
      method,
      timeout: 8_000,
      headers: { "User-Agent": "WarArchive-LinkCheck/1.0", Accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", ...(method === "GET" ? { Range: "bytes=0-4095" } : {}) },
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      }
    }, (incoming) => {
      const value = { statusCode: incoming.statusCode || 0, location: incoming.headers.location };
      resolveResponse(value);
      // Only status and redirect headers are needed; never download the source body.
      if (method === "GET") incoming.destroy();
      else incoming.resume();
    });
    outgoing.on("timeout", () => outgoing.destroy(new Error("Source request timed out.")));
    outgoing.on("error", reject);
    outgoing.end();
  }); }
  let response = await probe("HEAD");
  if ([405, 501].includes(response.statusCode)) response = await probe("GET");
  if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.location) {
    if (redirects >= 3) return { status: "failed", reason: "Too many redirects." };
    return checkUrl(new URL(response.location, url).toString(), redirects + 1);
  }
  if (response.statusCode >= 200 && response.statusCode < 300) return { status: "reachable", httpStatus: response.statusCode };
  return { status: "needs-check", httpStatus: response.statusCode, reason: "HTTP status needs manual verification; blocked HEAD is not proof of a broken source." };
}

const urls = [...new Set(records.filter(isPublicRecord).flatMap((record) => record.sources.map((source) => source.url)))];
const checks = [];
for (const url of urls) {
  try { checks.push({ url, checkedAt: new Date().toISOString(), ...(await checkUrl(url)) }); }
  catch (error) { checks.push({ url, checkedAt: new Date().toISOString(), status: "unknown", reason: error instanceof Error ? error.message : "Source check failed." }); }
}
const report = { version: 1, generatedAt: new Date().toISOString(), hosts: [...hosts], checks };
await writeFile(resolve(directory, "link-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ operation: "source_link_check", checked: checks.length, reachable: checks.filter((check) => check.status === "reachable").length, attention: checks.filter((check) => check.status !== "reachable").length }));
if (process.argv.includes("--strict") && checks.some((check) => check.status !== "reachable")) process.exitCode = 1;
