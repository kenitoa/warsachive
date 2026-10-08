import { backup, DatabaseSync } from "node:sqlite";
import { mkdir, chmod, writeFile, lstat, readFile, open } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { ApiConfig } from "../config.ts";
import { Store } from "./database.ts";
import { privateDirectory, verifiedFile, type AttachmentFile } from "./private-storage.ts";
import { check } from "../domain/errors.ts";
import { object, identifier, isoDate } from "../domain/validation.ts";
import { reconcileRecovery } from '../application/recovery.ts';

type BundleManifest = { version: 1; createdAt: string; database: { filename: "archive.sqlite"; sha256: string }; attachments: AttachmentFile[] };
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function fileHash(path: string): Promise<string> {
  const before = await lstat(path); check(before.isFile() && !before.isSymbolicLink(), 400, "BUNDLE_INVALID", "백업 항목은 일반 파일이어야 합니다."); const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { const opened = await handle.stat(); check(opened.dev === before.dev && opened.ino === before.ino && opened.isFile(), 400, "BUNDLE_INVALID", "백업 파일이 검사 중 변경되었습니다."); const hash = createHash("sha256"); for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk); const after = await handle.stat(); check(after.size === opened.size && after.mtimeMs === opened.mtimeMs, 400, "BUNDLE_INVALID", "백업 파일이 검사 중 변경되었습니다."); return hash.digest("hex"); } finally { await handle.close(); }
}
async function newDirectory(path: string, config: ApiConfig): Promise<string> {
  let exists = true; try { await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false; else throw error; } check(!exists, 409, "BUNDLE_EXISTS", "기존 디렉터리를 덮어쓰지 않습니다."); await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await mkdir(path, { mode: 0o700 }); return privateDirectory(path, config);
}
function snapshotFiles(snapshot: DatabaseSync): AttachmentFile[] {
  const rows = snapshot.prepare("SELECT id AS attachmentId,filename,content_type AS contentType,size,sha256 FROM attachments ORDER BY filename").all(); check(rows.length <= 10000, 413, "BUNDLE_TOO_LARGE", "단일 백업의 검수 파일 10,000개 한도를 초과했습니다. 분할 보관 정책을 먼저 설정해 주세요.");
  return rows.map(row => ({ attachmentId: String(row.attachmentId), filename: String(row.filename), contentType: String(row.contentType), size: Number(row.size), sha256: String(row.sha256) }));
}
function parseManifest(value: unknown): BundleManifest {
  const input = object(value); const database = object(input.database); check(input.version === 1 && database.filename === "archive.sqlite" && typeof database.sha256 === "string" && /^[a-f0-9]{64}$/.test(database.sha256) && Array.isArray(input.attachments), 400, "BUNDLE_INVALID", "백업 manifest 형식을 확인해 주세요.");
  const attachments = input.attachments.map(value => { const item = object(value); check(typeof item.filename === "string" && /^[a-f0-9-]{36}\.(png|jpg|pdf)$/.test(item.filename) && typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256) && typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size > 0 && item.size <= 5 * 1024 * 1024 && ["image/png", "image/jpeg", "application/pdf"].includes(String(item.contentType)), 400, "BUNDLE_INVALID", "검수 파일 manifest를 확인해 주세요."); return { attachmentId: identifier(item.attachmentId), filename: item.filename, contentType: String(item.contentType), size: item.size, sha256: item.sha256 }; });
  check(new Set(attachments.map(item => item.filename)).size === attachments.length && new Set(attachments.map(item => item.attachmentId)).size === attachments.length, 400, "BUNDLE_INVALID", "중복 검수 파일이 있습니다."); return { version: 1, createdAt: isoDate(input.createdAt), database: { filename: "archive.sqlite", sha256: database.sha256 }, attachments };
}
async function regularFile(path: string): Promise<void> { const info = await lstat(path); check(info.isFile() && !info.isSymbolicLink(), 400, "BUNDLE_INVALID", "백업 항목은 일반 파일이어야 합니다."); }

export async function backupBundle(store: Store, config: ApiConfig, path: string): Promise<{ bundle: string; files: number; integrity: "ok" }> {
  const directory = await newDirectory(resolve(path), config); const database = resolve(directory, "archive.sqlite"); await backup(store.db, database); await chmod(database, 0o600);
  const snapshot = new DatabaseSync(database, { readOnly: true }); let files: AttachmentFile[];
  try { check(snapshot.prepare("PRAGMA quick_check").get()?.quick_check === "ok", 500, "BACKUP_INVALID", "백업 DB 무결성 검사가 실패했습니다."); files = snapshotFiles(snapshot); } finally { snapshot.close(); }
  const privatePath = resolve(directory, "private"); await mkdir(privatePath, { mode: 0o700 });
  if (files.length) { const source = await privateDirectory(config.privateStorageDirectory, config); for (const file of files) await writeFile(resolve(privatePath, file.filename), await verifiedFile(source, file), { flag: "wx", mode: 0o600 }); }
  const manifest: BundleManifest = { version: 1, createdAt: new Date().toISOString(), database: { filename: "archive.sqlite", sha256: await fileHash(database) }, attachments: files };
  // Completion marker is written last: incomplete folders are never restorable bundles.
  await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 }); return { bundle: directory, files: files.length, integrity: "ok" };
}
export async function restoreBundle(config: ApiConfig, sourcePath: string, destinationPath: string,latest?:Store): Promise<{ restoredDatabase: string; restoredPrivateStorage: string; files: number; integrity: "ok" }> {
  const source = await privateDirectory(resolve(sourcePath), config); const manifestPath = resolve(source, "manifest.json"); await regularFile(manifestPath); check((await lstat(manifestPath)).size <= 8 * 1024 * 1024, 413, "BUNDLE_INVALID", "백업 manifest가 너무 큽니다."); const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const originalDatabase = resolve(source, "archive.sqlite"); await regularFile(originalDatabase); check(await fileHash(originalDatabase) === manifest.database.sha256, 400, "BUNDLE_INVALID", "백업 DB hash가 일치하지 않습니다."); const snapshot = new DatabaseSync(originalDatabase, { readOnly: true });
  try {
    check(snapshot.prepare("PRAGMA quick_check").get()?.quick_check === "ok", 400, "BUNDLE_INVALID", "백업 DB 무결성 검사가 실패했습니다."); check(JSON.stringify(snapshotFiles(snapshot)) === JSON.stringify(manifest.attachments), 400, "BUNDLE_INVALID", "DB snapshot과 파일 manifest가 일치하지 않습니다.");
    const sourcePrivate = await privateDirectory(resolve(source, "private"), config); for (const file of manifest.attachments) await verifiedFile(sourcePrivate, file);
    const destination = await newDirectory(resolve(destinationPath), config); const database = resolve(destination, "archive.sqlite"); const privatePath = resolve(destination, "private"); await mkdir(privatePath, { mode: 0o700 }); await backup(snapshot, database); await chmod(database, 0o600);
    for (const file of manifest.attachments) await writeFile(resolve(privatePath, file.filename), await verifiedFile(sourcePrivate, file), { flag: "wx", mode: 0o600 });
    const restored = new Store(database); try { check(restored.get("PRAGMA quick_check")?.quick_check === "ok", 500, "RESTORE_INVALID", "복구 DB 무결성 검사가 실패했습니다.");if(latest)reconcileRecovery(restored,latest);else check(!config.staffMfaRequired,409,'RECOVERY_LEDGER_REQUIRED','운영 복구에는 최신 신뢰 DB의 보안 원장이 필요합니다.'); } finally { restored.close(); }
    await writeFile(resolve(destination, "restored.json"), JSON.stringify({ version: 1, sourceManifestHash: digest(await readFile(manifestPath)), restoredAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 }); return { restoredDatabase: database, restoredPrivateStorage: privatePath, files: manifest.attachments.length, integrity: "ok" };
  } finally { snapshot.close(); }
}
