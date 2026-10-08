import { readConfig } from "./config.ts";
import { Store } from "./infrastructure/database.ts";
import { JobWorker } from "./application/jobs.ts";
import { createRuntimeAdapters } from "./adapters/runtime-adapters.ts";
const config = readConfig(); const store = new Store(config.dbPath); const worker = new JobWorker(store, createRuntimeAdapters(process.env), config);
let stopping = false; process.on("SIGINT", () => { stopping = true; }); process.on("SIGTERM", () => { stopping = true; });
if (process.connected) {
  process.on("message", (message: unknown) => { if (message !== null && typeof message === "object" && "type" in message && message.type === "archive-local-shutdown") stopping = true; });
  process.on("disconnect", () => { stopping = true; });
}
try {
  while (!stopping) { const worked = await worker.tick(); if (!worked) await new Promise<void>((resolve) => { setTimeout(resolve, 500); }); }
} finally { store.close(); if (process.connected) process.disconnect(); }
