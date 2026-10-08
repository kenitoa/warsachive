import { archiveEvents, editorialCollections, editorialStories, editorialThemes } from "./archive-data";
import type { ArchiveRecord } from "./archive-types";

export { editorialCollections, editorialStories, editorialThemes } from "./archive-data";
export function getPlannedThemes() { return editorialThemes; }
export function getPlannedCollections() { return editorialCollections; }
export function getPlannedStories() { return editorialStories; }
export function getPlannedTimeline(records: ArchiveRecord[] = archiveEvents) {
  return [...records].sort((left, right) => {
    if (left.date.startYear === null) return right.date.startYear === null ? left.id.localeCompare(right.id) : 1;
    if (right.date.startYear === null) return -1;
    return left.date.startYear - right.date.startYear || left.id.localeCompare(right.id);
  });
}
