import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import { readConfig, type ApiConfig } from "./config.ts";
import { Store } from "./infrastructure/database.ts";
import { createApp } from "./http/app.ts";
import { createRuntimeAdapters } from "./adapters/runtime-adapters.ts";
import type { Adapters } from "./adapters/contracts.ts";
import { check } from "./domain/errors.ts";

export function startServer(options: { config?: ApiConfig; adapters?: Adapters; inlineWorker?: boolean; log?: (entry: Record<string, unknown>) => void } = {}) {
  const config = options.config || readConfig(); const adapters = options.adapters || createRuntimeAdapters(process.env); const store = new Store(config.dbPath);
  const log = options.log || ((entry: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(entry)}\n`));
  const app = createApp({ store, config, adapters, log }); const inFlight = new Set<Promise<void>>();
  if (config.staticImportFile) {
    try { const info = lstatSync(config.staticImportFile); check(info.isFile() && !info.isSymbolicLink() && info.size <= 10 * 1024 * 1024, 500, "STATIC_IMPORT_INVALID", "초기 공개 자료는 10MiB 이하 일반 로컬 파일이어야 합니다."); app.editorial.importTrustedLocalSnapshot(JSON.parse(readFileSync(config.staticImportFile, "utf8")) as unknown, "startup-static-import"); }
    catch (error) { store.close(); throw error; }
  }
  const server = createServer((request, response) => { const operation = app.handler(request, response); inFlight.add(operation); void operation.finally(() => inFlight.delete(operation)); });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 50;
  let runningJob: Promise<boolean> | null = null;
  const inlineWorker = options.inlineWorker ?? process.env.ARCHIVE_API_INLINE_WORKER !== "false";
  const timer = !inlineWorker ? null : setInterval(() => {
    if (!runningJob) { runningJob = app.worker.tick(); void runningJob.catch(() => log({ timestamp: new Date().toISOString(), level: "error", service: "archive-worker", errorCode: "WORKER_FAILURE" })).finally(() => { runningJob = null; }); }
  }, 1000);
  const ready = new Promise<void>((done, reject) => { server.once("error", reject); server.listen(config.port, config.host, () => { server.removeListener("error", reject); log({ timestamp: new Date().toISOString(), level: "info", service: "archive-api", operation: "listen", host: config.host, port: config.port, capabilities: app.capabilities() }); done(); }); });
  let shutdownPromise: Promise<void> | null = null;
  function shutdown(): Promise<void> {
    shutdownPromise ||= (async () => {
      if (timer) clearInterval(timer);
      const deadline = setTimeout(() => server.closeAllConnections(), 10000); deadline.unref();
      await new Promise<void>((done) => { server.close(() => done()); server.closeIdleConnections(); });
      await Promise.allSettled([...inFlight]); if (runningJob) await runningJob.catch(() => undefined);
      clearTimeout(deadline); store.close(); log({ timestamp: new Date().toISOString(), level: "info", service: "archive-api", operation: "shutdown", status: "complete" });
    })(); return shutdownPromise;
  }
  return { server, store, app, ready, shutdown };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = startServer(); const stop = () => { void runtime.shutdown().finally(() => { if (process.connected) process.disconnect(); }); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  if (process.connected) {
    process.on("message", (message: unknown) => { if (message !== null && typeof message === "object" && "type" in message && message.type === "archive-local-shutdown") stop(); });
    process.on("disconnect", stop);
  }
  void runtime.ready.catch(async (error: NodeJS.ErrnoException) => { process.stderr.write(`${JSON.stringify({ level: "error", service: "archive-api", errorCode: error.code || "SERVER_FAILURE" })}\n`); await runtime.shutdown(); process.exitCode = 1; if (process.connected) process.disconnect(); });
}
