import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { normalizeRscPaths } from "./normalize-rsc-paths.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "warsachive-rsc-"));
  t.after(async () => {
    const target = resolve(directory);
    if (!target.startsWith(`${resolve(tmpdir())}${sep}warsachive-rsc-`)) throw new Error("RSC fixture cleanup escaped the task temporary directory.");
    await rm(target, { recursive: true });
  });
  return directory;
}
test("Windows nested RSC segment exports gain the actual dot-separated client request path", async (t) => {
  const directory = await fixture(t);
  const parent = join(directory, "archive", "imjin-war");
  const nested = join(parent, "__next.archive", "$d$id");
  await mkdir(nested, { recursive: true });
  const source = join(nested, "__PAGE__.txt");
  await writeFile(source, "historical RSC payload");
  const result = await normalizeRscPaths(directory);
  assert.equal(result.copied, 1);
  assert.equal(await readFile(join(parent, "__next.archive.$d$id.__PAGE__.txt"), "utf8"), "historical RSC payload");
  assert.equal(await readFile(source, "utf8"), "historical RSC payload");
  assert.equal((await normalizeRscPaths(directory)).copied, 0);
});
test("flat Linux RSC output and unrelated files stay unchanged", async (t) => {
  const directory = await fixture(t);
  await writeFile(join(directory, "__next._full.txt"), "flat");
  await mkdir(join(directory, "other"));
  await writeFile(join(directory, "other", "page.txt"), "unrelated");
  assert.deepEqual(await normalizeRscPaths(directory), { copied: 0, alreadyPresent: 0 });
  assert.equal(await readFile(join(directory, "__next._full.txt"), "utf8"), "flat");
});
test("normalization rejects conflicting destinations before changing any existing content", async (t) => {
  const directory = await fixture(t);
  await mkdir(join(directory, "__next.archive"));
  await writeFile(join(directory, "__next.archive", "__PAGE__.txt"), "source");
  await writeFile(join(directory, "__next.archive.__PAGE__.txt"), "existing other content");
  await assert.rejects(normalizeRscPaths(directory), /Conflicting/);
  assert.equal(await readFile(join(directory, "__next.archive.__PAGE__.txt"), "utf8"), "existing other content");
});
test("normalization does not traverse a directory link outside its output root", async (t) => {
  const directory = await fixture(t);
  const output = join(directory, "out"); const external = join(directory, "outside");
  await mkdir(output); await mkdir(external);
  await symlink(external, join(output, "__next.link"), "junction");
  await assert.rejects(normalizeRscPaths(output), /symbolic links/);
});
