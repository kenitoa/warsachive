import { constants } from "node:fs";
import { lstat, realpath, open } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { ApiConfig } from "../config.ts";
import { check } from "../domain/errors.ts";

export type AttachmentFile = { attachmentId: string; filename: string; contentType: string; size: number; sha256: string };
export function inside(directory: string, candidate: string): boolean { const rel = relative(directory, candidate); return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)); }
export async function privateDirectory(path: string, config: ApiConfig): Promise<string> {
  const info = await lstat(path); check(info.isDirectory() && !info.isSymbolicLink(), 500, "STORAGE_UNSAFE", "비공개 저장소는 심볼릭 링크가 아닌 디렉터리여야 합니다."); const directory = await realpath(path);
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  for (const scope of [resolve(repositoryRoot, "web/public"), resolve(repositoryRoot, "web/out"), config.exportDirectory]) {
    let boundary = resolve(scope); try { boundary = await realpath(scope); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    check(!inside(boundary, directory) && !inside(directory, boundary), 500, "STORAGE_UNSAFE", "비공개 파일을 공개 또는 발행 디렉터리 및 상위 경로에 저장하지 않습니다.");
  }
  return directory;
}
export async function verifiedFile(directory: string, file: AttachmentFile): Promise<Buffer> {
  check(/^[a-f0-9-]{36}\.(png|jpg|pdf)$/.test(file.filename) && /^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= 5 * 1024 * 1024, 500, "STORAGE_UNSAFE", "검수 파일 메타데이터와 경로를 확인할 수 없습니다.");
  const source = resolve(directory, file.filename); check(inside(directory, source), 500, "STORAGE_UNSAFE", "저장 파일 경로가 올바르지 않습니다."); const before = await lstat(source); check(before.isFile() && !before.isSymbolicLink() && before.size === file.size, 500, "ATTACHMENT_DAMAGED", "검수 파일 무결성을 확인하지 못했습니다.");
  check(await realpath(source) === source, 500, "STORAGE_UNSAFE", "저장 파일의 실제 경로가 올바르지 않습니다.");
  const handle = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { const opened = await handle.stat(); check(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.size === file.size, 500, "ATTACHMENT_DAMAGED", "검수 파일 무결성을 확인하지 못했습니다."); const bytes = await handle.readFile(); check(bytes.length === file.size && createHash("sha256").update(bytes).digest("hex") === file.sha256, 500, "ATTACHMENT_DAMAGED", "검수 파일 무결성을 확인하지 못했습니다."); return bytes; } finally { await handle.close(); }
}
