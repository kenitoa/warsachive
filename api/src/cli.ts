import { readFile, mkdir, lstat, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { readConfig } from "./config.ts";
import { Store } from "./infrastructure/database.ts";
import { AuthService, type UserRole } from "./application/auth.ts";
import { EditorialService } from "./application/editorial.ts";
import { disabledAdapters } from "./adapters/contracts.ts";
import { check } from "./domain/errors.ts";
import { backupBundle, restoreBundle } from "./infrastructure/backup-bundle.ts";
import { OperationsService } from './application/operations.ts';
import { reconcileRecovery } from './application/recovery.ts';

const config = readConfig();
if(['restore','restore-bundle'].includes(process.argv[2])){let info;try{info=await lstat(config.dbPath);}catch{check(false,409,'RECOVERY_LEDGER_REQUIRED','현재 DB의 최신 보안 원장을 먼저 복구해 주세요. 빈 DB를 자동 생성하여 복구를 승인하지 않습니다.');}check(info.isFile()&&!info.isSymbolicLink(),409,'RECOVERY_LEDGER_REQUIRED','최신 신뢰 DB의 일반 파일이 필요합니다.');}
const store = new Store(config.dbPath);
try {
  const command = process.argv[2];
  if (command === "admin") {
    check(!process.stdin.isTTY || process.env.ARCHIVE_BOOTSTRAP_PASSWORD, 400, "PASSWORD_REQUIRED", "비밀번호를 stdin 또는 일시적 ARCHIVE_BOOTSTRAP_PASSWORD로 전달해 주세요. 명령 인수로 전달하지 않습니다.");
    let pass = process.env.ARCHIVE_BOOTSTRAP_PASSWORD || "";
    if (!pass) { const chunks: Buffer[] = []; for await (const chunk of process.stdin) { chunks.push(Buffer.from(chunk as Buffer)); check(Buffer.concat(chunks).length <= 1024, 400, "INVALID_PASSWORD", "비밀번호 입력이 너무 큽니다."); } pass = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, ""); }
    const user = await new AuthService(store, config).bootstrapAdmin(process.argv[3] || "", process.argv[4] || "", pass); process.stdout.write(`${JSON.stringify({ id: user.id, email: user.email, role: user.role })}\n`);
  } else if (command === "import") {
    const file = resolve(process.argv[3] || ""); const administrator = store.get("SELECT id,email,name,role FROM users WHERE role='admin' AND deactivated=0 LIMIT 1"); check(administrator, 409, "ADMIN_REQUIRED", "최초 관리자를 먼저 생성해야 합니다."); const input: unknown = JSON.parse(await readFile(file, "utf8")); const service = new EditorialService(store, disabledAdapters()); const result = service.importStatic({ id: String(administrator.id), email: String(administrator.email), name: String(administrator.name), role: administrator.role as UserRole }, input, "cli-import"); process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if(command==='deployment-evidence'){
    check(process.argv[3],400,'EVIDENCE_PATH_REQUIRED','서명된 실측 증거 JSON 경로가 필요합니다.');const file=resolve(process.argv[3]),info=await lstat(file);check(info.isFile()&&!info.isSymbolicLink()&&info.size<=8*1024*1024,400,'INVALID_EVIDENCE','증거 파일을 확인해 주세요.');process.stdout.write(`${JSON.stringify(new OperationsService(store,config).ingestEvidence(JSON.parse(await readFile(file,'utf8')) as unknown))}\n`);
  } else if (command === "backup") {
    check(process.argv[3], 400, "BACKUP_PATH_REQUIRED", "새 백업 파일 경로가 필요합니다."); const destination = resolve(process.argv[3]); check(destination !== config.dbPath, 400, "INVALID_BACKUP_PATH", "원본 DB를 백업 대상으로 사용할 수 없습니다.");
    let exists = true; try { await lstat(destination); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false; else throw error; } check(!exists, 409, "BACKUP_EXISTS", "기존 백업을 덮어쓰지 않습니다."); await mkdir(dirname(destination), { recursive: true, mode: 0o700 }); await backup(store.db, destination); await chmod(destination, 0o600); const verification = new DatabaseSync(destination, { readOnly: true }); try { check(verification.prepare("PRAGMA quick_check").get()?.quick_check === "ok", 500, "BACKUP_INVALID", "백업 무결성 검사가 실패했습니다."); } finally { verification.close(); } process.stdout.write(`${JSON.stringify({ backup: destination, integrity: "ok" })}\n`);
  } else if (command === "restore") {
    check(process.argv[3] && process.argv[4], 400, "RESTORE_PATH_REQUIRED", "백업 원본과 새 DB 경로를 지정해 주세요."); const source = resolve(process.argv[3]); const destination = resolve(process.argv[4]); check(source !== destination && destination !== config.dbPath, 400, "INVALID_RESTORE_PATH", "기존 운영 DB나 백업 원본을 덮어쓰지 않습니다."); const information = await lstat(source); check(information.isFile() && !information.isSymbolicLink(), 400, "INVALID_RESTORE_PATH", "백업 원본은 일반 파일이어야 합니다."); let exists = true; try { await lstat(destination); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false; else throw error; } check(!exists, 409, "RESTORE_EXISTS", "복구 대상은 새 파일이어야 합니다.");
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 }); const snapshot = new DatabaseSync(source, { readOnly: true }); try { check(snapshot.prepare("PRAGMA quick_check").get()?.quick_check === "ok", 400, "BACKUP_INVALID", "백업 무결성 검사가 실패했습니다."); await backup(snapshot, destination); } finally { snapshot.close(); } await chmod(destination, 0o600); const restored = new Store(destination); try { check(restored.get("PRAGMA quick_check")?.quick_check === "ok", 500, "RESTORE_INVALID", "복구 무결성 검사가 실패했습니다.");reconcileRecovery(restored,store); } finally { restored.close(); } process.stdout.write(`${JSON.stringify({ restored: destination, integrity: "ok", nextStep: "Stop the service, configure ARCHIVE_API_DB_PATH to this verified file, and restart. The original database was preserved." })}\n`);
  } else if (command === "backup-bundle") {
    check(process.argv[3], 400, "BACKUP_PATH_REQUIRED", "새 bundle 디렉터리 경로가 필요합니다."); process.stdout.write(`${JSON.stringify(await backupBundle(store, config, process.argv[3]))}\n`);
  } else if (command === "restore-bundle") {
    check(process.argv[3] && process.argv[4], 400, "RESTORE_PATH_REQUIRED", "백업 bundle과 새 복구 디렉터리를 지정해 주세요."); process.stdout.write(`${JSON.stringify({ ...await restoreBundle(config, process.argv[3], process.argv[4],store), nextStep: "Stop the service, configure both ARCHIVE_API_DB_PATH and ARCHIVE_API_PRIVATE_STORAGE_DIR to the verified restored paths, then restart. Original data was preserved. Rebuild all static artifacts; all restored sessions and resets were revoked." })}\n`);
  } else if (command === "check") { check(store.get("PRAGMA quick_check")?.quick_check === "ok", 500, "DATABASE_INVALID", "DB 무결성 검사가 실패했습니다."); process.stdout.write("Database integrity: ok\n"); }
  else check(false, 400, "UNKNOWN_COMMAND", "지원 명령: admin, import, backup, restore, backup-bundle, restore-bundle, check");
} finally { store.close(); }
