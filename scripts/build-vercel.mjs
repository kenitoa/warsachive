import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environment = { ...process.env };
environment.ARCHIVE_RELEASE_SHA ||= environment.VERCEL_GIT_COMMIT_SHA;
const publication = [environment.ARCHIVE_APPROVED_EXPORT_JSON, environment.ARCHIVE_PUBLICATION_VERIFY_SECRET, environment.ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET];
let privateDirectory;
try {
  if (publication.some(Boolean)) {
    if (!publication.every(Boolean)) throw new Error("Configure all three signed-publication secrets together.");
    JSON.parse(publication[0]);
    privateDirectory = await mkdtemp(resolve(tmpdir(), "archive-publication-"));
    environment.ARCHIVE_APPROVED_EXPORT_FILE = resolve(privateDirectory, "approved.json");
    await writeFile(environment.ARCHIVE_APPROVED_EXPORT_FILE, publication[0], { mode: 0o600, flag: "wx" });
  }
  // Keep validation in the Vercel build so a failed check cannot become production.
  for (const args of [["run", "lint"], ["run", "typecheck"], ["run", "test"], ["run", "content:gate"], ["run", "build"], ["run", "test:static"]]) {
    const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { cwd: root, env: environment, stdio: "inherit", shell: process.platform === "win32" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Vercel validation failed: npm ${args.join(" ")}`);
  }
} finally {
  if (privateDirectory) await rm(privateDirectory, { recursive: true });
}
