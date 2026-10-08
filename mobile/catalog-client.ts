import { isPublicCatalog, sha256Text, type CatalogRecord, type PublicCatalog } from "../web/lib/public-catalog.ts";
import { isArchiveRecord, isPublicRecord } from "../web/lib/archive-domain.ts";
import type { ArchiveRecord } from "../web/lib/archive-types";
import { archiveEndpoint, type ArchiveStorage } from "./archive-client.ts";
export type CatalogLoad = { catalog: PublicCatalog; mode: "online" | "offline"; warning: string; checkedAt: string; removedIds: string[]; updatedIds: string[] };
export type RecordLoad = { record: ArchiveRecord; mode: "online" | "offline"; warning: string };
export type DownloadEntry = { id: string; sha256: string; bytes: number; updatedAt: string };
export type DownloadProgress = { phase: "downloading" | "saving" | "complete" | "failed"; completedRecords: number; totalRecords: number; downloadedBytes: number; totalBytes: number; currentId: string };
export type DownloadState = DownloadEntry & { state: "current" | "outdated" | "unavailable"; latest: CatalogRecord | null };
const catalogKey = (site: string) => "war-archive:catalog:v2:" + encodeURIComponent(site);
const checkedKey = (site: string) => catalogKey(site) + ":checked-at";
const detailKey = (site: string, entry: { id: string; sha256: string }) => "war-archive:detail:v2:" + encodeURIComponent(site) + ":" + entry.id + ":" + entry.sha256;
const selectedKey = (site: string) => "war-archive:downloads:v2:" + encodeURIComponent(site);
const idPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,80}$/;
function safeSite(site: string): string { archiveEndpoint(site); return site.replace(/\/$/, ""); }
export function utf8Bytes(value: string): number { let count = 0; for (const char of value) { const code = char.codePointAt(0) ?? 0; count += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4; } return count; }
async function readText(url: string, fetcher: typeof fetch, limit: number, onBytes?: (bytes: number) => void): Promise<string> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(url, { signal: controller.signal, credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error("공개 자료 요청 실패 (" + response.status + ")");
    if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new Error("공개 자료 크기 제한을 초과했습니다."); }
    const raw = await response.text(); const bytes = utf8Bytes(raw);
    if (bytes > limit) throw new Error("공개 자료 크기 제한을 초과했습니다.");
    onBytes?.(bytes); return raw;
  } finally { clearTimeout(timer); }
}
function parseCatalog(raw: string, site: string): PublicCatalog {
  if (utf8Bytes(raw) > 2_000_000) throw new Error("공개 목록 크기 제한을 초과했습니다.");
  const parsed: unknown = JSON.parse(raw);
  if (!isPublicCatalog(parsed) || safeSite(parsed.siteUrl) !== site) throw new Error("공개 목록의 형식이나 사이트 주소가 다릅니다.");
  return parsed;
}
function parseDetail(raw: string, entry: { id: string; sha256: string; bytes: number; updatedAt: string }): ArchiveRecord {
  if (utf8Bytes(raw) > 2_000_000 || utf8Bytes(raw) !== entry.bytes || sha256Text(raw) !== entry.sha256) throw new Error("자료의 크기나 해시가 공개 목록과 다릅니다.");
  const parsed: unknown = JSON.parse(raw);
  if (!isArchiveRecord(parsed) || !isPublicRecord(parsed) || parsed.id !== entry.id || parsed.updatedAt !== entry.updatedAt) throw new Error("자료의 공개 상태나 기록 버전이 다릅니다.");
  return parsed;
}
export async function loadCatalog(siteUrl: string, storage: ArchiveStorage, fetcher: typeof fetch = fetch): Promise<CatalogLoad> {
  const site = safeSite(siteUrl); let cached: PublicCatalog | null = null; let warning = ""; let previousCheckedAt = "";
  try { const raw = await storage.getItem(catalogKey(site)); if (raw) cached = parseCatalog(raw, site); const checked = await storage.getItem(checkedKey(site)); if (checked && Number.isFinite(Date.parse(checked))) previousCheckedAt = checked; }
  catch { warning = "저장된 목록을 읽지 못했습니다. 원본 저장값은 유지했습니다."; }
  try {
    const raw = await readText(site + "/data/catalog-v2.json", fetcher, 2_000_000); const catalog = parseCatalog(raw, site); const checkedAt = new Date().toISOString();
    try { await storage.setItem(catalogKey(site), raw); await storage.setItem(checkedKey(site), checkedAt); } catch { warning = "최신 목록을 받았지만 기기에 저장하지 못했습니다."; }
    const removedIds = cached?.records.filter(old => !catalog.records.some(record => record.id === old.id)).map(record => record.id) ?? [];
    const updatedIds = cached?.records.filter(old => catalog.records.some(record => record.id === old.id && record.sha256 !== old.sha256)).map(record => record.id) ?? [];
    return { catalog, mode: "online", checkedAt, removedIds, updatedIds, warning: [warning, removedIds.length ? removedIds.length + "개 기록이 공개 목록에서 제외됐습니다. 기기의 이전 다운로드를 현재 공개 기록으로 열지 않습니다." : "", updatedIds.length ? updatedIds.length + "개 기록의 공개 버전이 변경됐습니다." : ""].filter(Boolean).join(" ") };
  } catch (error) {
    if (cached) return { catalog: cached, mode: "offline", checkedAt: previousCheckedAt, removedIds: [], updatedIds: [], warning: "연결을 확인하지 못했습니다. 마지막 확인 목록으로 읽으며 최신 공개 상태를 보장하지 않습니다. 오프라인에서는 새로 보류된 자료를 즉시 알 수 없습니다." };
    throw error;
  }
}
async function checkCurrentEntry(site: string, entry: CatalogRecord, storage: ArchiveStorage): Promise<void> {
  const raw = await storage.getItem(catalogKey(site)); if (!raw) return;
  const catalog = parseCatalog(raw, site); const current = catalog.records.find(record => record.id === entry.id);
  if (!current) throw new Error("최신 공개 목록에서 제외된 기록입니다. 이전 다운로드를 현재 공개 기록으로 열지 않습니다.");
  if (current.sha256 !== entry.sha256) throw new Error("공개 버전이 변경됐습니다. 최신 목록으로 다시 선택하세요.");
}
export async function loadCatalogRecord(siteUrl: string, entry: CatalogRecord, storage: ArchiveStorage, fetcher: typeof fetch = fetch): Promise<RecordLoad> {
  const site = safeSite(siteUrl); await checkCurrentEntry(site, entry, storage); let cached: ArchiveRecord | null = null;
  try { const raw = await storage.getItem(detailKey(site, entry)); if (raw) cached = parseDetail(raw, entry); } catch { cached = null; }
  try {
    const raw = await readText(site + entry.detailPath, fetcher, 2_000_000); const record = parseDetail(raw, entry); let warning = "";
    await checkCurrentEntry(site, entry, storage);
    try { await storage.setItem(detailKey(site, entry), raw); } catch { warning = "자료는 받았지만 기기에 저장하지 못했습니다."; }
    return { record, mode: "online", warning };
  } catch (error) { await checkCurrentEntry(site, entry, storage); if (cached) return { record: cached, mode: "offline", warning: "기기에 저장된 버전으로 읽습니다. 외부 원문과 현재 공개 상태를 확인한 것은 아닙니다." }; throw error; }
}
export function selectionSize(catalog: PublicCatalog, ids: readonly string[]): { records: number; bytes: number } {
  const unique = [...new Set(ids)]; if (!unique.length || unique.length > 200) throw new Error("다운로드할 공개 기록 1~200개를 선택하세요.");
  const selected = unique.map(id => catalog.records.find(record => record.id === id)); if (selected.some(entry => !entry)) throw new Error("현재 공개 목록에 없는 기록입니다.");
  const bytes = selected.reduce((sum, entry) => sum + (entry?.bytes ?? 0), 0); if (bytes > 20_000_000) throw new Error("한 묶음은 20MB까지 보관할 수 있습니다.");
  return { records: unique.length, bytes };
}
export async function downloadSelection(siteUrl: string, catalog: PublicCatalog, ids: readonly string[], storage: ArchiveStorage, fetcher: typeof fetch = fetch, onProgress?: (progress: DownloadProgress) => void): Promise<{ records: number; bytes: number }> {
  const site = safeSite(siteUrl); if (!isPublicCatalog(catalog) || safeSite(catalog.siteUrl) !== site) throw new Error("다운로드 목록의 사이트 주소가 다릅니다.");
  const size = selectionSize(catalog, ids); const unique = [...new Set(ids)]; const selected = catalog.records.filter(record => unique.includes(record.id));
  const existing = await readDownloads(site, storage); if (existing.filter(item => !unique.includes(item.id)).length + selected.length > 1000) throw new Error("다운로드 목록은 최대 1,000개입니다.");
  const progress: DownloadProgress = { phase: "downloading", completedRecords: 0, totalRecords: size.records, downloadedBytes: 0, totalBytes: size.bytes, currentId: "" };
  const emit = () => onProgress?.({ ...progress }); emit();
  const validated: { entry: CatalogRecord; raw: string }[] = [];
  try {
    for (const entry of selected) { await checkCurrentEntry(site, entry, storage); progress.currentId = entry.id; emit(); const raw = await readText(site + entry.detailPath, fetcher, 2_000_000, bytes => { progress.downloadedBytes += bytes; emit(); }); parseDetail(raw, entry); validated.push({ entry, raw }); progress.completedRecords++; emit(); }
    progress.phase = "saving"; emit();
    for (const { entry, raw } of validated) { await checkCurrentEntry(site, entry, storage); await storage.setItem(detailKey(site, entry), raw); }
    for (const entry of selected) await checkCurrentEntry(site, entry, storage);
    const snapshots = [...existing.filter(item => !unique.includes(item.id)), ...selected.map(entry => ({ id: entry.id, sha256: entry.sha256, bytes: entry.bytes, updatedAt: entry.updatedAt }))];
    await storage.setItem(selectedKey(site), JSON.stringify({ version: 2, siteUrl: site, contentHash: catalog.contentHash, records: snapshots }));
    progress.phase = "complete"; progress.currentId = ""; emit(); return size;
  } catch (error) { progress.phase = "failed"; emit(); throw error; }
}
export async function readDownloads(siteUrl: string, storage: ArchiveStorage): Promise<DownloadEntry[]> {
  const site = safeSite(siteUrl); const raw = await storage.getItem(selectedKey(site)); if (!raw) return [];
  if (raw.length > 200_000) throw new Error("다운로드 목록 크기가 제한을 초과했습니다."); const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("다운로드 목록 형식이 잘못됐습니다."); const value = parsed as Record<string, unknown>;
  if (value.version !== 2 || value.siteUrl !== site || !Array.isArray(value.records) || value.records.length > 1000 || !value.records.every(item => item && typeof item === "object" && typeof item.id === "string" && idPattern.test(item.id) && typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= 2_000_000 && typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt))) || new Set(value.records.map(item => item.id)).size !== value.records.length) throw new Error("다운로드 목록 형식이 잘못됐습니다.");
  return value.records as DownloadEntry[];
}
export function downloadStates(catalog: PublicCatalog, entries: DownloadEntry[]): DownloadState[] {
  return entries.map(entry => { const latest = catalog.records.find(record => record.id === entry.id) ?? null; return { ...entry, latest, state: !latest ? "unavailable" : latest.sha256 === entry.sha256 ? "current" : "outdated" }; });
}
export async function loadDownloadedRecord(siteUrl: string, entry: DownloadEntry, storage: ArchiveStorage, current: CatalogLoad): Promise<RecordLoad> {
  const site = safeSite(siteUrl); if (safeSite(current.catalog.siteUrl) !== site) throw new Error("다운로드 사이트 주소가 다릅니다.");
  const latest = current.catalog.records.find(record => record.id === entry.id);
  if (current.mode === "online" && !latest) throw new Error("최신 공개 목록에서 제외된 기록입니다. 이전 다운로드를 현재 공개 기록으로 열지 않습니다.");
  const raw = await storage.getItem(detailKey(site, entry)); if (!raw) throw new Error("저장된 자료를 찾지 못했습니다. 다시 다운로드하세요.");
  return { record: parseDetail(raw, entry), mode: "offline", warning: latest?.sha256 !== entry.sha256 ? "이전 버전을 읽습니다. 현재 공개 내용과 같지 않을 수 있습니다. 최신 버전은 다시 다운로드하세요." : "이 기록은 기기에서 읽습니다. 오프라인에서는 새로 보류된 자료를 즉시 알 수 없습니다." };
}
export async function clearDownloads(siteUrl: string, storage: ArchiveStorage & { removeItem(key: string): Promise<void> }): Promise<void> {
  const site = safeSite(siteUrl); const entries = await readDownloads(site, storage);
  await storage.setItem(selectedKey(site), JSON.stringify({ version: 2, siteUrl: site, records: [] }));
  for (const entry of entries) await storage.removeItem(detailKey(site, entry));
}
