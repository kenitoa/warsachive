import { archiveEvents, type ArchiveEvent } from "./archive-data";

export function getBuildEvents(): Promise<ArchiveEvent[]> {
  return Promise.resolve(archiveEvents);
}
