import { archiveEvents, archiveRecords } from "./archive-data";
import type { ArchiveRecord } from "./archive-types";

export function getBuildEvents(): Promise<ArchiveRecord[]> {
  return Promise.resolve(archiveEvents);
}

/** Stable legacy URLs render review notices; only public records belong in discovery and sitemaps. */
export function getBuildRecords(): Promise<ArchiveRecord[]> {
  return Promise.resolve(archiveRecords);
}
