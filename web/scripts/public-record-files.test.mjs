import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneGeneratedRecordFiles } from "./public-record-files.mjs";

test("withdrawal removes only obsolete generated shards and preserves unrelated files and directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "archive-shards-"));
  const current = `imjin-war-${"a".repeat(64)}.json`;
  const withdrawn = `jeongyu-war-${"b".repeat(64)}.json`;
  await Promise.all([writeFile(join(directory,current),"{}"), writeFile(join(directory,withdrawn),"{}"), writeFile(join(directory,"operator-note.json"),"keep"), mkdir(join(directory,`nested-${"c".repeat(64)}.json`))]);
  await pruneGeneratedRecordFiles(directory,new Set([current]));
  assert.deepEqual((await readdir(directory)).sort(),[current,`nested-${"c".repeat(64)}.json`,"operator-note.json"].sort());
});
