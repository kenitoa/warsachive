import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isArchiveRecord, isPublicRecord, isEditorialTheme, isEditorialCollection, isEditorialStory, parseArchivePayload, mergeArchiveRecords, toPendingArchiveRecord } from "../lib/archive-domain.ts";
import { readSignedPublication, applyPublication } from "../lib/publication-import.mjs";

const contentDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../content");
export async function readArchiveContent(directory = contentDirectory) {
  const readJson = async (path) => JSON.parse(await readFile(resolve(directory, path), "utf8"));
  const [editorial, index, baseline] = await Promise.all([readJson("editorial.json"), readJson("main.json"), readJson("legacy-manifest.json")]);
  if (editorial.version !== 1 || !Array.isArray(editorial.records) || !editorial.records.every(isArchiveRecord)) throw new Error("Editorial record schema failed.");
  if (!Array.isArray(editorial.themes) || !editorial.themes.every(isEditorialTheme) || !Array.isArray(editorial.collections) || !editorial.collections.every(isEditorialCollection) || !Array.isArray(editorial.stories) || !editorial.stories.every(isEditorialStory)) throw new Error("Editorial reading-path schema failed.");
  if (index.version !== 1 || !Array.isArray(index.published) || new Set(index.published).size !== index.published.length) throw new Error("Published index schema failed.");
  if (!Number.isFinite(Date.parse(baseline.capturedAt))) throw new Error("Legacy baseline date is missing.");
  const loaded = [];
  for (const path of index.published) {
    if (typeof path !== "string" || !/^archive\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(path)) throw new Error("Published content path is outside the archive.");
    loaded.push(...parseArchivePayload(await readJson(path)));
  }
  const publication = readSignedPublication(process.env.ARCHIVE_APPROVED_EXPORT_FILE, process.env.ARCHIVE_PUBLICATION_VERIFY_SECRET);
  const records = applyPublication(mergeArchiveRecords(loaded, editorial.records, (record) => toPendingArchiveRecord(record, baseline.capturedAt)), publication);
  const withheld = new Set(publication.withheldIds);
  const visible = items => items.filter(item => !item.recordIds.some(id => withheld.has(id)));
  return { editorial: { ...editorial, themes: visible(editorial.themes), collections: visible(editorial.collections), stories: visible(editorial.stories) }, records, publicRecords: records.filter(isPublicRecord) };
}
