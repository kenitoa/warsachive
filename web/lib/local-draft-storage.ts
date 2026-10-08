import { parseShelf, shelfKey } from "./shelf-storage.ts";
import { parseWorkspace, workspaceKey } from "./workspace-domain.ts";

export const draftStorageKey = "war-archive.drafts.v1";
export const localDataKeys = [shelfKey, workspaceKey, draftStorageKey] as const;
export type LocalDataKey = typeof localDataKeys[number];
export type DraftEntry = { scope: string; revision: number; updatedAt: string; payload: unknown };
export type DraftStore = { version: 1; entries: DraftEntry[] };
export type LocalBackup = { type: "archive-local-backup"; version: 1; createdAt: string; items: { key: LocalDataKey; raw: string | null }[] };
export const draftScopePattern = /^[a-z][a-z0-9-]{0,39}(?::[A-Za-z0-9_-]{1,100}){0,5}$/;
export function safeDraftJson(value: unknown, depth = 0): boolean {
  if (depth > 35) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= 500000;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeDraftJson(item, depth + 1));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).length <= 1000 && Object.entries(value).every(([key, item]) => !["__proto__", "prototype", "constructor"].includes(key) && safeDraftJson(item, depth + 1));
}
export function parseDraftStore(raw: string | null): DraftStore {
  if (raw === null) return { version: 1, entries: [] };
  if (raw.length > 4000000) throw new Error("복구 초안 용량을 초과했습니다. 원본을 먼저 보관하세요.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("entries" in value) || !Array.isArray(value.entries) || value.entries.length > 100) throw new Error("복구 초안 형식이 손상되었습니다. 원본은 덮어쓰지 않았습니다.");
  const entries = value.entries.map((item: unknown): DraftEntry => {
    if (!item || typeof item !== "object" || !("scope" in item) || typeof item.scope !== "string" || !draftScopePattern.test(item.scope)
      || !("revision" in item) || !Number.isSafeInteger(item.revision) || Number(item.revision) < 1
      || !("updatedAt" in item) || typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt))
      || !("payload" in item) || !safeDraftJson(item.payload) || new TextEncoder().encode(JSON.stringify(item.payload)).length > 524288) throw new Error("복구 초안 항목을 확인할 수 없습니다. 원본은 유지했습니다.");
    return { scope: item.scope, revision: Number(item.revision), updatedAt: item.updatedAt, payload: item.payload };
  });
  if (new Set(entries.map(item => item.scope)).size !== entries.length) throw new Error("복구 초안에 중복 항목이 있습니다.");
  return { version: 1, entries };
}
export function writeDraft(store: DraftStore, scope: string, payload: unknown, expectedRevision: number, now: string): DraftStore {
  if (!draftScopePattern.test(scope)) throw new Error("초안 저장 위치를 확인하세요.");
  const previous = store.entries.find(item => item.scope === scope);
  if ((previous?.revision ?? 0) !== expectedRevision) throw new Error("다른 탭에서 초안이 바뀌었습니다. 현재 입력을 내보내고 다른 사본을 확인하세요.");
  return parseDraftStore(JSON.stringify({ version: 1, entries: [...store.entries.filter(item => item.scope !== scope), { scope, revision: expectedRevision + 1, updatedAt: now, payload }] }));
}
export function createLocalBackup(read: (key: string) => string | null, keys: readonly LocalDataKey[], now: string): LocalBackup {
  if (!keys.every(key => localDataKeys.includes(key))) throw new Error("이 서비스가 관리하는 기기 범위만 백업합니다.");
  const backup: LocalBackup = { type: "archive-local-backup", version: 1, createdAt: now, items: [...new Set(keys)].map(key => ({ key, raw: read(key) })) };
  if (new TextEncoder().encode(JSON.stringify(backup, null, 2)).length > 7000000) throw new Error("백업이 7MB를 넘습니다. 범위를 나누어 보관하세요.");
  return backup;
}
export function parseLocalBackup(raw: string): LocalBackup {
  if (raw.length > 7000000) throw new Error("기기 백업은 7MB 이하만 확인할 수 있습니다.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "archive-local-backup" || !("version" in value) || value.version !== 1
    || !("createdAt" in value) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !("items" in value) || !Array.isArray(value.items) || value.items.length > localDataKeys.length) throw new Error("이 서비스의 기기 백업 형식이 아닙니다.");
  const items = value.items.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("key" in item) || !localDataKeys.some(key => key === item.key) || !("raw" in item) || (item.raw !== null && typeof item.raw !== "string")) throw new Error("백업에 허용되지 않은 저장 위치가 있습니다.");
    const key = item.key as LocalDataKey; const data = item.raw as string | null;
    if (data !== null) { if (key === shelfKey) parseShelf(data); if (key === workspaceKey) parseWorkspace(data); if (key === draftStorageKey) parseDraftStore(data); }
    return { key, raw: data };
  });
  if (new Set(items.map(item => item.key)).size !== items.length) throw new Error("중복된 백업 항목입니다.");
  return { type: "archive-local-backup", version: 1, createdAt: value.createdAt, items };
}
