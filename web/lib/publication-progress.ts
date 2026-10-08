export type PublicationStage = "export" | "build" | "deploy" | "feed";
export type PublicationReleaseStage = Exclude<PublicationStage, "export">;
export interface PublicationStageEvidence {
  id: string;
  revision: number;
  contentHash: string;
  stage: PublicationStage;
  commitSha: string | null;
  artifactHash: string;
  url: string | null;
  observedAt: string;
  evidenceSource: string;
}
export interface PublicationSnapshot {
  recordId: string;
  revision: number;
  contentHash: string;
  stages: PublicationStageEvidence[];
}
export interface PublicationRelease {
  key: string;
  commitSha: string;
  artifactHash: string;
  latestObservedAt: string;
  stages: Partial<Record<PublicationReleaseStage, PublicationStageEvidence>>;
}

const sha256 = /^[a-f0-9]{64}$/;
const commitHash = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
function invalid(): never { throw new Error("발행 단계 응답 형식이 올바르지 않습니다."); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.length || value.length > max) return invalid();
  return value;
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return invalid();
  return value;
}
function hash(value: unknown): string { const result = text(value, 64); if (!sha256.test(result)) return invalid(); return result; }
function evidence(value: unknown): PublicationStageEvidence {
  const input = object(value);
  if (typeof input.stage !== "string" || !["export", "build", "deploy", "feed"].includes(input.stage)) return invalid();
  const stage = input.stage as PublicationStage;
  const commitSha = input.commitSha == null ? null : text(input.commitSha, 64);
  if ((stage !== "export" && !commitSha) || (commitSha && !commitHash.test(commitSha))) return invalid();
  const observedAt = text(input.observedAt, 100);
  if (!Number.isFinite(Date.parse(observedAt))) return invalid();
  let url: string | null = null;
  if (input.url != null) {
    url = text(input.url, 2000);
    let address: URL; try { address = new URL(url); } catch { return invalid(); }
    if (address.protocol !== "https:" || address.username || address.password) return invalid();
  }
  return { id: text(input.id, 100), revision: revision(input.revision), contentHash: hash(input.contentHash), stage, commitSha, artifactHash: hash(input.artifactHash), url, observedAt, evidenceSource: text(input.evidenceSource, 200) };
}
export function decodePublicationSnapshot(value: unknown): PublicationSnapshot {
  const input = object(value);
  if (!Array.isArray(input.stages) || input.stages.length > 500) return invalid();
  return { recordId: text(input.recordId, 100), revision: revision(input.revision), contentHash: hash(input.contentHash), stages: input.stages.map(evidence) };
}

/** Current-record evidence is shared only by exports; release stages share both hashes. */
export function publicationProgress(snapshot: PublicationSnapshot): { exportEvidence: PublicationStageEvidence | null; releases: PublicationRelease[] } {
  const current = snapshot.stages.filter(item => item.revision === snapshot.revision && item.contentHash === snapshot.contentHash);
  const newestFirst = (left: PublicationStageEvidence, right: PublicationStageEvidence) => Date.parse(right.observedAt) - Date.parse(left.observedAt) || left.id.localeCompare(right.id);
  let exportEvidence: PublicationStageEvidence | null = null;
  const byRelease = new Map<string, PublicationRelease>();
  for (const item of [...current].sort(newestFirst)) {
    if (item.stage === "export") { exportEvidence ??= item; continue; }
    if (!item.commitSha) continue;
    const key = `${item.commitSha}:${item.artifactHash}`;
    let release = byRelease.get(key);
    if (!release) {
      release = { key, commitSha: item.commitSha, artifactHash: item.artifactHash, latestObservedAt: item.observedAt, stages: {} };
      byRelease.set(key, release);
    }
    release.stages[item.stage] ??= item;
  }
  const releases = [...byRelease.values()].sort((left, right) => Date.parse(right.latestObservedAt) - Date.parse(left.latestObservedAt) || left.key.localeCompare(right.key));
  return { exportEvidence, releases };
}
export function selectedPublicationRelease(releases: PublicationRelease[], selectedKey: string): PublicationRelease | null {
  return releases.find(item => item.key === selectedKey) ?? releases[0] ?? null;
}
