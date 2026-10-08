import type { ArchiveDate, ArchiveRecord, ArchiveSection, ArchiveSource, EditorialCollection, EditorialStory, EditorialTheme, SearchRecord } from "./archive-types";

const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
export type LegacyArchiveRecord = { id: string; title: string; period: string; region: string; summary: string; sourceCount: number };
export type LoadedArchiveRecord = ArchiveRecord | LegacyArchiveRecord;
const labels: Record<string, string> = {
  battle: "전투", people: "인물", place: "장소", diplomacy: "외교",
  "primary-source": "사료", chronology: "연표", unclassified: "미분류",
  command: "지휘", civilian: "민간인의 삶", aftermath: "전후 복구"
};

export function normalizeLabels(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => labels[value.trim().toLowerCase()] ?? value.trim()).filter(Boolean))];
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host.includes(".") || host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return true;
  if (host.includes(":")) return true; // No IP literals; editorial links use public named hosts.
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return true; // Reject all IP literals, including alternative forms canonicalized by URL.
}

/** Converts only explicit public URLs or explicitly identified supplier IDs. Never guesses a supplier. */
export function normalizeSourceUrl(value: string, provider?: "internet-archive"): string | null {
  let candidate = value.trim();
  if (provider === "internet-archive" && /^[a-zA-Z0-9_.-]{1,160}$/.test(candidate)) {
    candidate = `https://archive.org/details/${encodeURIComponent(candidate)}`;
  }
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  try {
    const url = new URL(candidate);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || isPrivateHostname(url.hostname)) return null;
    if (url.port && !["80", "443"].includes(url.port)) return null;
    return url.href;
  } catch { return null; }
}

const unknownDate: ArchiveDate = { startYear: null, endYear: null, precision: "unknown" };
export function parseArchiveDate(period: string): ArchiveDate {
  const normalized = period.trim();
  const match = normalized.match(/^(기원전\s*|BCE?\s*)?(\d{1,4})(?:년)?(?:\s*[-–~∼]\s*(\d{1,4})(?:년)?)?(?:\s*(BCE?|기원전))?(\s*(?:경|무렵|c\.?))?$/i);
  if (!match) return { ...unknownDate };
  const bce = Boolean(match[1] || match[4]);
  const first = Number(match[2]);
  const second = match[3] ? Number(match[3]) : first;
  if (!first || !second) return { ...unknownDate };
  const startYear = bce ? -first : first;
  const endYear = bce ? -second : second;
  if (startYear > endYear) return { ...unknownDate };
  return { startYear, endYear, precision: match[5] ? "approximate" : match[3] ? "range" : "year" };
}

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function identifier(value: unknown): value is string { return typeof value === "string" && idPattern.test(value); }
function identifiers(value: unknown): value is string[] { return Array.isArray(value) && value.every(identifier); }
function timestamp(value: unknown): value is string {
  return text(value) && /^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}
function year(value: unknown): value is number | null { return value === null || (typeof value === "number" && Number.isInteger(value) && value !== 0 && Math.abs(value) <= 9999); }

export function isArchiveSource(value: unknown): value is ArchiveSource {
  return object(value) && identifier(value.id) && text(value.title) && text(value.creator)
    && text(value.institution) && text(value.url) && ["primary", "research", "institutional", "testimony", "media"].includes(String(value.kind))
    && text(value.language) && text(value.location) && text(value.rights) && timestamp(value.checkedAt)
    && text(value.independenceGroup) && (value.created === undefined || text(value.created));
}

export function isArchiveSection(value: unknown): value is ArchiveSection {
  return object(value) && identifier(value.id) && text(value.title) && strings(value.paragraphs)
    && value.paragraphs.length > 0 && identifiers(value.sourceIds)
    && (value.interpretation === undefined || typeof value.interpretation === "boolean");
}

export function isArchiveRecord(value: unknown): value is ArchiveRecord {
  if (!object(value) || !identifier(value.id) || !text(value.title) || !text(value.period) || !text(value.region) || !text(value.summary)
    || !["event", "source"].includes(String(value.kind)) || !text(value.language) || !strings(value.labels) || !strings(value.aliases)) return false;
  const date = value.date;
  if (!object(date) || !year(date.startYear) || !year(date.endYear) || !["day", "year", "range", "approximate", "unknown"].includes(String(date.precision))) return false;
  if ((date.startYear === null) !== (date.endYear === null) || (date.startYear !== null && date.endYear !== null && date.startYear > date.endYear)) return false;
  if ((date.precision === "unknown") !== (date.startYear === null)) return false;
  const entities = (items: unknown) => Array.isArray(items) && items.every((item) => object(item) && identifier(item.id) && text(item.name) && strings(item.aliases));
  if (!entities(value.people) || !entities(value.places)) return false;
  const review = value.review;
  if (!object(review) || !["needs-review", "source-checked", "approved", "withheld"].includes(String(review.status))
    || !text(review.reviewer) || !timestamp(review.reviewedAt) || !text(review.note) || typeof review.humanReviewed !== "boolean") return false;
  if (!Array.isArray(value.sources) || !value.sources.every(isArchiveSource) || !Array.isArray(value.sections) || !value.sections.every(isArchiveSection)) return false;
  if (!Array.isArray(value.chronology) || !value.chronology.every((item) => object(item) && text(item.date) && year(item.year) && text(item.title) && text(item.text) && identifiers(item.sourceIds))) return false;
  if (!strings(value.limitations) || !identifiers(value.relatedIds) || !identifiers(value.collectionIds)
    || !timestamp(value.publishedAt) || !timestamp(value.updatedAt) || typeof value.readingMinutes !== "number" || !Number.isInteger(value.readingMinutes) || value.readingMinutes < 1
    || typeof value.sourceCount !== "number" || !Number.isInteger(value.sourceCount) || value.sourceCount < 0) return false;
  if (!Array.isArray(value.corrections) || !value.corrections.every((item) => object(item) && timestamp(item.date) && text(item.reason))) return false;
  return (value.featuredReason === undefined || text(value.featuredReason)) && (value.sensitivity === undefined || text(value.sensitivity));
}

function hasV2Fields(value: Record<string, unknown>): boolean {
  return ["kind", "review", "date", "sources", "sections", "chronology", "language", "people", "places", "publishedAt"].some((key) => key in value);
}
export function isLegacyArchiveRecord(value: unknown): value is LegacyArchiveRecord {
  return object(value) && !hasV2Fields(value) && identifier(value.id) && text(value.title) && text(value.period)
    && text(value.region) && text(value.summary) && typeof value.sourceCount === "number"
    && Number.isInteger(value.sourceCount) && value.sourceCount >= 0;
}
/** Full v2 files and legacy files share the existing publication path, but never share validation rules. */
export function parseArchivePayload(value: unknown): LoadedArchiveRecord[] {
  const items = object(value) && "items" in value ? value.items : [value];
  if (!Array.isArray(items) || !items.length) throw new Error("Archive payload must contain a record or nonempty items array.");
  return items.map((item) => {
    if (isArchiveRecord(item)) return item;
    if (object(item) && hasV2Fields(item)) throw new Error("Invalid v2 archive record: required editorial fields do not match the contract.");
    if (isLegacyArchiveRecord(item)) return item;
    throw new Error("Invalid legacy archive record.");
  });
}
/** Editorial overlays win by ID; other valid v2 records keep all review, citation and content fields. */
export function mergeArchiveRecords(records: readonly LoadedArchiveRecord[], overlays: readonly ArchiveRecord[], holdLegacy: (record: LegacyArchiveRecord) => ArchiveRecord): ArchiveRecord[] {
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate archive record ID.");
  if (!overlays.every(isArchiveRecord) || new Set(overlays.map((record) => record.id)).size !== overlays.length) throw new Error("Invalid or duplicate editorial overlay record.");
  const overlayMap = new Map(overlays.map((record) => [record.id, record]));
  const inputIds = new Set(records.map((record) => record.id));
  const merged = records.map((record) => {
    if (!isArchiveRecord(record) && !isLegacyArchiveRecord(record)) throw new Error("Invalid archive record during merge.");
    return overlayMap.get(record.id) ?? (isArchiveRecord(record) ? record : holdLegacy(record));
  });
  return [...merged, ...overlays.filter((record) => !inputIds.has(record.id))];
}

export function toPendingArchiveRecord(record: LegacyArchiveRecord, reviewedAt: string): ArchiveRecord {
  return {
    id: record.id, title: record.title, period: "시대 검수 대기", region: "지역 검수 대기",
    summary: "이전 발행 기록의 안내 페이지입니다. 제목·본문·시대·지역 및 출처 연결을 다시 확인하고 있어 공개 탐색과 추천에서 제외했습니다.",
    kind: "source", language: "미확인", labels: ["미분류"], aliases: [],
    date: { startYear: null, endYear: null, precision: "unknown" }, people: [], places: [],
    review: { status: "needs-review", reviewer: "콘텐츠 감사", reviewedAt: reviewedAt, humanReviewed: false,
      note: "기존 자동 발행의 품질 점수는 역사적 정확성·출처 독립성·사람 승인을 의미하지 않습니다. 원본 JSON은 변경하거나 삭제하지 않았습니다." },
    sources: [], sections: [], chronology: [], limitations: ["원문의 연결 정확성과 공개 적합성을 검토하기 전까지 요약·시대·지역을 확정된 정보로 표시하지 않습니다."],
    relatedIds: [], collectionIds: [], publishedAt: reviewedAt, updatedAt: reviewedAt, readingMinutes: 1,
    sourceCount: 0, corrections: [{ date: reviewedAt, reason: "이전 ID와 원본을 유지하고, 검수 대기 안내 페이지로 전환했습니다." }]
  };
}

export function isEditorialTheme(value: unknown): value is EditorialTheme {
  return object(value) && identifier(value.id) && text(value.title) && text(value.question) && text(value.description)
    && strings(value.labels) && identifiers(value.recordIds) && value.recordIds.length > 0 && strings(value.learningQuestions);
}
export function isEditorialCollection(value: unknown): value is EditorialCollection {
  return object(value) && identifier(value.id) && text(value.title) && text(value.region) && text(value.period)
    && text(value.description) && text(value.criteria) && text(value.limitations) && identifiers(value.recordIds) && value.recordIds.length > 0
    && Array.isArray(value.steps) && value.steps.length > 0
    && value.steps.every((step) => object(step) && text(step.title) && text(step.description) && identifiers(step.recordIds) && step.recordIds.length > 0);
}
export function isEditorialStory(value: unknown): value is EditorialStory {
  return object(value) && identifier(value.id) && text(value.title) && text(value.deck) && text(value.introduction)
    && Array.isArray(value.sections) && value.sections.length > 0 && value.sections.every(isArchiveSection)
    && identifiers(value.recordIds) && value.recordIds.length > 0 && identifiers(value.sourceIds) && value.sourceIds.length > 0 && timestamp(value.updatedAt)
    && typeof value.readingMinutes === "number" && Number.isInteger(value.readingMinutes) && value.readingMinutes > 0
    && text(value.author) && text(value.reviewNote) && strings(value.learningQuestions);
}

/** Editorial approval is distinct from automated source comparison. Scores never bypass this boundary. */
export function isPublicRecord(record: ArchiveRecord): boolean {
  if (!isArchiveRecord(record) || !["source-checked", "approved"].includes(record.review.status)) return false;
  if (record.review.status === "approved" && !record.review.humanReviewed) return false;
  if (!record.sources.length || !record.sections.length || record.sources.some((source) => !normalizeSourceUrl(source.url))) return false;
  const ids = new Set(record.sources.map((source) => source.id));
  if (ids.size !== record.sources.length || record.sourceCount !== ids.size
    || new Set(record.sources.map((source) => normalizeSourceUrl(source.url))).size !== ids.size) return false;
  const grounded = (sourceIds: string[]) => sourceIds.length > 0 && sourceIds.every((id) => ids.has(id));
  return record.sections.every((section) => grounded(section.sourceIds)) && record.chronology.every((moment) => grounded(moment.sourceIds));
}

export function toSearchRecord(record: ArchiveRecord): SearchRecord {
  return {
    id: record.id, title: record.title, period: record.period, region: record.region, summary: record.summary,
    kind: record.kind, language: record.language, labels: [...record.labels], aliases: [...record.aliases], date: { ...record.date },
    people: record.people.map((person) => ({ ...person, aliases: [...person.aliases] })),
    places: record.places.map((place) => ({ ...place, aliases: [...place.aliases] })),
    updatedAt: record.updatedAt, readingMinutes: record.readingMinutes, sourceCount: record.sources.length,
    institutions: [...new Set(record.sources.map((source) => source.institution))], reviewStatus: record.review.status,
    hasOriginal: record.sources.some((source) => source.kind === "primary" && Boolean(normalizeSourceUrl(source.url)))
  };
}

export function getArchiveCounts(records: readonly ArchiveRecord[]) {
  const publicRecords = records.filter(isPublicRecord);
  const sources = publicRecords.flatMap((record) => record.sources);
  return {
    records: publicRecords.length, events: publicRecords.filter((record) => record.kind === "event").length,
    sourceRecords: publicRecords.filter((record) => record.kind === "source").length,
    registeredSources: new Set(sources.map((source) => normalizeSourceUrl(source.url))).size,
    institutions: new Set(sources.map((source) => source.institution)).size,
    independenceGroups: new Set(sources.map((source) => source.independenceGroup)).size,
    humanReviewed: publicRecords.filter((record) => record.review.humanReviewed && record.review.status === "approved").length,
    needsReview: records.filter((record) => record.review.status === "needs-review").length
  };
}
