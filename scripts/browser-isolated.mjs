import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Keep the real authentication rate limit. Each file/project owns a fresh API fixture.
const root = resolve(import.meta.dirname, "..");
const files = (await readdir(resolve(root, "tests/e2e"))).filter(file => file.endsWith(".spec.ts")).sort();
const requested = process.argv.slice(2);
const selected = requested.length ? files.filter(file => requested.includes(file)) : files;
if (!selected.length || requested.some(file => !files.includes(file))) throw new Error("Select existing E2E spec filenames.");
for (const file of selected) for (const project of ["desktop", "mobile"]) {
  console.log(`Browser verification: ${file} / ${project}`);
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(process.execPath, [resolve(root, "node_modules/@playwright/test/cli.js"), "test", `tests/e2e/${file}`, `--project=${project}`, "--workers=2", `--output=artifacts/browser-results/${file.replace(".spec.ts", "")}-${project}`], { cwd: root, stdio: "inherit", env: { ...process.env, PLAYWRIGHT_HTML_OUTPUT_DIR: `artifacts/browser/${file.replace(".spec.ts", "")}-${project}` } });
    child.on("error", reject); child.on("exit", code => resolveCode(code ?? 1));
  });
  if (code) process.exit(code);
}
