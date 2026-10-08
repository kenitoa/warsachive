import type { ArchiveRecord, SearchRecord } from "./archive-types";
import type { KnowledgeRegistry } from "./knowledge-types";
import { isKnowledgePublic } from "./knowledge-domain.ts";
import { defaultSearch, normalizeSearch, parseSearch, searchRecords, serializeSearch, type SearchState } from "./search.ts";

export type SearchTarget = "all" | "record" | "source" | "entity" | "place";
export type KnowledgeSearchItem = {
  id: string; target: Exclude<SearchTarget, "all">; kind: string; title: string;
  aliases: string[]; description: string; provider: string; locator: string;
  href: string; recordIds: string[]; review: "source-checked" | "approved";
};
export type UnifiedSearchState = SearchState & { target: SearchTarget };
export type KnowledgeSearchResult = KnowledgeSearchItem & { why: string; score: number };
export const defaultUnifiedSearch: UnifiedSearchState = { ...defaultSearch, target: "all" };
export const searchTargetLabels: Record<SearchTarget, string> = { all: "전체 자료", record: "기록", source: "출처", entity: "인물·기관", place: "장소" };
export function parseUnifiedSearch(params: URLSearchParams): UnifiedSearchState {
  const target = params.get("target");
  return { ...parseSearch(params), target: ["all", "record", "source", "entity", "place"].includes(target ?? "") ? target as SearchTarget : "all" };
}
export function serializeUnifiedSearch(state: UnifiedSearchState): string {
  const params = new URLSearchParams(serializeSearch(state));
  if (state.target !== "all") params.set("target", state.target);
  return params.toString();
}
/** This DTO contains public discovery metadata, never the registry or whole record bodies. */
export function buildKnowledgeSearchItems(registry: KnowledgeRegistry, records: readonly ArchiveRecord[]): KnowledgeSearchItem[] {
  const publicIds = new Set(records.map(record => record.id));
  const linkedIds = (ids: readonly string[]) => ids.filter(id => publicIds.has(id));
  const recordAliases = (ids: string[]) => records.filter(record => ids.includes(record.id)).flatMap(record => [record.title, ...record.aliases]);
  return [
    ...registry.sources.filter(isKnowledgePublic).map(source => {
      const provider = registry.entities.find(entity => entity.id === source.providerId);
      const ids = records.filter(record => record.sources.some(item => item.id === source.id)).map(record => record.id);
      return { id: source.id, target: "source" as const, kind: source.kind, title: source.title,
        aliases: [...(provider?.aliases ?? []), ...recordAliases(ids)], description: `${source.creator} · ${source.locator}`,
        provider: provider?.name ?? "제공 기관 확인 중", locator: source.locator, href: `/sources/${source.id}/`, recordIds: ids,
        review: source.review.status === "approved" && source.review.humanReviewed ? "approved" as const : "source-checked" as const };
    }).filter(source => source.recordIds.length > 0),
    ...registry.entities.filter(isKnowledgePublic).map(entity => ({ id: entity.id, target: entity.kind === "place" ? "place" as const : "entity" as const,
      kind: entity.kind, title: entity.name, aliases: entity.aliases, description: entity.description, provider: "", locator: "",
      href: `/entities/${entity.id}/`, recordIds: linkedIds(entity.recordIds),
      review: entity.review.status === "approved" && entity.review.humanReviewed ? "approved" as const : "source-checked" as const }))
      .filter(entity => entity.recordIds.length > 0 || registry.sources.some(source => source.providerId === entity.id))
      .map(entity => entity.recordIds.length ? entity : { ...entity, recordIds: records.filter(record => record.sources.some(source => registry.sources.some(item => item.id === source.id && item.providerId === entity.id))).map(record => record.id) })
      .filter(entity => entity.recordIds.length > 0)
  ];
}
export function searchKnowledge(items: readonly KnowledgeSearchItem[], records: SearchRecord[], state: UnifiedSearchState, savedIds: readonly string[] = []): KnowledgeSearchResult[] {
  const eligible = new Set(searchRecords(records, { ...state, q: "", page: 1 }, savedIds).map(record => record.id));
  const terms = normalizeSearch(state.q).split(" ").filter(Boolean);
  return items.filter(item => (state.target === "all" || state.target === item.target) && item.recordIds.some(id => eligible.has(id)))
    .flatMap(item => {
      const fields: [string, string][] = [["제목", item.title], ...item.aliases.map(alias => ["확인된 별칭·연결 기록", alias] as [string, string]), ["제공 기관", item.provider], ["대조 위치", item.locator], ["설명", item.description]];
      const haystack = normalizeSearch(fields.map(([, value]) => value).join(" "));
      if (!terms.every(term => haystack.includes(term))) return [];
      const matched = fields.find(([, value]) => terms.some(term => normalizeSearch(value).includes(term)));
      const score = terms.reduce((sum, term) => sum + (normalizeSearch(item.title).includes(term) ? 8 : item.aliases.some(alias => normalizeSearch(alias).includes(term)) ? 4 : 1), 0);
      return [{ ...item, score, why: matched ? `${matched[0]} 일치: ${matched[1]}` : `공개 기록 ${item.recordIds.length}건과 연결된 ${searchTargetLabels[item.target]}` }];
    }).sort((a, b) => state.sort === "relevance" ? b.score - a.score || a.title.localeCompare(b.title, "ko") : a.title.localeCompare(b.title, "ko"));
}
export function relaxedSearchSuggestions(records: SearchRecord[], items: KnowledgeSearchItem[], state: UnifiedSearchState, savedIds: readonly string[] = []) {
  const options: { label: string; state: UnifiedSearchState; count: number }[] = [];
  for (const key of ["label", "region", "kind", "institution", "era", "original", "saved", "target"] as const) {
    if (!state[key] || key === "target" && state.target === "all") continue;
    const next: UnifiedSearchState = { ...state, [key]: key === "original" || key === "saved" ? false : key === "target" ? "all" : "", page: 1 };
    const count = (next.target === "all" || next.target === "record" ? searchRecords(records, next, savedIds).length : 0) + searchKnowledge(items, records, next, savedIds).length;
    if (count) options.push({ label: `${({ label: "주제", region: "지역", kind: "기록 유형", institution: "기관", era: "시대", original: "원문", saved: "저장", target: "자료 분류" })[key]} 조건 해제`, state: next, count });
  }
  return options;
}
