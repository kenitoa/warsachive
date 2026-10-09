import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm, lstat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { verifyPassword } from "../src/infrastructure/passwords.ts";
import { Store } from "../src/infrastructure/database.ts";
import { readConfig } from "../src/config.ts";
import { AttachmentService } from "../src/application/attachments.ts";
import { AuthService } from "../src/application/auth.ts";
import { EditorialService } from "../src/application/editorial.ts";
import { disabledAdapters } from "../src/adapters/contracts.ts";
import { CollaborationService } from "../src/application/collaboration.ts";
import { backupBundle, restoreBundle } from "../src/infrastructure/backup-bundle.ts";
import { privateDirectory } from "../src/infrastructure/private-storage.ts";
import { startServer } from "../src/server.ts";
import { object } from "../src/domain/validation.ts";
import { enqueue } from "../src/application/jobs.ts";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(resolve(tmpdir(), "war-operations-")); const config = readConfig({ ARCHIVE_API_DB_PATH: resolve(directory, "api.sqlite"), ARCHIVE_API_PRIVATE_STORAGE_DIR: resolve(directory, "private"), ARCHIVE_API_EXPORT_DIR: resolve(directory, "exports") }); const store = new Store(config.dbPath); t.after(async () => { store.close(); assert.ok(directory.startsWith(resolve(tmpdir(), "war-operations-"))); await rm(directory, { recursive: true }); });
  const account = await new AuthService(store, config).bootstrapAdmin("admin@example.org", "Admin", "tested-password-123"); const raw = object(JSON.parse(await readFile(new URL("../../web/content/editorial.json", import.meta.url), "utf8")) as unknown); assert.ok(Array.isArray(raw.records)); const record = object(raw.records[0]); new EditorialService(store, disabledAdapters()).importStatic(account, { version: 1, records: [record] }, "test"); assert.ok(Array.isArray(record.sources)); const sourceId = object(record.sources[0]).id; const attachments = new AttachmentService(store, config); const pdf = Buffer.from("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n"); const input = { recordId: record.id, sourceId, rights: "Private evidence only" }; return { directory, config, store, account, record, attachments, pdf, input };
}

test("online bundle CLI snapshots metadata and private bytes together and restores both to new paths", async (t) => {
  const env = await fixture(t); const first = await env.attachments.upload(env.account, env.input, env.pdf, "application/pdf", "test"); const orphan = `${randomUUID()}.pdf`; await writeFile(resolve(env.config.privateStorageDirectory, orphan), env.pdf); const bundle = resolve(env.directory, "bundle"); const restoredPath = resolve(env.directory, "restored");
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url)); const execute = promisify(execFile); const childEnv = { ...process.env, NODE_ENV: "test", ARCHIVE_API_DB_PATH: env.config.dbPath, ARCHIVE_API_PRIVATE_STORAGE_DIR: env.config.privateStorageDirectory, ARCHIVE_API_EXPORT_DIR: env.config.exportDirectory };
  const backed = await execute(process.execPath, ["--experimental-strip-types", cli, "backup-bundle", bundle], { env: childEnv }); assert.match(backed.stdout, /"files":1/); await env.attachments.upload(env.account, env.input, env.pdf, "application/pdf", "test"); const restored = await execute(process.execPath, ["--experimental-strip-types", cli, "restore-bundle", bundle, restoredPath], { env: childEnv }); assert.match(restored.stdout, /"integrity":"ok"/);
  assert.equal(env.store.get("SELECT count(*) AS count FROM attachments")?.count, 2); const restoredConfig = { ...env.config, dbPath: resolve(restoredPath, "archive.sqlite"), privateStorageDirectory: resolve(restoredPath, "private") }; const saved = new Store(restoredConfig.dbPath);
  try { assert.equal(saved.get("SELECT count(*) AS count FROM attachments")?.count, 1); const downloaded = await new AttachmentService(saved, restoredConfig).download(env.account, String(first.attachmentId), "test"); assert.deepEqual(downloaded.bytes, env.pdf); } finally { saved.close(); }
  assert.equal((await readdir(resolve(bundle, "private"))).length, 1); assert.ok(!(await readdir(resolve(bundle, "private"))).includes(orphan)); await assert.rejects(() => backupBundle(env.store, env.config, bundle), /기존 디렉터리/); await assert.rejects(() => restoreBundle(env.config, bundle, restoredPath), /기존 디렉터리/);
  const filename = (await readdir(resolve(bundle, "private")))[0]; await writeFile(resolve(bundle, "private", filename), Buffer.from("corrupt")); const refused = resolve(env.directory, "refused"); await assert.rejects(() => restoreBundle(env.config, bundle, refused), /무결성/); await assert.rejects(() => lstat(refused), (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT");
});

test("failed upload removes only its newly created private file and backups refuse manifest traversal", async (t) => {
  const env = await fixture(t); await env.attachments.upload(env.account, env.input, env.pdf, "application/pdf", "test"); const previous = await readdir(env.config.privateStorageDirectory); await assert.rejects(() => env.attachments.upload({ ...env.account, id: "missing-account" }, env.input, env.pdf, "application/pdf", "test"), /FOREIGN KEY/); assert.deepEqual(await readdir(env.config.privateStorageDirectory), previous);
  const bundle = resolve(env.directory, "bundle"); await backupBundle(env.store, env.config, bundle); const manifestPath = resolve(bundle, "manifest.json"); const manifest = object(JSON.parse(await readFile(manifestPath, "utf8")) as unknown); assert.ok(Array.isArray(manifest.attachments)); object(manifest.attachments[0]).filename = "../../outside.pdf"; await writeFile(manifestPath, JSON.stringify(manifest)); await assert.rejects(() => restoreBundle(env.config, bundle, resolve(env.directory, "refused")), /manifest/);
});

test("private storage rejects case aliases, public ancestors and symlink directories", async (t) => {
  const env = await fixture(t); const publicPath = fileURLToPath(new URL("../../web/public", import.meta.url)); assert.throws(() => readConfig({ ARCHIVE_API_PRIVATE_STORAGE_DIR: publicPath }), /분리/); assert.throws(() => readConfig({ ARCHIVE_API_PRIVATE_STORAGE_DIR: resolve(publicPath, "..") }), /분리/);
  if (process.platform === "win32") assert.throws(() => readConfig({ ARCHIVE_API_PRIVATE_STORAGE_DIR: publicPath.toUpperCase() }), /분리/);
  const link = resolve(env.directory, "public-link"); await symlink(publicPath, link, process.platform === "win32" ? "junction" : "dir"); await assert.rejects(() => privateDirectory(link, env.config), /심볼릭 링크/);
});

test("cloud shelf rejects values the local parser cannot restore and account export contains only owned data", async (t) => {
  const env = await fixture(t); const collaboration = new CollaborationService(env.store); assert.throws(() => collaboration.putShelf(env.account, { version: 0, payload: { bookmarks: ["a".repeat(81)], notes: {} } }, "test"), /메모/); assert.throws(() => collaboration.putShelf(env.account, { version: 0, payload: { bookmarks: [], notes: { "imjin-war": "a".repeat(4001) } } }, "test"), /메모/); assert.throws(() => collaboration.putShelf(env.account, { version: 0, payload: { bookmarks: ["constructor"], notes: {} } }, "test"), /메모/);
  collaboration.createSpace(env.account, { kind: "study", title: "Owned class" }, "test"); await env.attachments.upload(env.account, env.input, env.pdf, "application/pdf", "test"); const output = new AuthService(env.store, env.config).exportAccount(env.account); assert.equal((output.ownedSpaces as unknown[]).length, 1); assert.equal((output.memberships as unknown[]).length, 1); assert.equal((output.attachments as unknown[]).length, 1); for (const key of ["password_hash", "token_hash", "resetUrl", "filename"]) assert.ok(!JSON.stringify(output).includes(key)); assert.deepEqual(output.orders, []); assert.deepEqual(output.refundRequests, []);
});

test("trusted local startup snapshot exposes real source-checked data without creating users and preserves withdrawals", async (t) => {
  const env = await fixture(t); const snapshot = resolve(env.directory, "static.json"); await writeFile(snapshot, JSON.stringify({ version: 1, records: [env.record] })); const config = { ...env.config, dbPath: resolve(env.directory, "new-api.sqlite"), port: 0, staticImportFile: snapshot };
  const runtime = startServer({ config, adapters: disabledAdapters(), inlineWorker: false, log() {} });
  try { await runtime.ready; assert.equal(runtime.store.get("SELECT count(*) AS count FROM users")?.count, 0); assert.equal(runtime.app.editorial.publicRecords()[0].review.humanReviewed, false); const account = await runtime.app.auth.bootstrapAdmin("operator@example.org", "Operator", "tested-password-123"); const draft = runtime.app.editorial.save(account, null, { record: env.record }, "test"); runtime.app.editorial.transition(account, draft.id, "withhold", { version: draft.version, note: "Permission withdrawn" }, "test"); } finally { await runtime.shutdown(); }
  const restarted = startServer({ config, adapters: disabledAdapters(), inlineWorker: false, log() {} }); try { await restarted.ready; assert.equal(restarted.app.editorial.publicRecords().length, 0); assert.equal(restarted.store.get("SELECT count(*) AS count FROM users")?.count, 1); } finally { await restarted.shutdown(); }
  await writeFile(snapshot, JSON.stringify({ version: 1, records: [{ ...env.record, review: { ...object(env.record.review), status: "approved", humanReviewed: true } }] })); assert.throws(() => startServer({ config, adapters: disabledAdapters(), inlineWorker: false, log() {} }), /인적 승인/);
  assert.equal(readConfig({}).staticImportFile, null);
});

test("independent API and worker processes can initialize the same database migrations safely", async (t) => {
  const env = await fixture(t); const path = resolve(env.directory, "concurrent.sqlite"); const databaseModule = new URL("../src/infrastructure/database.ts", import.meta.url).href; const source = `import { Store } from ${JSON.stringify(databaseModule)}; const store = new Store(process.argv[1]); process.stdout.write(JSON.stringify({count:store.get('SELECT count(*) AS count FROM schema_migrations').count,integrity:store.get('PRAGMA quick_check').quick_check})); store.close();`;
  const execute = promisify(execFile); const results = await Promise.all([1, 2, 3, 4].map(() => execute(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", source, path]))); const expected = env.store.get("SELECT count(*) AS count FROM schema_migrations")?.count; for (const result of results) { const value = object(JSON.parse(result.stdout) as unknown); assert.equal(value.count, expected); assert.equal(value.integrity, "ok"); }
});

test("administrator CLI accepts piped stdin while preserving password whitespace and refuses a second bootstrap", async (t) => {
  const env = await fixture(t); const path = resolve(env.directory, "admin-cli.sqlite"); const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url)); const password = "  cli-password-with-spaces  "; const commandEnv = { ...process.env, NODE_ENV: "test", ARCHIVE_API_DB_PATH: path, ARCHIVE_BOOTSTRAP_PASSWORD: "" };
  const output = await new Promise<string>((done, reject) => { const child = execFile(process.execPath, ["--experimental-strip-types", cli, "admin", "operator@example.org", "Operator"], { env: commandEnv }, (error, stdout) => error ? reject(error) : done(stdout)); child.stdin?.end(`${password}\r\n`); }); assert.match(output, /"role":"admin"/); const saved = new Store(path);
  try { assert.equal(await verifyPassword(password, String(saved.get("SELECT password_hash FROM users WHERE email='operator@example.org'")?.password_hash)), true); } finally { saved.close(); }
  await assert.rejects(() => promisify(execFile)(process.execPath, ["--experimental-strip-types", cli, "admin", "second@example.org", "Second"], { env: { ...commandEnv, ARCHIVE_BOOTSTRAP_PASSWORD: "tested-password-123" } }));
});

for (const entry of ["server", "worker"] as const) for (const channel of ["message", "disconnect"] as const) {
  test(`${entry} child closes cleanly on local IPC ${channel} and preserves the existing SQLite data`, async (t) => {
    const env = await fixture(t); const probe = createServer(); await new Promise<void>(done => probe.listen(0, "127.0.0.1", done)); const port = (probe.address() as AddressInfo).port; await new Promise<void>(done => probe.close(() => done()));
    if (entry === "worker") enqueue(env.store, "export", "ipc-queue-check", {});
    const child = spawn(process.execPath, ["--experimental-strip-types", fileURLToPath(new URL(`../src/${entry}.ts`, import.meta.url))], {
      windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"], env: {
        ...process.env, NODE_ENV: "test", ARCHIVE_API_DB_PATH: env.config.dbPath, ARCHIVE_API_PRIVATE_STORAGE_DIR: env.config.privateStorageDirectory, ARCHIVE_API_EXPORT_DIR: env.config.exportDirectory,
        ARCHIVE_API_HOST: "127.0.0.1", ARCHIVE_API_PORT: String(port), ARCHIVE_API_ALLOWED_ORIGINS: "http://127.0.0.1:3000", ARCHIVE_API_PUBLIC_URL: "http://127.0.0.1:3000", ARCHIVE_API_SESSION_SECRET: env.config.sessionSecret, ARCHIVE_API_STATIC_IMPORT_FILE: "", ARCHIVE_API_INLINE_WORKER: "false", ARCHIVE_PUBLICATION_SECRET: "", ARCHIVE_PRODUCTS_JSON: "[]", ARCHIVE_AI_DAILY_REQUEST_LIMIT: "100",
        STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_API_VERSION: "", ARCHIVE_AI_ENABLED: "false", OPENAI_API_KEY: "", ARCHIVE_AI_MODEL: "", ARCHIVE_AI_EVALUATION_APPROVED: "false", ARCHIVE_NOTIFICATION_URL: "", ARCHIVE_NOTIFICATION_SECRET: "", ARCHIVE_NOTIFICATION_ALLOWED_HOSTS: ""
      }
    });
    assert.ok(child.stdout && child.stderr); let stdout = ""; child.stdout.on("data", (bytes: Buffer) => { stdout += bytes.toString(); }); child.stderr.resume(); const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done, reject) => { child.once("error", reject); child.once("exit", (code, signal) => done({ code, signal })); });
    t.after(async () => { if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; } });
    const deadline = Date.now() + 10000; let ready = false;
    while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
      if (entry === "server") { try { const response = await fetch(`http://127.0.0.1:${port}/health/ready`, { signal: AbortSignal.timeout(300) }); await response.body?.cancel(); ready = response.ok; } catch { /* Retry only while the bounded child startup is pending. */ } }
      else ready = Number(env.store.get("SELECT attempts FROM jobs WHERE job_key='ipc-queue-check'")?.attempts) >= 1;
      if (ready) break; await new Promise<void>(done => setTimeout(done, 25));
    }
    assert.ok(ready, `${entry} did not become ready`); if (channel === "message") child.send({ type: "archive-local-shutdown" }); else child.disconnect();
    const timeout = setTimeout(() => child.kill(), 10000); let result: { code: number | null; signal: NodeJS.Signals | null }; try { result = await exited; } finally { clearTimeout(timeout); }
    assert.equal(result.code, 0); assert.equal(result.signal, null); if (entry === "server") assert.match(stdout, /"operation":"shutdown","status":"complete"/);
    assert.equal(env.store.get("SELECT name FROM users WHERE id=?", env.account.id)?.name, "Admin"); assert.equal(env.store.get("PRAGMA quick_check")?.quick_check, "ok"); if (entry === "worker") assert.equal(env.store.get("SELECT status FROM jobs WHERE job_key='ipc-queue-check'")?.status, "pending");
  });
}
