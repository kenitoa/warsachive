import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getArchiveCounts, isArchiveRecord, isLegacyArchiveRecord, isPublicRecord, mergeArchiveRecords, normalizeSourceUrl, parseArchivePayload, toPendingArchiveRecord } from "../lib/archive-domain.ts";

const contentDirectory = fileURLToPath(new URL("../content/", import.meta.url));
const index = JSON.parse(readFileSync(resolve(contentDirectory, "main.json"), "utf8"));
const editorial = JSON.parse(readFileSync(resolve(contentDirectory, "editorial.json"), "utf8"));
const baseline = JSON.parse(readFileSync(resolve(contentDirectory, "legacy-manifest.json"), "utf8"));
if (baseline.version !== 1 || !Array.isArray(baseline.files)) throw new Error("Legacy preservation manifest is invalid.");
const baselineHashes = new Map(baseline.files.map((entry) => [entry.path, entry.sha256]));
if (editorial.version !== 1 || !Array.isArray(editorial.records) || !editorial.records.every(isArchiveRecord)) throw new Error("Editorial record validation failed.");
const originals = index.published.flatMap((file) => {
  if (!/^archive\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(file)) throw new Error("Invalid archive path.");
  const bytes = readFileSync(resolve(contentDirectory, file));
  const payload = JSON.parse(bytes.toString("utf8"));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return parseArchivePayload(payload).map((record) => ({ file, record, sha256 }));
});
const mergedRecords = mergeArchiveRecords(originals.map(({ record }) => record), editorial.records,
  (record) => toPendingArchiveRecord(record, baseline.capturedAt));
const effectiveRecords = new Map(mergedRecords.map((record) => [record.id, record]));
const titles = new Map();
for (const { record } of originals) titles.set(record.title, (titles.get(record.title) ?? 0) + 1);
const overlays = new Map(editorial.records.map((record) => [record.id, record]));
const knownMismatches = {
  "expert-gamer-issue-77-november-2000": "제목은 게임 잡지인데 요약에는 Victoria 지역사·타밀어 서지가 혼합되어 있어 원문 연결 검수가 필요합니다.",
  "bhm365-special-interview-melvin-forbes-president-and-ceo": "현대 인터뷰 제목과 1592–1598/조선과 동아시아 분류의 연결을 확인해야 합니다.",
  "oral-history-interviews-kenneth-pedde": "구술사 제목과 1592–1598/조선과 동아시아 분류의 연결을 확인해야 합니다.",
  "an-impeachment-trial-update-2": "탄핵 재판 제목과 1944년 신문·역사 사이트 소개가 섞인 요약의 연결을 확인해야 합니다."
};
const records = originals.map(({ file, record, sha256 }) => {
  const fullContract = isArchiveRecord(record);
  const urls = fullContract ? record.sources.map((source) => source.url)
    : Array.isArray(record.sourceUrls) ? record.sourceUrls : record.sourceUrl ? [record.sourceUrl] : [];
  const normalized = urls.filter((url) => typeof url === "string").map((url) => normalizeSourceUrl(url));
  const issues = fullContract ? [] : ["기존 자동 발행 점수는 내용 검수·사람 승인·독립 근거 확인을 대신하지 않습니다."];
  if (record.period === "미분류") issues.push("사건/자료 시기 미분류");
  if (record.region === "전세계") issues.push("구체적인 역사 지역 미분류");
  if (titles.get(record.title) > 1) issues.push("동일 제목 다른 ID 존재: 동일 자료 여부 수동 검토 필요");
  if (normalized.some((url) => url === null)) issues.push("공급자 ID·내부 씨드·유효하지 않은 링크가 출처 URL에 포함됨");
  if (urls.some((url) => typeof url === "string" && url.startsWith("internal://"))) issues.push("내부 씨드 자료 포함: 외부 근거와 구분 필요");
  if (knownMismatches[record.id]) issues.push(knownMismatches[record.id]);
  const originalPreserved = baselineHashes.has(file) ? baselineHashes.get(file) === sha256 : null;
  if (originalPreserved === false) issues.push("기존 원본 SHA256이 보존 기준과 다릅니다. 변경 사유와 복구를 검토해야 합니다.");
  const overlay = overlays.get(record.id);
  const effective = effectiveRecords.get(record.id);
  const publicRecord = isPublicRecord(effective);
  if (fullContract && !publicRecord) issues.push("v2 계약은 유지되지만 검수 상태 또는 근거 연결의 공개 조건을 충족하지 않습니다.");
  return {
    id: record.id, file, title: record.title,
    originalMetadata: { period: record.period, region: record.region, registeredSources: record.sourceCount, qualityScore: record.qualityScore ?? null },
    originalUrlCounts: { total: urls.length, publicUrlCandidates: normalized.filter(Boolean).length, unresolved: normalized.filter((url) => url === null).length },
    contract: fullContract ? "v2" : "legacy", public: publicRecord,
    status: overlay ? effective.review.status + "-overlay" : fullContract ? effective.review.status + "-file" : "needs-review",
    originalPreserved, sha256, expectedRoute: "/archive/" + record.id + "/", humanReviewed: effective.review.humanReviewed,
    issues, action: overlay ? "원본 보존·별도 편집본 제공·검수 상태에 따라 공개"
      : fullContract ? (publicRecord ? "v2 계약·출처·검수 상태 보존·공개 탐색 포함" : "v2 계약과 ID 보존·공개 조건에 따라 검수 안내 제공")
      : "원본과 ID 보존·검수 안내 페이지 제공·공개 탐색 제외"
  };
});
const approvedHosts = new Set(["contents.history.go.kr", "sillok.history.go.kr", "encykorea.aks.ac.kr", "www.unesco.org", "www.unescoicdh.org"]);
export function allowedAuditUrl(value) {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  return url.protocol === "https:" && approvedHosts.has(url.hostname) ? url.href : null;
}
async function checkLink(source) {
  const initial = allowedAuditUrl(source.url);
  if (!initial) return { sourceId: source.id, status: "blocked-by-allowlist" };
  let target = initial;
  try {
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      const response = await fetch(target, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html", "User-Agent": "WarsArchive-ContentAudit/1.0" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        const next = location ? allowedAuditUrl(new URL(location, target).href) : null;
        if (!next) return { sourceId: source.id, status: "redirect-blocked", httpStatus: response.status };
        target = next; continue;
      }
      await response.body?.cancel();
      return { sourceId: source.id, status: response.ok ? "http-accessible" : "http-error", httpStatus: response.status, checkedAt: new Date().toISOString(), note: "HTTP 도달성 검사입니다. 내용 정확성·원문 권리·사람 승인을 입증하지 않습니다." };
    }
    return { sourceId: source.id, status: "redirect-limit" };
  } catch (error) {
    return { sourceId: source.id, status: "unverified", reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network-or-certificate-error" };
  }
}
const sources = [...new Map(mergedRecords.filter(isPublicRecord).flatMap((record) => record.sources).map((source) => [source.id, source])).values()];
const linkChecks = [];
if (process.argv.includes("--check-links")) {
  // Only reviewed institution hosts are fetched. Legacy URLs never trigger network requests.
  for (let offset = 0; offset < sources.length; offset += 3) linkChecks.push(...await Promise.all(sources.slice(offset, offset + 3).map(checkLink)));
}
const report = {
  version: 1, generatedAt: new Date().toISOString(),
  summary: { legacyRecords: originals.filter(({ record }) => isLegacyArchiveRecord(record)).length,
    fullContractRecords: originals.filter(({ record }) => isArchiveRecord(record)).length,
    archivedFileRecords: originals.length,
    originalFilesPreserved: baseline.files.every((entry) => originals.some((original) => original.file === entry.path && original.sha256 === entry.sha256)),
    baselineFiles: baseline.files.length, legacyIdsRetained: records.filter((record) => record.contract === "legacy").length,
    legacyNeedsReview: records.filter((record) => record.contract === "legacy" && record.status === "needs-review").length,
    sourceCheckedOverlays: records.filter((record) => record.status === "source-checked-overlay").length,
    ...getArchiveCounts(mergedRecords),
    sourceAccess: "초기 편집 출처 8개는 2026-10-07 브라우징으로 내용 확인. 선택적 HTTP 검사는 공개 조건을 충족한 v2·편집본의 허용 기관 링크만 검사하며, 이전 2,645개 링크나 이후 발행 내용의 사실성을 검증했다는 의미가 아닙니다." },
  records, linkChecks
};
writeFileSync(resolve(contentDirectory, "audit-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ...report.summary, linkChecks: linkChecks.map((check) => ({ sourceId: check.sourceId, status: check.status })), report: "web/content/audit-report.json" }, null, 2));
