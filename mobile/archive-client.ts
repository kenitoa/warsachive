import { isArchiveRecord, isPublicRecord } from "../web/lib/archive-domain.ts";
import type { ArchiveRecord } from "../web/lib/archive-types";

export interface ArchiveStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export type MobileArchive = { version: 1; siteUrl: string; contentHash: string; generatedAt: string; records: ArchiveRecord[] };
export type ArchiveLoad = { archive: MobileArchive; mode: "online" | "offline"; warning: string };
const cacheKey = "war-archive:public-cache:v1";
const savedKey = "war-archive:saved:v1";

function safeStructure(value: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every((item) => safeStructure(item, depth + 1));
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.entries(value).every(([key, item]) => !["__proto__", "constructor", "prototype"].includes(key) && safeStructure(item, depth + 1));
}

export function validateMobileArchive(value: unknown): value is MobileArchive {
  if (!value || typeof value !== "object" || !safeStructure(value)) return false;
  const item = value as Record<string, unknown>;
  return item.version === 1 && typeof item.siteUrl === "string" && typeof item.contentHash === "string"
    && /^[a-f0-9]{64}$/.test(item.contentHash) && typeof item.generatedAt === "string" && Number.isFinite(Date.parse(item.generatedAt))
    && Array.isArray(item.records) && item.records.every((record) => isArchiveRecord(record) && isPublicRecord(record));
}

export function archiveEndpoint(siteUrl: string): string {
  const url = new URL(siteUrl);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash) throw new Error("공개 아카이브 주소는 HTTPS URL이어야 합니다.");
  return `${siteUrl.replace(/\/$/, "")}/data/mobile-index.json`;
}

export async function loadMobileArchive(siteUrl: string, storage: ArchiveStorage, fetcher: typeof fetch = fetch): Promise<ArchiveLoad> {
  const endpoint = archiveEndpoint(siteUrl);
  let cached: MobileArchive | null = null;
  let warning = "";
  try {
    const raw = await storage.getItem(cacheKey);
    if (raw) {
      if (raw.length > 5_000_000) throw new Error("Saved archive exceeds the cache limit.");
      const parsed: unknown = JSON.parse(raw);
      if (validateMobileArchive(parsed) && parsed.siteUrl.replace(/\/$/, "") === siteUrl.replace(/\/$/, "")) cached = parsed;
      else warning = "저장된 자료의 형식을 확인할 수 없어 최신 자료를 다시 요청했습니다.";
    }
  } catch { warning = "기기에 저장된 자료를 읽지 못했습니다."; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(endpoint, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(`공개 자료 응답 오류 (${response.status})`);
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("공개 자료의 크기가 허용 범위를 초과했습니다.");
    const parsed: unknown = JSON.parse(text);
    if (!validateMobileArchive(parsed) || parsed.siteUrl.replace(/\/$/, "") !== siteUrl.replace(/\/$/, "")) throw new Error("공개 자료의 형식 또는 사이트 주소가 올바르지 않습니다.");
    try { await storage.setItem(cacheKey, text); }
    catch { warning = "최신 자료를 불러왔지만 오프라인 보관에는 실패했습니다."; }
    return { archive: parsed, mode: "online", warning };
  } catch (error) {
    if (cached) return { archive: cached, mode: "offline", warning: "연결할 수 없어 마지막 보관본을 보여 줍니다. 원문 링크는 인터넷 연결이 필요합니다." };
    throw new Error(error instanceof Error ? error.message : "공개 자료를 불러오지 못했습니다.", { cause: error });
  } finally { clearTimeout(timeout); }
}

export async function readSavedRecords(storage: ArchiveStorage): Promise<string[]> {
  const raw = await storage.getItem(savedKey);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 500 || !parsed.every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error("저장한 기록 목록의 형식을 확인할 수 없습니다.");
  return [...new Set(parsed)];
}

export async function writeSavedRecords(storage: ArchiveStorage, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length > 500 || !unique.every((id) => /^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error("기기에 저장할 수 있는 기록은 최대 500개입니다.");
  // A malformed existing shelf must not be overwritten by a new bookmark operation.
  await readSavedRecords(storage);
  await storage.setItem(savedKey, JSON.stringify(unique));
}

export async function backupAndResetSavedRecords(storage: ArchiveStorage): Promise<void> {
  const raw = await storage.getItem(savedKey);
  if (raw !== null) await storage.setItem(`${savedKey}:recovery-backup`, raw);
  await storage.setItem(savedKey, "[]");
}
