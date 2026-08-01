import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const contentDirectory = join(scriptDirectory, "..", "content");
const archiveDirectory = join(contentDirectory, "archive");
const indexPath = join(contentDirectory, "main.json");
const safeFileName = /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/;

const entries = await readdir(archiveDirectory, { withFileTypes: true });
const jsonFiles = entries
  .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase().endsWith(".json"))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "en"));

for (const fileName of jsonFiles) {
  if (!safeFileName.test(fileName)) {
    throw new Error(`허용되지 않은 아카이브 파일명입니다: ${fileName}`);
  }

  const filePath = join(archiveDirectory, fileName);
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    if (!payload || typeof payload !== "object") {
      throw new Error("JSON 최상위 값은 객체여야 합니다.");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`발행 파일을 인덱싱할 수 없습니다 (${fileName}): ${reason}`);
  }
}

const nextIndex = {
  version: 1,
  published: jsonFiles.map((fileName) => `archive/${fileName}`)
};
const serializedIndex = `${JSON.stringify(nextIndex, null, 2)}\n`;

let currentIndex = "";
try {
  currentIndex = await readFile(indexPath, "utf8");
} catch (error) {
  const isMissing = error && typeof error === "object" && "code" in error && error.code === "ENOENT";
  if (!isMissing) throw error;
}

if (currentIndex === serializedIndex) {
  console.log(`Content index is current (${jsonFiles.length} published file${jsonFiles.length === 1 ? "" : "s"}).`);
} else {
  await writeFile(indexPath, serializedIndex, "utf8");
  console.log(`Updated content/main.json with ${jsonFiles.length} published file${jsonFiles.length === 1 ? "" : "s"}.`);
}
