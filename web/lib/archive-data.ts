import archive from "../content/archive.json";

export type ArchiveEvent = {
  id: string;
  title: string;
  period: string;
  region: string;
  summary: string;
  sourceCount: number;
  labels?: string[];
  sourceUrl?: string;
  sourceUrls?: string[];
  documentCount?: number;
  indexedTerms?: number;
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
    && typeof event.sourceCount === "number";
}

if (!Array.isArray(archive.items) || !archive.items.every(isArchiveEvent)) {
  throw new Error("web/content/archive.json 형식이 올바르지 않습니다.");
}

export const archiveEvents: ArchiveEvent[] = archive.items;
