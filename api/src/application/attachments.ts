import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { Store } from "../infrastructure/database.ts";
import type { ApiConfig } from "../config.ts";
import { type User } from "./auth.ts";
import { requirePermission } from "../domain/permissions.ts";
import { check } from "../domain/errors.ts";
import { identifier, text } from "../domain/validation.ts";
import { publicRecord } from "../domain/archive.ts";
import { privateDirectory, verifiedFile } from "../infrastructure/private-storage.ts";

const maxSize = 5 * 1024 * 1024;
export function attachmentType(bytes: Buffer, mime: string): "png" | "jpg" | "pdf" {
  check(bytes.length > 0 && bytes.length <= maxSize, 413, "ATTACHMENT_SIZE", "파일은 5MiB 이하여야 합니다.");
  if (mime === "image/png") {
    check(bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.readUInt32BE(8) === 13 && bytes.subarray(12, 16).toString("ascii") === "IHDR" && bytes.subarray(bytes.length - 8, bytes.length - 4).toString("ascii") === "IEND", 415, "ATTACHMENT_FORMAT", "PNG 파일 형식을 확인해 주세요.");
    const width = bytes.readUInt32BE(16); const height = bytes.readUInt32BE(20); check(width > 0 && height > 0 && width * height <= 40000000, 415, "ATTACHMENT_FORMAT", "이미지 크기가 허용 범위를 초과했습니다."); return "png";
  }
  if (mime === "image/jpeg") { check(bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217, 415, "ATTACHMENT_FORMAT", "JPEG 파일 형식을 확인해 주세요."); return "jpg"; }
  if (mime === "application/pdf") { check(/^%PDF-1\.[0-9]/.test(bytes.subarray(0, 8).toString("ascii")) && /%%EOF\s*$/.test(bytes.subarray(Math.max(0, bytes.length - 1024)).toString("ascii")), 415, "ATTACHMENT_FORMAT", "PDF 파일 형식을 확인해 주세요."); return "pdf"; }
  check(false, 415, "ATTACHMENT_FORMAT", "PNG·JPEG·PDF 검수 자료만 허용합니다.");
}
export class AttachmentService {
  readonly store: Store; readonly config: ApiConfig;
  constructor(store: Store, config: ApiConfig) { this.store = store; this.config = config; }
  list(user: User | null, recordId?: string): Record<string, unknown> { requirePermission(user, "content:read"); return { items: this.store.all(`SELECT a.id AS attachmentId,a.record_id AS recordId,a.source_id AS sourceId,a.content_type AS contentType,a.size,a.sha256,a.rights,a.created_at AS createdAt,COALESCE(s.status,'unknown') AS scanStatus,s.scanner,s.scanned_at AS scannedAt,s.scanned_at AS scanObservedAt FROM attachments a LEFT JOIN attachment_scans s ON s.attachment_id=a.id${recordId ? " WHERE a.record_id=?" : ""} ORDER BY a.created_at DESC LIMIT 500`, ...recordId ? [identifier(recordId)] : []) }; }
  async upload(user: User | null, input: { recordId: unknown; sourceId: unknown; rights: unknown }, bytes: Buffer, mime: string, requestId: string): Promise<Record<string, unknown>> {
    const account = requirePermission(user, "content:read"); const recordId = identifier(input.recordId); const sourceId = identifier(input.sourceId); const rights = text(input.rights, "사용권과 검수 목적", 2000);
    const stored = this.store.get("SELECT payload FROM drafts WHERE record_id=?", recordId) || this.store.get("SELECT payload FROM public_records WHERE record_id=?", recordId); check(stored, 404, "RESOURCE_NOT_FOUND", "검수 자료에 연결할 기록을 찾을 수 없습니다."); const record = publicRecord(JSON.parse(String(stored.payload)) as unknown); check(record.sources.some((source) => source.id === sourceId), 400, "SOURCE_MISMATCH", "검수 자료의 출처가 기록에 연결되어 있지 않습니다."); const extension = attachmentType(bytes, mime);
    await mkdir(this.config.privateStorageDirectory, { recursive: true, mode: 0o700 }); const directory = await privateDirectory(this.config.privateStorageDirectory, this.config);
    const id = randomUUID(); const filename = `${id}.${extension}`; const destination = resolve(directory, filename); const rel = relative(directory, destination); check(!rel.startsWith("..") && !isAbsolute(rel), 500, "STORAGE_UNSAFE", "저장소 범위를 벗어난 경로입니다."); const sha256 = createHash("sha256").update(bytes).digest("hex"); const createdAt = new Date().toISOString();
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    try { this.store.transaction(() => { this.store.run("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?,?)", id, recordId, sourceId, account.id, mime, extension, bytes.length, sha256, filename, rights, createdAt); this.store.audit(account.id, "attachment.upload", id, requestId); }); }
    catch (error) { try { await unlink(destination); } catch (cleanupError) { throw new AggregateError([error, cleanupError], "Private upload database write and cleanup failed.", { cause: cleanupError }); } throw error; }
    return { attachmentId: id, recordId, sourceId, contentType: mime, size: bytes.length, sha256, rights, createdAt,scanStatus:'unknown',scanner:null,scannedAt:null,scanObservedAt:null };
  }
  async download(user: User | null, id: string, requestId: string): Promise<{ bytes: Buffer; contentType: string; filename: string }> {
    const account = requirePermission(user, "content:read"); const row = this.store.get("SELECT * FROM attachments WHERE id=?", identifier(id)); check(row, 404, "RESOURCE_NOT_FOUND", "검수 파일을 찾을 수 없습니다.");check(this.store.get('SELECT status FROM attachment_scans WHERE attachment_id=?',id)?.status!=='rejected',403,'FILE_QUARANTINED','보안 검사에서 차단된 파일입니다.'); const filename = String(row.filename); const directory = await privateDirectory(this.config.privateStorageDirectory, this.config); const bytes = await verifiedFile(directory, { attachmentId: String(row.id), filename, contentType: String(row.content_type), size: Number(row.size), sha256: String(row.sha256) }); this.store.audit(account.id, "attachment.download", id, requestId); return { bytes, contentType: String(row.content_type), filename };
  }
}
