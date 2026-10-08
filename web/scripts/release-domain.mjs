import { createHash } from "node:crypto";

export function createReleaseMetadata(records, siteUrl, gitSha, generatedAt, mode = "local") {
  const normalized = siteUrl.replace(/\/$/, "");
  const parsed = new URL(normalized);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Invalid public site URL.");
  if (!/^[a-f0-9]{40}$/i.test(gitSha) && gitSha !== "uncommitted") throw new Error("Release SHA must identify a complete commit.");
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error("Release time must be a valid date.");
  const contentHash = createHash("sha256").update(JSON.stringify(records)).digest("hex");
  return { version: 1, gitSha, contentHash, generatedAt, siteUrl: normalized, basePath: parsed.pathname.replace(/\/$/, ""), recordCount: records.length, mode };
}
