import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import archiveIndex from "../content/main.json";
import editorialPayload from "../content/editorial.json";
import legacyManifest from "../content/legacy-manifest.json";
import { getArchiveCounts, isArchiveRecord, isEditorialCollection, isEditorialStory, isEditorialTheme, isLegacyArchiveRecord, isPublicRecord, mergeArchiveRecords, parseArchivePayload, toPendingArchiveRecord, toSearchRecord } from "./archive-domain";
import type { LoadedArchiveRecord } from "./archive-domain";
import type { ArchiveRecord, EditorialCollection, EditorialStory, EditorialTheme, SearchRecord } from "./archive-types";
import { readSignedPublication, applyPublication } from "./publication-import.mjs";
import { approvedPageEvidence } from "./publication-page-evidence";

export type { ArchiveRecord } from "./archive-types";
export type ArchiveEvent = ArchiveRecord;

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function contentDirectory() {
  const directory = [resolve(process.cwd(), "content"), resolve(process.cwd(), "web", "content")]
    .find((candidate) => existsSync(resolve(candidate, "main.json")));
  if (!directory) throw new Error("공개 콘텐츠 폴더를 찾을 수 없습니다.");
  return directory;
}
function readArchiveRecords(path: string, directory: string): LoadedArchiveRecord[] {
  if (!/^archive\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(path)) throw new Error("허용되지 않은 공개 콘텐츠 경로: " + path);
  const resolved = resolve(directory, path);
  if (!resolved.toLowerCase().startsWith((resolve(directory, "archive") + sep).toLowerCase())) throw new Error("공개 콘텐츠 폴더 밖의 경로입니다.");
  const payload: unknown = JSON.parse(readFileSync(resolved, "utf8"));
  try { return parseArchivePayload(payload); }
  catch (error) { throw new Error("공개 콘텐츠 형식이 올바르지 않습니다: " + path, { cause: error }); }
}
const index: unknown = archiveIndex;
if (!object(index) || index.version !== 1 || !strings(index.published) || new Set(index.published).size !== index.published.length) {
  throw new Error("공개 콘텐츠 인덱스가 올바르지 않습니다.");
}
const directory = contentDirectory();
const loadedRecords = index.published.flatMap((path) => readArchiveRecords(path, directory));
const legacyRecords = loadedRecords.filter(isLegacyArchiveRecord);
if (new Set(loadedRecords.map((record) => record.id)).size !== loadedRecords.length) throw new Error("발행 기록의 ID가 중복됩니다.");


const editorial: unknown = editorialPayload;
if (!object(editorial) || editorial.version !== 1 || !Array.isArray(editorial.records) || !editorial.records.every(isArchiveRecord)
  || !Array.isArray(editorial.themes) || !editorial.themes.every(isEditorialTheme)
  || !Array.isArray(editorial.collections) || !editorial.collections.every(isEditorialCollection)
  || !Array.isArray(editorial.stories) || !editorial.stories.every(isEditorialStory)) throw new Error("편집 콘텐츠의 필수 필드 또는 형식이 올바르지 않습니다.");
if (new Set(editorial.records.map((record) => record.id)).size !== editorial.records.length) throw new Error("편집 기록의 ID가 중복됩니다.");
const publication = readSignedPublication(process.env.ARCHIVE_APPROVED_EXPORT_FILE, process.env.ARCHIVE_PUBLICATION_VERIFY_SECRET);
export function getPublicationPageEvidence(record: ArchiveRecord) { return approvedPageEvidence(record, publication); }
export const archiveRecords: ArchiveRecord[] = applyPublication(mergeArchiveRecords(loadedRecords, editorial.records,
  (record) => toPendingArchiveRecord(record, legacyManifest.capturedAt)), publication);
const legacyIds = new Set(legacyRecords.map((record) => record.id));
export const archiveEvents: ArchiveRecord[] = archiveRecords.filter(isPublicRecord);
const publicIds = new Set(archiveEvents.map((record) => record.id));
const withheldIds = new Set(publication.withheldIds);
const visible = <T extends { recordIds: string[] }>(items: T[]): T[] => items.filter(item => !item.recordIds.some(id => withheldIds.has(id)));
const visibleThemes = visible(editorial.themes);
const visibleCollections = visible(editorial.collections);
const visibleStories = visible(editorial.stories);
const publicSources = new Set(archiveEvents.flatMap((record) => record.sources.map((source) => source.id)));
const sourceDefinitions = new Map<string, string>();
for (const source of archiveEvents.flatMap((record) => record.sources)) {
  const serialized = JSON.stringify(source);
  if (sourceDefinitions.has(source.id) && sourceDefinitions.get(source.id) !== serialized) throw new Error("같은 자료 ID에 서로 다른 출처 정보가 연결되었습니다: " + source.id);
  sourceDefinitions.set(source.id, serialized);
}
const ensureUnique = (items: { id: string }[], name: string) => {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error(name + "의 ID가 중복됩니다.");
};
ensureUnique(editorial.themes, "테마"); ensureUnique(editorial.collections, "컬렉션"); ensureUnique(editorial.stories, "이야기");
for (const item of [...visibleThemes, ...visibleCollections, ...visibleStories]) {
  if (!item.recordIds.length || !item.recordIds.every((id) => publicIds.has(id))) throw new Error("편집 콘텐츠가 비공개 또는 없는 기록을 참조합니다: " + item.id);
}
for (const collection of visibleCollections) {
  if (!collection.steps.every((step) => step.recordIds.length && step.recordIds.every((id) => collection.recordIds.includes(id)))) throw new Error("컬렉션 읽기 경로가 올바르지 않습니다: " + collection.id);
}
for (const story of visibleStories) {
  const storySourceIds = new Set(archiveEvents.filter((record) => story.recordIds.includes(record.id)).flatMap((record) => record.sources.map((source) => source.id)));
  if (!story.sourceIds.length || !story.sourceIds.every((id) => publicSources.has(id))
    || !story.sourceIds.every((id) => storySourceIds.has(id))
    || !story.sections.every((section) => section.sourceIds.length && section.sourceIds.every((id) => story.sourceIds.includes(id)))) throw new Error("이야기의 근거 연결이 올바르지 않습니다: " + story.id);
}
const collectionIds = new Set(editorial.collections.map((collection) => collection.id));
for (const record of archiveEvents) {
  if (!record.relatedIds.every((id) => publicIds.has(id) || withheldIds.has(id)) || !record.collectionIds.every((id) => collectionIds.has(id))) throw new Error("기록의 관계 연결이 올바르지 않습니다: " + record.id);
}
export const editorialThemes: EditorialTheme[] = visibleThemes;
export const editorialCollections: EditorialCollection[] = visibleCollections;
export const editorialStories: EditorialStory[] = visibleStories;
export const collectionRouteEntries = editorial.collections.map(({ id, title }) => ({ id, title }));
export const storyRouteEntries = editorial.stories.map(({ id, title }) => ({ id, title }));
export const themes = editorialThemes;
export const collections = editorialCollections;
export const stories = editorialStories;
export const archiveCounts = getArchiveCounts(archiveRecords);
export function getSearchRecords(): SearchRecord[] { return archiveEvents.map(toSearchRecord); }
export function getAuditSummary() {
  return { legacyRecords: legacyRecords.length, retainedLegacyIds: legacyIds.size,
    fullContractRecords: loadedRecords.filter(isArchiveRecord).length, ...archiveCounts,
    unclassifiedLegacyPeriods: legacyRecords.filter((record) => record.period === "미분류").length,
    globalLegacyRegions: legacyRecords.filter((record) => record.region === "전세계").length };
}
