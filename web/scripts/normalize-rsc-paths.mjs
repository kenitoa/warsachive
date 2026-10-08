import { readdir, realpath, readFile, lstat, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Next Windows exports can retain directory separators inside __next segment names. */
export async function collectNestedRscFiles(directory) {
  if ((await lstat(resolve(directory))).isSymbolicLink()) throw new Error("Static export normalization refuses a symbolic output root.");
  const root = await realpath(resolve(directory));
  const mappings = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const source = resolve(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Static export normalization refuses symbolic links.");
      if (entry.isDirectory()) { await visit(source); continue; }
      if (!entry.isFile() || !entry.name.endsWith(".txt")) continue;
      const parts = relative(root, source).split(sep);
      const segmentIndex = parts.findIndex((part) => part.startsWith("__next."));
      if (segmentIndex < 0 || segmentIndex === parts.length - 1) continue;
      const target = resolve(root, ...parts.slice(0, segmentIndex), parts.slice(segmentIndex).join("."));
      const realSource = await realpath(source);
      if (!realSource.startsWith(`${root}${sep}`) || !target.startsWith(`${root}${sep}`)) throw new Error("RSC segment mapping escaped the static output directory.");
      mappings.push({ source, target });
    }
  }
  await visit(root);
  return mappings;
}

export async function normalizeRscPaths(directory) {
  const mappings = await collectNestedRscFiles(directory);
  const copies = [];
  // Validate every destination before copying. Existing files are never overwritten.
  for (const mapping of mappings) {
    const source = await readFile(mapping.source);
    try {
      const destination = await lstat(mapping.target);
      if (!destination.isFile() || destination.isSymbolicLink() || !(await readFile(mapping.target)).equals(source)) throw new Error(`Conflicting RSC destination: ${mapping.target}`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") copies.push(mapping);
      else throw error;
    }
  }
  for (const { source, target } of copies) await copyFile(source, target, constants.COPYFILE_EXCL);
  return { copied: copies.length, alreadyPresent: mappings.length - copies.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../out");
  console.log(JSON.stringify({ operation: "normalize_static_rsc_paths", ...(await normalizeRscPaths(directory)) }));
}
