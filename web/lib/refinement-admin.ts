import type { ArchiveRecord } from "./archive-types";
import { isArchiveRecord, normalizeSourceUrl } from "./archive-domain.ts";
import { apiNumber, apiObject, apiString } from "./api-client.ts";

export type EditorialDraft = { id: string; version: number; record: ArchiveRecord; state: string; contentHash: string; approvedHash: string; updatedAt: string; privateNotes: string };
export function decodeEditorialDraft(value: unknown): EditorialDraft {
  const item = apiObject(value);
  if (!isArchiveRecord(item.record)) throw new Error("초안의 자료 계약을 확인할 수 없습니다.");
  return { id: apiString(item.id, 100), version: apiNumber(item.version), record: item.record, state: apiString(item.state, 80), contentHash: apiString(item.contentHash, 200), approvedHash: typeof item.approvedHash === "string" ? item.approvedHash : "", updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "", privateNotes: typeof item.privateNotes === "string" ? item.privateNotes : "" };
}
export type RecordIssue = { target: string; message: string };
export function cleanRecordEditor(record: ArchiveRecord): ArchiveRecord {
  const lines = (items: string[]) => items.map(item => item.trim()).filter(Boolean);
  return { ...record, labels: lines(record.labels), aliases: lines(record.aliases), limitations: lines(record.limitations), relatedIds: lines(record.relatedIds), collectionIds: lines(record.collectionIds), people: record.people.map(item => ({ ...item, aliases: lines(item.aliases) })), places: record.places.map(item => ({ ...item, aliases: lines(item.aliases) })), sourceCount: record.sources.length };
}
export function recordEditorIssues(record: ArchiveRecord): RecordIssue[] {
  const issues: RecordIssue[] = [];
  const required: [string, string][] = [["id", "고유 ID"], ["title", "제목"], ["summary", "요약"], ["period", "시대"], ["region", "지역"], ["language", "자료 언어"]];
  for (const [key, label] of required) if (!String(record[key as keyof ArchiveRecord] ?? "").trim()) issues.push({ target: `cms-${key}`, message: `${label}을 입력하세요.` });
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(record.id)) issues.push({ target: "cms-id", message: "ID는 영문·숫자·밑줄·하이픈 1~80자로 입력하세요." });
  if (record.date.precision !== "unknown" && (record.date.startYear === null || record.date.endYear === null || record.date.startYear === 0 || record.date.endYear === 0 || record.date.startYear > record.date.endYear)) issues.push({ target: "cms-date", message: "확인된 연도 범위와 정밀도를 확인하세요. 연도 미확인은 별도로 선택할 수 있습니다." });
  const sourceIds = new Set(record.sources.map(source => source.id));
  if (sourceIds.size !== record.sources.length) issues.push({ target: "cms-sources", message: "자료 ID가 중복됩니다." });
  record.sources.forEach((source, index) => {
    if (!source.id.trim() || !source.title.trim() || !source.creator.trim() || !source.institution.trim() || !source.location.trim() || !source.rights.trim() || !source.independenceGroup.trim() || !normalizeSourceUrl(source.url)) issues.push({ target: `cms-source-${index}`, message: `자료 ${index + 1}: ID·제목·제작자·기관·공개 URL·위치·권리·독립 자료 그룹을 확인하세요.` });
  });
  if (new Set(record.sections.map(section => section.id)).size !== record.sections.length) issues.push({ target: "cms-sections", message: "본문 문단 그룹 ID가 중복됩니다." });
  record.sections.forEach((section, index) => {
    if (!section.id.trim() || !section.title.trim() || !section.paragraphs.length || section.paragraphs.some(paragraph => !paragraph.trim())) issues.push({ target: `cms-section-${index}`, message: `본문 ${index + 1}: 고유 ID·제목·내용을 입력하세요.` });
    if (section.sourceIds.some(id => !sourceIds.has(id))) issues.push({ target: `cms-section-${index}`, message: `본문 ${index + 1}에 등록되지 않은 자료가 연결되어 있습니다.` });
  });
  record.chronology.forEach((moment, index) => { if (!moment.date.trim() || !moment.title.trim() || !moment.text.trim() || moment.sourceIds.some(id => !sourceIds.has(id))) issues.push({ target: "cms-chronology", message: `연표 ${index + 1}의 시점·제목·설명·근거를 확인하세요.` }); });
  if (!isArchiveRecord(record) && !issues.length) issues.push({ target: "cms-basics", message: "자료 계약의 날짜·문자열·필수 항목을 확인하세요. 비어 있는 줄은 제거하세요." });
  return issues;
}
export function blankEditorialRecord(now: string): ArchiveRecord {
  return { id: "", title: "", period: "", region: "", summary: "", kind: "event", language: "", labels: [], aliases: [], date: { startYear: null, endYear: null, precision: "unknown" }, people: [], places: [], review: { status: "needs-review", reviewer: "검수 대기", reviewedAt: now, note: "비공개 편집 초안", humanReviewed: false }, sources: [], sections: [], chronology: [], limitations: [], relatedIds: [], collectionIds: [], publishedAt: now, updatedAt: now, readingMinutes: 1, corrections: [], sourceCount: 0 };
}
/** Keeps incomplete form input recoverable; final saving still uses isArchiveRecord and server validation. */
export function editableRecord(value: unknown): ArchiveRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!raw.date || typeof raw.date !== "object" || Array.isArray(raw.date)) return null;
  const date = raw.date as Record<string, unknown>;
  if (![date.startYear, date.endYear].every(year => year === null || typeof year === "number" && Number.isFinite(year))) return null;
  const filled = (entry: unknown, key = ""): unknown => {
    if (typeof entry === "string") return ["checkedAt", "reviewedAt", "publishedAt", "updatedAt", "date"].includes(key) ? "2000-01-01T00:00:00Z" : key === "id" ? "pending" : entry.trim().length ? entry : "pending";
    if (key === "date" && entry && typeof entry === "object") return { startYear: null, endYear: null, precision: "unknown" };
    if (typeof entry === "number" && ["readingMinutes", "sourceCount", "year"].includes(key)) return 1;
    if (Array.isArray(entry)) return entry.map(item => typeof item === "string" && ["sourceIds", "relatedIds", "collectionIds"].includes(key) ? "pending" : filled(item));
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).map(([name, item]) => [name, filled(item, name)]));
    return entry;
  };
  if (!isArchiveRecord(filled(value))) return null;
  return value as ArchiveRecord;
}
export type EditorialChange = { field: string; before: string; after: string };
const fieldLabels: Record<string, string> = { title: "제목", summary: "요약", period: "시대", region: "지역", kind: "자료 종류", language: "자료 언어", labels: "주제", aliases: "별칭", date: "연대", people: "인물", places: "장소", sources: "자료·권리", sections: "본문·근거", chronology: "연표", limitations: "한계", relatedIds: "관련 기록", collectionIds: "컬렉션", readingMinutes: "읽기 시간", featuredReason: "추천 이유", sensitivity: "민감성 안내", corrections: "정정 이력" };
function display(value: unknown): string { return value === undefined ? "없음" : typeof value === "string" ? value || "비어 있음" : JSON.stringify(value, null, 2); }
export function editorialChanges(before: ArchiveRecord, after: ArchiveRecord): EditorialChange[] {
  const changes: EditorialChange[] = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    const a = before[key as keyof ArchiveRecord]; const b = after[key as keyof ArchiveRecord];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (["sections", "sources"].includes(key) && Array.isArray(a) && Array.isArray(b)) {
      const aItems = a as { id: string }[]; const bItems = b as { id: string }[];
      const ids = new Set([...aItems.map(item => item.id), ...bItems.map(item => item.id)]);
      for (const id of ids) { const oldItem = aItems.find(item => item.id === id); const newItem = bItems.find(item => item.id === id); if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) changes.push({ field: `${label} · ${id}`, before: display(oldItem), after: display(newItem) }); }
      if (aItems.map(item => item.id).join(",") !== bItems.map(item => item.id).join(",")) changes.push({ field: `${label} 순서`, before: aItems.map(item => item.id).join(" → "), after: bItems.map(item => item.id).join(" → ") });
    } else changes.push({ field: label, before: display(a), after: display(b) });
  }
  return changes;
}
