export const shelfKey = "war-archive.shelf.v1";
export type ShelfState = {
  version: 1; bookmarks: string[]; notes: Record<string, string>;
  recent: { id: string; visitedAt: string; sectionId: string }[];
  fontScale: number; metricsConsent: boolean; metrics: Record<string, number>; resumeConsent?: boolean;
};
export function emptyShelf(): ShelfState { return { version: 1, bookmarks: [], notes: {}, recent: [], fontScale: 1, metricsConsent: false, metrics: {} }; }
const safeId = /^(?!(?:__proto__|prototype|constructor)$)[a-zA-Z0-9_-]{1,80}$/;
const metricNames = new Set(["search", "no_results", "record_open", "source_open", "related_open", "bookmark", "citation_copy"]);
export function parseShelf(raw: string | null): ShelfState {
  if (raw === null) return emptyShelf();
  if (raw.length > 600000) throw new Error("저장 데이터가 허용 크기를 초과했습니다.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("보관함 형식을 확인할 수 없습니다.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.bookmarks) || data.bookmarks.length > 500 || !data.bookmarks.every(id => typeof id === "string" && safeId.test(id))) throw new Error("지원하지 않는 보관함 데이터입니다.");
  if (!data.notes || typeof data.notes !== "object" || Array.isArray(data.notes)) throw new Error("메모 형식이 올바르지 않습니다.");
  const entries = Object.entries(data.notes);
  if (entries.length > 500 || !entries.every(([id, note]) => safeId.test(id) && typeof note === "string" && note.length <= 4000)) throw new Error("메모 크기 또는 형식이 올바르지 않습니다.");
  if (!Array.isArray(data.recent) || data.recent.length > 40 || !data.recent.every(item => item && typeof item === "object" && typeof item.id === "string" && safeId.test(item.id) && typeof item.visitedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item.visitedAt) && Number.isFinite(Date.parse(item.visitedAt)) && typeof item.sectionId === "string" && (item.sectionId === "" || safeId.test(item.sectionId)))) throw new Error("최근 열람 형식이 올바르지 않습니다.");
  if (typeof data.fontScale !== "number" || ![0.9, 1, 1.15, 1.3].includes(data.fontScale) || typeof data.metricsConsent !== "boolean") throw new Error("읽기 설정 형식이 올바르지 않습니다.");
  if (!data.metrics || typeof data.metrics !== "object" || Array.isArray(data.metrics) || !Object.entries(data.metrics).every(([key, count]) => metricNames.has(key) && typeof count === "number" && Number.isSafeInteger(count) && count >= 0 && count <= 1000000)) throw new Error("이용 집계 형식이 올바르지 않습니다.");
  if (data.resumeConsent !== undefined && typeof data.resumeConsent !== "boolean") throw new Error("홈 작업 표시 설정을 확인하세요.");
  return { version: 1, bookmarks: [...new Set(data.bookmarks as string[])], notes: Object.fromEntries(entries) as Record<string, string>, recent: data.recent as ShelfState["recent"], fontScale: data.fontScale, metricsConsent: data.metricsConsent, metrics: { ...data.metrics } as Record<string, number>, ...(data.resumeConsent === undefined ? {} : { resumeConsent: data.resumeConsent }) };
}
export function toggleBookmark(state: ShelfState, id: string): ShelfState {
  if (!safeId.test(id)) throw new Error("기록 ID가 올바르지 않습니다.");
  if (!state.bookmarks.includes(id) && state.bookmarks.length >= 500) throw new Error("최대 500개까지 저장할 수 있습니다.");
  return { ...state, bookmarks: state.bookmarks.includes(id) ? state.bookmarks.filter(item => item !== id) : [...state.bookmarks, id] };
}
export function setNote(state: ShelfState, id: string, note: string): ShelfState {
  if (!safeId.test(id) || note.length > 4000) throw new Error("메모는 기록별 4,000자까지 저장할 수 있습니다.");
  const notes = { ...state.notes };
  if (note) notes[id] = note; else delete notes[id];
  if (Object.keys(notes).length > 500) throw new Error("메모는 최대 500개 기록에 저장할 수 있습니다.");
  return { ...state, notes };
}
export function recordVisit(state: ShelfState, id: string, sectionId = "", visitedAt = new Date().toISOString()): ShelfState {
  if (!safeId.test(id) || (sectionId && !safeId.test(sectionId))) throw new Error("읽기 위치가 올바르지 않습니다.");
  return { ...state, recent: [{ id, visitedAt, sectionId }, ...state.recent.filter(item => item.id !== id)].slice(0, 40) };
}
export function incrementMetric(state: ShelfState, metric: string): ShelfState {
  if (!state.metricsConsent || !metricNames.has(metric)) return state;
  return { ...state, metrics: { ...state.metrics, [metric]: Math.min((state.metrics[metric] ?? 0) + 1, 1000000) } };
}
