import type { SearchRecord } from "./archive-types";

export type SearchState = {
  q: string; label: string; region: string; kind: string; institution: string;
  era: string; original: boolean; saved: boolean;
  sort: "relevance" | "date" | "updated" | "title"; page: number;
};
export const pageSize = 12;
export const defaultSearch: SearchState = { q: "", label: "", region: "", kind: "", institution: "", era: "", original: false, saved: false, sort: "relevance", page: 1 };
const eras = new Set(["", "ancient", "medieval", "early-modern", "modern", "unknown"]);
const sorts = new Set(["relevance", "date", "updated", "title"]);
export function parseSearch(params: URLSearchParams): SearchState {
  const rawPage = Number(params.get("page") ?? 1);
  const sort = params.get("sort") ?? "relevance";
  const era = params.get("era") ?? "";
  return {
    q: (params.get("q") ?? "").trim().slice(0, 160), label: (params.get("label") ?? "").slice(0, 80),
    region: (params.get("region") ?? "").slice(0, 100), kind: ["event", "source"].includes(params.get("kind") ?? "") ? params.get("kind") ?? "" : "",
    institution: (params.get("institution") ?? "").slice(0, 120), era: eras.has(era) ? era : "",
    original: params.get("original") === "1", saved: params.get("saved") === "1",
    sort: sorts.has(sort) ? sort as SearchState["sort"] : "relevance",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1
  };
}
export function serializeSearch(state: SearchState): string {
  const params = new URLSearchParams();
  for (const key of ["q", "label", "region", "kind", "institution", "era"] as const) if (state[key]) params.set(key, state[key]);
  if (state.original) params.set("original", "1");
  if (state.saved) params.set("saved", "1");
  if (state.sort !== "relevance") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}
export function normalizeSearch(value: string): string { return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/g, " ").trim(); }
function inEra(record: SearchRecord, era: string): boolean {
  if (!era) return true;
  const start = record.date.startYear;
  const end = record.date.endYear ?? start;
  if (era === "unknown") return start === null;
  if (start === null || end === null) return false;
  const ranges: Record<string, [number, number]> = { ancient: [-100000, 499], medieval: [500, 1499], "early-modern": [1500, 1799], modern: [1800, 100000] };
  const range = ranges[era];
  return !!range && start <= range[1] && end >= range[0];
}
export function searchRecords(records: SearchRecord[], state: SearchState, savedIds: readonly string[] = []): SearchRecord[] {
  const terms = normalizeSearch(state.q).split(" ").filter(Boolean);
  const scores = new Map<string, number>();
  const matches = records.filter(record => {
    if (state.label && !record.labels.includes(state.label)) return false;
    if (state.region && record.region !== state.region) return false;
    if (state.kind && record.kind !== state.kind) return false;
    if (state.institution && !record.institutions.includes(state.institution)) return false;
    if (state.original && !record.hasOriginal) return false;
    if (state.saved && !savedIds.includes(record.id)) return false;
    if (!inEra(record, state.era)) return false;
    const title = normalizeSearch([record.title, ...record.aliases].join(" "));
    const entities = [...record.people, ...record.places].flatMap(item => [item.name, ...item.aliases]);
    const text = normalizeSearch([title, record.period, record.region, record.summary, ...record.labels, ...record.institutions, ...entities].join(" "));
    if (!terms.every(term => text.includes(term))) return false;
    scores.set(record.id, terms.reduce((score, term) => score + (title.includes(term) ? 8 : 1), 0));
    return true;
  });
  return [...matches].sort((left, right) => {
    if (state.sort === "title") return left.title.localeCompare(right.title, "ko");
    if (state.sort === "date") return (left.date.startYear ?? Infinity) - (right.date.startYear ?? Infinity) || left.title.localeCompare(right.title, "ko");
    if (state.sort === "updated") return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
    return (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0) || left.title.localeCompare(right.title, "ko");
  });
}
export function matchingContext(record: SearchRecord, query: string): string {
  const term = normalizeSearch(query).split(" ").find(Boolean);
  if (!term) return record.summary;
  const entity = [...record.people, ...record.places].find(item => normalizeSearch([item.name, ...item.aliases].join(" ")).includes(term));
  if (entity) return `연결된 인물·장소: ${entity.name}${entity.aliases.length ? ` (${entity.aliases.join(", ")})` : ""}`;
  const institution = record.institutions.find(item => normalizeSearch(item).includes(term));
  return institution ? `출처 기관: ${institution}` : record.summary;
}
export function safeReturnPath(raw: string | null, basePath = "", detailPaths: readonly string[] = []): string | null {
  if (!raw || raw.length > 2000 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || [...raw].some(character => character.charCodeAt(0) <= 31)) return null;
  try {
    const parsed = new URL(raw, "https://archive.invalid");
    if (parsed.origin !== "https://archive.invalid") return null;
    const allowed = [...["archive", "explore", "timeline", "collections", "stories", "saved", "sources", "entities", "places", "workspace", "teach"].map(section => `${basePath}/${section}/`), ...detailPaths.filter(path => ["collections", "stories", "archive", "sources", "entities"].some(section => path.startsWith(`${basePath}/${section}/`)))];
    return allowed.some(path => parsed.pathname === path) ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch { return null; }
}
