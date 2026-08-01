import assert from "node:assert/strict";
import test from "node:test";

import { getPublishedEvents, registerUniqueEventIds } from "./archive-content-validation.mjs";

function archiveEvent(id) {
  return {
    id,
    title: `Record ${id}`,
    period: "2026",
    region: "Test region",
    summary: "Test summary",
    sourceCount: 1
  };
}

test("accepts a single event and a non-empty items payload", () => {
  assert.deepEqual(getPublishedEvents(archiveEvent("single"))?.map((event) => event.id), ["single"]);
  assert.deepEqual(
    getPublishedEvents({ items: [archiveEvent("first"), archiveEvent("second")] })?.map((event) => event.id),
    ["first", "second"]
  );
});

test("rejects malformed or empty payloads", () => {
  assert.equal(getPublishedEvents({ items: [] }), null);
  assert.equal(getPublishedEvents({ id: "missing-required-fields" }), null);
});

test("reports both files when a record ID is duplicated", () => {
  const seenEventFiles = new Map();
  registerUniqueEventIds([archiveEvent("duplicate-record")], "first.json", seenEventFiles);

  assert.throws(
    () => registerUniqueEventIds([archiveEvent("duplicate-record")], "second.json", seenEventFiles),
    /Duplicate archive record ID "duplicate-record" in first\.json and second\.json\./
  );
});

test("rejects duplicate record IDs within one items payload", () => {
  assert.throws(
    () => registerUniqueEventIds(
      [archiveEvent("duplicate-record"), archiveEvent("duplicate-record")],
      "items.json",
      new Map()
    ),
    /Duplicate archive record ID "duplicate-record" in items\.json and items\.json\./
  );
});
