import type { ArchiveRecord } from "./archive-types";
import { localizedUiKeys, type FullRecordLocalization, type KnowledgeArchiveRecord, type KnowledgeLocalization, type KnowledgeRegistry } from "./knowledge-types.ts";
import { sha256Text } from "./public-catalog.ts";
import { hasApprovedKnowledgeReview } from "./knowledge-review.ts";

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, limit = 8000): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= limit; }
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const slug = (value: unknown) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/.test(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key)) && keys.every(key => key in value);
function validApprovalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)) return false;
  const date = new Date(value); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}
export function isFullRecordLocalization(value: unknown): value is FullRecordLocalization {
  if (!object(value) || !exact(value, ["scope", "sourceContentHash", "sourceParagraphVersions", "sections", "chronology", "limitations", "translator", "reviewer", "approvedAt", "ui"])) return false;
  return value.scope === "full-record" && hash(value.sourceContentHash) && text(value.translator, 200) && text(value.reviewer, 200) && value.translator !== value.reviewer
    && validApprovalDate(value.approvedAt)
    && object(value.ui) && exact(value.ui, localizedUiKeys) && Object.values(value.ui).every(label => text(label, 2000))
    && Array.isArray(value.sourceParagraphVersions) && value.sourceParagraphVersions.length <= 5000 && value.sourceParagraphVersions.every(item => object(item) && exact(item, ["sectionId", "paragraphIndex", "sourceHash", "sourceVersion"]) && slug(item.sectionId) && typeof item.paragraphIndex === "number" && Number.isSafeInteger(item.paragraphIndex) && item.paragraphIndex >= 0 && hash(item.sourceHash) && text(item.sourceVersion, 100))
    && Array.isArray(value.sections) && value.sections.length > 0 && value.sections.length <= 500 && value.sections.every(item => object(item) && exact(item, ["id", "title", "paragraphs"]) && slug(item.id) && text(item.title) && Array.isArray(item.paragraphs) && item.paragraphs.length > 0 && item.paragraphs.length <= 500 && item.paragraphs.every(paragraph => text(paragraph)))
    && new Set(value.sections.map(item => item.id)).size === value.sections.length
    && Array.isArray(value.chronology) && value.chronology.length <= 500 && value.chronology.every(item => object(item) && exact(item, ["index", "title", "text"]) && typeof item.index === "number" && Number.isSafeInteger(item.index) && item.index >= 0 && text(item.title) && text(item.text))
    && new Set(value.chronology.map(item => item.index)).size === value.chronology.length
    && Array.isArray(value.limitations) && value.limitations.length > 0 && value.limitations.length <= 100 && value.limitations.every(item => text(item));
}
/** The fingerprint covers body, dates, qualifications and source identity, including same-day edits. */
export function localizationSourceHash(record: KnowledgeArchiveRecord): string | null {
  if (!record.sections || !record.chronology || !record.limitations) return null;
  return sha256Text(JSON.stringify({ title: record.title, summary: record.summary, sections: record.sections, chronology: record.chronology, limitations: record.limitations, sources: record.sources }));
}
export function localizationParagraphVersions(record: ArchiveRecord) {
  return record.sections.flatMap(section => section.paragraphs.map((paragraph, paragraphIndex) => ({ sectionId: section.id, paragraphIndex, sourceHash: sha256Text(paragraph), sourceVersion: record.updatedAt })));
}
export function fullLocalizationProblems(locale: KnowledgeLocalization, record: KnowledgeArchiveRecord): string[] {
  const full = locale.full; const problems: string[] = [];
  if (!full || !isFullRecordLocalization(full)) return ["승인 범위가 전체 본문·메뉴·오류·도움말 계약을 충족하지 않습니다."];
  if (locale.status !== "approved" || !hasApprovedKnowledgeReview(locale.review, "translation")) problems.push("실제 사람 번역 승인이 필요합니다.");
  if (locale.sourceVersion !== record.updatedAt || locale.sourceIdentity.title !== record.title || locale.sourceIdentity.summary !== record.summary) problems.push("번역의 원본 버전이 변경되었습니다.");
  if (localizationSourceHash(record) !== full.sourceContentHash) problems.push("본문·근거·날짜·한계가 번역 승인 버전과 다릅니다.");
  if (locale.review.checkedBy !== full.reviewer) problems.push("번역 검수자와 승인 기록이 다릅니다.");
  if (!record.sections || !record.chronology || !record.limitations) return [...problems, "전체 원본이 필요합니다."];
  if (full.sections.length !== record.sections.length || record.sections.some((section, index) => full.sections[index]?.id !== section.id || full.sections[index]?.paragraphs.length !== section.paragraphs.length)) problems.push("번역 본문의 문단 대응이 다릅니다.");
  const expected = record.sections.flatMap(section => section.paragraphs.map((paragraph, paragraphIndex) => ({ sectionId: section.id, paragraphIndex, sourceHash: sha256Text(paragraph), sourceVersion: record.updatedAt })));
  if (JSON.stringify(full.sourceParagraphVersions) !== JSON.stringify(expected)) problems.push("문단별 원본 버전을 다시 확인하세요.");
  if (full.chronology.length !== record.chronology.length || record.chronology.some((_, index) => !full.chronology.some(item => item.index === index))) problems.push("연표 설명의 번역 범위가 다릅니다.");
  if (full.limitations.length !== record.limitations.length) problems.push("한계 설명의 번역 범위가 다릅니다.");
  return problems;
}
export function getFullLocalization(registry: KnowledgeRegistry, record: KnowledgeArchiveRecord, locale: string): KnowledgeLocalization & { full: FullRecordLocalization } | null {
  const entry = registry.localizations.find(item => item.recordId === record.id && item.locale === locale);
  return entry?.full && fullLocalizationProblems(entry, record).length === 0 ? { ...entry, full: entry.full } : null;
}
export function fullLocaleRoutes(registry: KnowledgeRegistry, records: KnowledgeArchiveRecord[]) {
  return registry.localizations.flatMap(entry => {
    const record = records.find(item => item.id === entry.recordId); const published = record && getFullLocalization(registry, record, entry.locale);
    return published ? [{ recordId: record.id, locale: published.locale, href: `/read/${published.locale}/${record.id}/`, sourceVersion: published.sourceVersion, scope: "full-record" as const }] : [];
  });
}
