import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import archiveIndex from "../content/main.json";

export type ArchiveEvent = {
  id: string;
  title: string;
  period: string;
  region: string;
  summary: string;
  sourceCount: number;
  curator?: {
    format: "history-curator-v1";
    context: string;
    keyPoints: string[];
    chronology: string[];
    peopleAndPlaces: string[];
    sourceBasis: string;
  };
  labels?: string[];
  sourceUrl?: string;
  sourceUrls?: string[];
  documentCount?: number;
  indexedTerms?: number;
  qualityScore?: number;
  qualityGate?: {
    minScore: number;
    passed: boolean;
    reason: string;
  };
  collectedAt?: string;
};

type ArchiveIndex = {
  version: number;
  published: string[];
};

function isArchiveEvent(value: unknown): value is ArchiveEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.id === "string"
    && /^[a-zA-Z0-9_-]{1,80}$/.test(event.id)
    && typeof event.title === "string"
    && typeof event.period === "string"
    && typeof event.region === "string"
    && typeof event.summary === "string"
    && typeof event.sourceCount === "number"
    && (event.qualityScore === undefined || typeof event.qualityScore === "number")
    && (event.curator === undefined || isCuratorEvent(event.curator));
}

function isCuratorEvent(value: unknown): value is NonNullable<ArchiveEvent["curator"]> {
  if (!value || typeof value !== "object") return false;
  const curator = value as Record<string, unknown>;
  return curator.format === "history-curator-v1"
    && typeof curator.context === "string"
    && Array.isArray(curator.keyPoints)
    && curator.keyPoints.every((item) => typeof item === "string")
    && Array.isArray(curator.chronology)
    && curator.chronology.every((item) => typeof item === "string")
    && Array.isArray(curator.peopleAndPlaces)
    && curator.peopleAndPlaces.every((item) => typeof item === "string")
    && typeof curator.sourceBasis === "string";
}

function isArchiveIndex(value: unknown): value is ArchiveIndex {
  if (!value || typeof value !== "object") return false;
  const index = value as Record<string, unknown>;
  return index.version === 1
    && Array.isArray(index.published)
    && index.published.every((path) => typeof path === "string");
}

function findContentDirectory() {
  const candidates = [
    resolve(process.cwd(), "content"),
    resolve(process.cwd(), "web", "content")
  ];
  const directory = candidates.find((candidate) => existsSync(resolve(candidate, "main.json")));
  if (!directory) throw new Error("web/content/main.json을 찾을 수 없습니다.");
  return directory;
}

function readPublishedFile(filePath: string, contentDirectory: string): ArchiveEvent[] {
  if (!/^archive\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(filePath)) {
    throw new Error(`허용되지 않은 공개 아카이브 경로입니다: ${filePath}`);
  }

  const archiveDirectory = resolve(contentDirectory, "archive");
  const resolvedPath = resolve(contentDirectory, filePath);
  const archivePrefix = `${archiveDirectory}${sep}`.toLocaleLowerCase();
  if (!resolvedPath.toLocaleLowerCase().startsWith(archivePrefix)) {
    throw new Error(`아카이브 폴더 밖의 경로는 읽을 수 없습니다: ${filePath}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "알 수 없는 오류";
    throw new Error(`공개 아카이브 파일을 읽을 수 없습니다 (${filePath}): ${reason}`);
  }

  if (isArchiveEvent(payload)) return [payload];
  if (payload && typeof payload === "object") {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items) && items.every(isArchiveEvent)) return items;
  }

  throw new Error(`공개 아카이브 파일 형식이 올바르지 않습니다: ${filePath}`);
}

if (!isArchiveIndex(archiveIndex)) {
  throw new Error("web/content/main.json 형식이 올바르지 않습니다.");
}

const uniquePaths = new Set(archiveIndex.published);
if (uniquePaths.size !== archiveIndex.published.length) {
  throw new Error("web/content/main.json에 중복된 공개 경로가 있습니다.");
}

const contentDirectory = findContentDirectory();
const loadedEvents = archiveIndex.published.flatMap((filePath) => readPublishedFile(filePath, contentDirectory));
const uniqueEventIds = new Set(loadedEvents.map((event) => event.id));

if (uniqueEventIds.size !== loadedEvents.length) {
  throw new Error("공개 아카이브 파일 사이에 중복된 기록 ID가 있습니다.");
}

export const archiveEvents: ArchiveEvent[] = loadedEvents;
