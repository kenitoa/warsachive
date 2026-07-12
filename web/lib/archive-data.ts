import archive from "../content/archive.json";

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

const archivePayload = archive as { items?: unknown };
const archiveItems = archivePayload.items;

if (!Array.isArray(archiveItems) || !archiveItems.every(isArchiveEvent)) {
  throw new Error("web/content/archive.json 형식이 올바르지 않습니다.");
}

export const archiveEvents: ArchiveEvent[] = archiveItems;
