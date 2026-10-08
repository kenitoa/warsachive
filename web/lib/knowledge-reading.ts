import type { ArchiveRecord } from "./archive-types";
import type { DigitalResource, KnowledgeLocation, KnowledgeRegistry, KnowledgeSource } from "./knowledge-types";
import { getMediaControls, publicResourceLink, validateIiifManifest } from "./knowledge-domain.ts";
import { hasApprovedKnowledgeReview } from "./knowledge-review.ts";

export type OriginalAvailability = { sourceId: string; kind: "original-and-translation" | "institution-page" | "media" | "unregistered"; label: string; url: string | null; display: boolean; download: boolean; reuse: boolean; note: string };
export function sourceAvailability(sourceId: string, registry: KnowledgeRegistry): OriginalAvailability[] {
  const resources = registry.resources.filter(resource => resource.sourceId === sourceId);
  if (!resources.length) return [{ sourceId, kind: "unregistered", label: "제공 범위 별도 확인", url: null, display: false, download: false, reuse: false, note: "자료 안내 URL만으로 원문 전문·국역·이미지 제공 여부를 확정하지 않습니다." }];
  return resources.map(resource => {
    const rights = registry.rights.find(item => item.id === resource.rightsId);
    const controls = rights ? getMediaControls(rights) : { display: false, download: false, reuse: false, reason: "이용 근거 확인 중" };
    const kind = resource.kind === "original-and-translation" ? "original-and-translation" : resource.kind === "institution-page" ? "institution-page" : "media";
    return { sourceId, kind, label: kind === "original-and-translation" ? "기관 제공 원문·국역 링크" : kind === "institution-page" ? "기관 해설·서지 안내" : "권리 검수 대상 미디어",
      url: publicResourceLink(resource, registry), display: controls.display, download: controls.download, reuse: controls.reuse,
      note: `${resource.description} ${controls.reason}` };
  });
}
export function recordTrustSummary(record: ArchiveRecord, registry: KnowledgeRegistry) {
  const sources = registry.sources.filter(source => record.sources.some(item => item.id === source.id));
  const original = sources.flatMap(source => sourceAvailability(source.id, registry)).filter(item => item.kind === "original-and-translation");
  return { recordId: record.id, humanReviewed: record.review.status === "approved" && record.review.humanReviewed,
    reviewLabel: record.review.status === "approved" && record.review.humanReviewed ? "이 기록 버전의 사람 승인 완료" : "출처 대조 · 사람 최종 검수 대기",
    scope: record.kind === "event" ? "사건의 흐름을 설명하는 편집 기록" : "사료의 서지·작성 맥락을 안내하는 편집 기록",
    sections: record.sections.length, linkedSources: record.sources.length, provenanceGroups: new Set(record.sources.map(source => source.independenceGroup)).size,
    originalLinks: original.length, interpretationSections: record.sections.filter(section => section.interpretation).length,
    firstLimitation: record.limitations[0] ?? "세부 확인 범위는 출처와 검수 기록을 확인하세요.",
    disclaimer: "출처의 수와 자료 계통 그룹 수는 독립 증언 수나 사실 정확도 점수가 아닙니다." };
}
export function sourceIndependence(source: KnowledgeSource, registry: KnowledgeRegistry) {
  const shared = registry.sources.filter(item => item.provenanceGroup === source.provenanceGroup && item.id !== source.id);
  return { group: source.provenanceGroup, shared: shared.map(item => ({ id: item.id, title: item.title })), note: "같은 자료 계통이나 등록 자료에 기반한 안내를 독립 증언으로 중복 계산하지 않습니다." };
}
/** A registry URL is displayed only when the resource and its independently reviewed rights allow it. */
export function approvedIiifResource(resource: DigitalResource, registry: KnowledgeRegistry): boolean {
  const rights = registry.rights.find(item => item.id === resource.rightsId);
  if (!(resource.kind === "iiif" && hasApprovedKnowledgeReview(resource.review, "rights")
    && resource.iiifManifest && resource.iiifManifestJson && rights && getMediaControls(rights).display)) return false;
  try { return validateIiifManifest(resource.iiifManifestJson).id === resource.iiifManifest; } catch { return false; }
}
export function verifiedCoordinates(locations: KnowledgeLocation[], sources: KnowledgeSource[]) {
  return locations.filter(location => location.coordinate && hasApprovedKnowledgeReview(location.review, "geography")
    && sources.some(source => source.id === location.coordinate?.sourceId) && location.evidence.some(reference => reference.sourceId === location.coordinate?.sourceId));
}
export function readingLens(records: readonly ArchiveRecord[], label: string) {
  const matching = records.filter(record => record.labels.includes(label));
  return { label, records: matching.map(record => ({ id: record.id, title: record.title })),
    note: matching.length ? "확인한 편집 기록의 분류를 따라 질문을 시작합니다. 직접 증언이나 주제 전체의 수집을 뜻하지 않습니다." : "현재 공개 자료에서 이 관점을 다룬 근거 연결 기록이 없습니다. 사건 설명으로 채우지 않습니다." };
}
