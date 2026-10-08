import { readdir, unlink, lstat, realpath } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const ownedFile = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{64}\.json$/;
/** Remove only obsolete generated shards; never recurse or follow links. */
export async function pruneGeneratedRecordFiles(directory, activeNames) {
  const absolute = resolve(directory);
  const stat = await lstat(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || resolve(await realpath(absolute)) !== absolute) throw new Error("Generated record directory must be a real directory.");
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (!entry.isFile() || !ownedFile.test(entry.name) || activeNames.has(entry.name)) continue;
    const target = resolve(absolute, entry.name);
    if (dirname(target) !== absolute) throw new Error("Generated file escaped its directory.");
    const file = await lstat(target);
    if (file.isFile() && !file.isSymbolicLink()) await unlink(target);
  }
}
