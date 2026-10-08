import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { getArchiveCounts, isArchiveRecord, isEditorialCollection, isEditorialStory, isEditorialTheme, isLegacyArchiveRecord, isPublicRecord, mergeArchiveRecords, normalizeLabels, normalizeSourceUrl, parseArchiveDate, parseArchivePayload, toPendingArchiveRecord, toSearchRecord } from "../lib/archive-domain.ts";
import { defaultSearch, searchRecords } from "../lib/search.ts";

const editorial = JSON.parse(readFileSync(new URL("../content/editorial.json", import.meta.url), "utf8"));
const clone = () => structuredClone(editorial.records[0]);

test("public source URLs normalize protocol-relative addresses and explicit supplier IDs", () => {
  assert.equal(normalizeSourceUrl("//lccn.loc.gov/2003619106"), "https://lccn.loc.gov/2003619106");
  assert.equal(normalizeSourceUrl("nanjung-item", "internet-archive"), "https://archive.org/details/nanjung-item");
  assert.equal(normalizeSourceUrl("nanjung-item"), null);
});
test("untrusted URLs cannot point at credentials, private hosts, schemes, IP literals or arbitrary ports", () => {
  for (const url of ["javascript:alert(1)", "internal://seed/imjin", "https://user:pass@example.com/a", "http://localhost/a", "http://127.1/a", "http://2130706433/a", "http://10.0.0.1/a", "http://169.254.169.254/a", "http://192.168.0.1/a", "http://172.16.0.2/a", "http://100.64.1.1/a", "http://8.8.8.8/a", "http://[::1]/a", "https://nas.local/a", "https://example.com:8443/a"]) assert.equal(normalizeSourceUrl(url), null, url);
});
test("historical dates distinguish unknown, BCE, ranges and approximations without inventing dates", () => {
  assert.deepEqual(parseArchiveDate("미분류"), { startYear: null, endYear: null, precision: "unknown" });
  assert.deepEqual(parseArchiveDate("전후 저술 · 내용 범위 1592–1598"), { startYear: null, endYear: null, precision: "unknown" });
  assert.deepEqual(parseArchiveDate("1592–1598"), { startYear: 1592, endYear: 1598, precision: "range" });
  assert.deepEqual(parseArchiveDate("기원전 480–479"), { startYear: -480, endYear: -479, precision: "range" });
  assert.deepEqual(parseArchiveDate("480 BCE"), { startYear: -480, endYear: -480, precision: "year" });
  assert.deepEqual(parseArchiveDate("1600년 경"), { startYear: 1600, endYear: 1600, precision: "approximate" });
  for (const value of ["0", "1598-1592", "기원전 479-480", "1592-1598 설명", "2026-13-99"]) assert.equal(parseArchiveDate(value).precision, "unknown");
});
test("bilingual categories normalize without collapsing region into place", () => {
  assert.deepEqual(normalizeLabels(["battle", "전투", "people", "place", "지역", "unclassified", "primary-source", ""]), ["전투", "인물", "장소", "지역", "미분류", "사료"]);
});
test("all editorial records meet the public boundary and explicitly await human review", () => {
  assert.equal(editorial.records.length, 4);
  for (const record of editorial.records) {
    assert.equal(isArchiveRecord(record), true, record.id);
    assert.equal(isPublicRecord(record), true, record.id);
    assert.equal(record.review.status, "source-checked");
    assert.equal(record.review.humanReviewed, false);
  }
});
test("unverified, withheld and falsely approved records stay out of discovery", () => {
  for (const status of ["needs-review", "withheld", "approved"]) {
    const record = clone(); record.review.status = status;
    assert.equal(isPublicRecord(record), false, status);
  }
  const record = clone(); record.review.status = "approved"; record.review.humanReviewed = true;
  assert.equal(isPublicRecord(record), true);
});
test("a score cannot bypass missing citations or invalid source connections", () => {
  const mutations = [
    (record) => { record.sources = []; record.sourceCount = 0; },
    (record) => { record.sources[0].url = "internal://seed/overview"; },
    (record) => { record.sections[0].sourceIds = ["nonexistent-source"]; },
    (record) => { record.sections[0].sourceIds = []; },
    (record) => { record.chronology[0].sourceIds = ["nonexistent-source"]; },
    (record) => { record.sections = []; },
    (record) => { record.sources[1].url = record.sources[0].url; },
    (record) => { record.sources.push(structuredClone(record.sources[0])); record.sourceCount += 1; },
    (record) => { record.sourceCount = 1000; }
  ];
  for (const mutate of mutations) { const record = clone(); record.qualityScore = 1; mutate(record); assert.equal(isPublicRecord(record), false); }
});
test("malformed externally supplied record fields fail runtime validation", () => {
  for (const mutate of [
    (record) => { record.labels = [12]; }, (record) => { record.review.humanReviewed = "yes"; },
    (record) => { record.date.startYear = 0; }, (record) => { record.date.startYear = 1599; },
    (record) => { record.date.precision = "unknown"; }, (record) => { record.sources[0].checkedAt = "yesterday"; },
    (record) => { record.sources[0].checkedAt = "2026-02-30"; },
    (record) => { record.sections[0].paragraphs = []; }, (record) => { record.people[0].aliases = [4]; },
    (record) => { record.readingMinutes = -1; }, (record) => { record.corrections = [{}]; }
  ]) { const record = clone(); mutate(record); assert.equal(isArchiveRecord(record), false); }
});
test("search projection omits source URLs, full sections, raw identifiers and review notes", () => {
  const record = clone(); record.rawSecret = "do-not-export";
  const projected = toSearchRecord(record);
  for (const key of ["sources", "sections", "chronology", "review", "rawSecret", "sentenceIds", "documentIds"]) assert.equal(key in projected, false, key);
  assert.equal(projected.hasOriginal, true);
  assert.equal(toSearchRecord(editorial.records.find((item) => item.id === "nanjung-ilgi")).hasOriginal, false);
  projected.labels.push("mutation"); assert.equal(record.labels.includes("mutation"), false);
});
test("counts deduplicate registered sources and registration-based independence groups", () => {
  const counts = getArchiveCounts([...editorial.records, structuredClone(editorial.records[0])]);
  assert.equal(counts.registeredSources, 8);
  assert.equal(counts.humanReviewed, 0);
  assert.equal(counts.independenceGroups, 5);
});
test("editorial reading paths and story citations resolve only to published records", () => {
  const ids = new Set(editorial.records.filter(isPublicRecord).map((record) => record.id));
  const sourceIds = new Set(editorial.records.flatMap((record) => record.sources.map((source) => source.id)));
  for (const item of [...editorial.themes, ...editorial.collections, ...editorial.stories]) assert.ok(item.recordIds.length && item.recordIds.every((id) => ids.has(id)), item.id);
  for (const collection of editorial.collections) assert.ok(collection.steps.every((step) => step.recordIds.length && step.recordIds.every((id) => collection.recordIds.includes(id))));
  for (const story of editorial.stories) {
    assert.ok(story.sourceIds.every((id) => sourceIds.has(id)));
    assert.ok(story.sections.every((section) => section.sourceIds.length && section.sourceIds.every((id) => story.sourceIds.includes(id))));
  }
});
test("editorial collections, themes and stories validate route IDs and required editorial structure", () => {
  for (const [items, validate] of [[editorial.themes, isEditorialTheme], [editorial.collections, isEditorialCollection], [editorial.stories, isEditorialStory]]) {
    for (const item of items) assert.equal(validate(item), true, item.id);
    const badPath = structuredClone(items[0]); badPath.id = "../../private";
    assert.equal(validate(badPath), false);
    const missingRecords = structuredClone(items[0]); missingRecords.recordIds = [];
    assert.equal(validate(missingRecords), false);
  }
  const story = structuredClone(editorial.stories[0]); story.updatedAt = "yesterday";
  assert.equal(isEditorialStory(story), false);
});
test("all 28 original content files remain byte-for-byte preserved under editorial overlays", () => {
  const baseline = JSON.parse(readFileSync(new URL("../content/legacy-manifest.json", import.meta.url), "utf8"));
  const index = JSON.parse(readFileSync(new URL("../content/main.json", import.meta.url), "utf8"));
  assert.equal(baseline.files.length, 28);
  for (const entry of baseline.files) {
    assert.ok(index.published.includes(entry.path), entry.path);
    const original = readFileSync(new URL("../content/" + entry.path, import.meta.url));
    assert.equal(createHash("sha256").update(original).digest("hex"), entry.sha256, entry.path);
  }
});
test("the actual English person alias survives the search projection and source filter", () => {
  const records = editorial.records.map(toSearchRecord);
  const nanjung = records.find((record) => record.id === "nanjung-ilgi");
  assert.ok(nanjung.people.find((person) => person.id === "yi-sun-sin").aliases.includes("Yi Sun-sin"));
  assert.deepEqual(searchRecords(records, { ...defaultSearch, q: "Yi Sun-sin", kind: "source" }).map((record) => record.id), ["nanjung-ilgi"]);
  const withoutAlias = structuredClone(records);
  for (const record of withoutAlias) for (const person of record.people) person.aliases = person.aliases.filter((alias) => alias !== "Yi Sun-sin");
  assert.equal(searchRecords(withoutAlias, { ...defaultSearch, q: "Yi Sun-sin", kind: "source" }).length, 0);
});
test("additional searchable English names have directly checked institution authority entries", () => {
  const authorities = JSON.parse(readFileSync(new URL("../content/editorial/name-authorities.json", import.meta.url), "utf8"));
  for (const entry of authorities.entries) {
    assert.ok(normalizeSourceUrl(entry.url));
    const targets = entry.kind === "record" ? editorial.records.filter((record) => record.id === entry.target)
      : editorial.records.flatMap((record) => entry.kind === "person" ? record.people : record.places).filter((entity) => entity.id === entry.target);
    assert.ok(targets.length > 0, entry.target);
    for (const target of targets) assert.ok(entry.aliases.every((alias) => target.aliases.includes(alias)), entry.target);
  }
  const records = editorial.records.map(toSearchRecord);
  assert.deepEqual(searchRecords(records, { ...defaultSearch, q: "Ryu Seong-ryong", kind: "source" }).map((record) => record.id), ["jingbirok"]);
  assert.deepEqual(searchRecords(records, { ...defaultSearch, q: "Hyeonchungsa" }).map((record) => record.id), ["nanjung-ilgi"]);
});
test("single and bundled v2 publication files retain their full editorial contract", () => {
  const record = clone(); record.id = "published-v2";
  const single = parseArchivePayload(record);
  const bundle = parseArchivePayload({ version: 2, items: [record] });
  const holdLegacy = () => { throw new Error("A valid v2 record must not become a legacy holding notice."); };
  for (const loaded of [single, bundle]) {
    const merged = mergeArchiveRecords(loaded, [], holdLegacy);
    assert.equal(merged[0], record);
    assert.deepEqual(merged[0].sources, record.sources);
    assert.deepEqual(merged[0].sections, record.sections);
    assert.deepEqual(merged[0].review, record.review);
    assert.equal(merged[0].people[0].aliases.includes("Yi Sun-sin"), true);
    assert.equal(isPublicRecord(merged[0]), true);
  }
});
test("valid v2 records retain their review state while the public gate excludes pending, withheld and false approvals", () => {
  for (const status of ["source-checked", "approved", "needs-review", "withheld"]) {
    const record = clone(); record.id = "published-" + status; record.review.status = status;
    record.review.humanReviewed = status === "approved";
    const merged = mergeArchiveRecords(parseArchivePayload(record), [], () => { throw new Error("Unexpected legacy conversion."); });
    assert.equal(merged[0].review.status, status);
    assert.equal(isPublicRecord(merged[0]), status === "source-checked" || status === "approved");
  }
  const record = clone(); record.review.status = "approved"; record.review.humanReviewed = false;
  assert.equal(isPublicRecord(mergeArchiveRecords(parseArchivePayload(record), [], () => { throw new Error("Unexpected legacy conversion."); })[0]), false);
});
test("malformed v2 publications fail rather than silently downgrade to legacy records", () => {
  for (const mutate of [(record) => { delete record.sections; }, (record) => { record.review.humanReviewed = "false"; }, (record) => { record.sources[0].checkedAt = "yesterday"; }]) {
    const record = clone(); mutate(record);
    assert.equal(isLegacyArchiveRecord(record), false);
    assert.throws(() => parseArchivePayload(record), /Invalid v2/);
    assert.throws(() => parseArchivePayload({ items: [record] }), /Invalid v2/);
  }
  assert.throws(() => parseArchivePayload({ items: [] }), /nonempty/);
});
test("legacy publications remain held and editorial overlays keep precedence without changing raw content", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/archive/imjin-war.json", import.meta.url), "utf8"));
  const serializedBefore = JSON.stringify(raw);
  const legacy = parseArchivePayload(raw);
  assert.equal(isLegacyArchiveRecord(legacy[0]), true);
  let held = 0;
  const holding = clone(); holding.review.status = "needs-review";
  const heldRecords = mergeArchiveRecords(legacy, [], (record) => { held += 1; return { ...holding, id: record.id }; });
  assert.equal(held, 1); assert.equal(isPublicRecord(heldRecords[0]), false);
  held = 0;
  const overlayRecords = mergeArchiveRecords(legacy, editorial.records, () => { held += 1; return holding; });
  assert.equal(held, 0); assert.equal(overlayRecords.find((record) => record.id === "imjin-war"), editorial.records[0]);
  assert.equal(JSON.stringify(raw), serializedBefore);
  assert.throws(() => mergeArchiveRecords([...legacy, ...legacy], [], () => holding), /Duplicate/);
});
test("the shared legacy holding conversion preserves IDs and uses the caller's audit date", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/archive/imjin-war.json", import.meta.url), "utf8"));
  const legacy = parseArchivePayload(raw)[0];
  const record = toPendingArchiveRecord(legacy, "2026-10-07");
  assert.equal(record.id, legacy.id); assert.equal(record.title, legacy.title);
  assert.equal(record.review.reviewedAt, "2026-10-07"); assert.equal(record.review.status, "needs-review");
  assert.equal(isArchiveRecord(record), true); assert.equal(isPublicRecord(record), false);
  assert.deepEqual(record.sources, []);
});
