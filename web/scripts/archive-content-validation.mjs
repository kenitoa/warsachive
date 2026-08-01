const archiveEventId = /^[a-zA-Z0-9_-]{1,80}$/;

export function isArchiveEvent(value) {
  if (!value || typeof value !== "object") return false;
  return typeof value.id === "string"
    && archiveEventId.test(value.id)
    && typeof value.title === "string"
    && typeof value.period === "string"
    && typeof value.region === "string"
    && typeof value.summary === "string"
    && typeof value.sourceCount === "number";
}

export function getPublishedEvents(value) {
  if (isArchiveEvent(value)) return [value];
  if (!value || typeof value !== "object" || !Array.isArray(value.items) || value.items.length === 0) {
    return null;
  }
  return value.items.every(isArchiveEvent) ? value.items : null;
}

export function registerUniqueEventIds(events, fileName, seenEventFiles) {
  for (const event of events) {
    const existingFile = seenEventFiles.get(event.id);
    if (existingFile) {
      throw new Error(`Duplicate archive record ID "${event.id}" in ${existingFile} and ${fileName}.`);
    }
    seenEventFiles.set(event.id, fileName);
  }
}
