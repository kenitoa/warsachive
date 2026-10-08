import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { toSearchRecord } from "../lib/archive-domain.ts";
import { parseKnowledgeRegistry, projectPublicKnowledge, validateIiifManifest } from "../lib/knowledge-domain.ts";
import { buildKnowledgeSearchItems, defaultUnifiedSearch, parseUnifiedSearch, serializeUnifiedSearch, searchKnowledge, relaxedSearchSuggestions } from "../lib/knowledge-search.ts";
import { sourceAvailability, sourceIndependence, recordTrustSummary, readingLens, verifiedCoordinates, approvedIiifResource } from "../lib/knowledge-reading.ts";
import { fullLocaleRoutes, getFullLocalization, isFullRecordLocalization, localizationSourceHash, localizationParagraphVersions } from "../lib/knowledge-localization.ts";
import { localizedUiKeys } from "../lib/knowledge-types.ts";
import { hasApprovedKnowledgeReview } from "../lib/knowledge-review.ts";

const raw = JSON.parse(await readFile(new URL("../content/knowledge.json", import.meta.url), "utf8"));
const records = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8")).records;
const registry = parseKnowledgeRegistry(raw, records);
const published = projectPublicKnowledge(registry, records);
const searchRecords = records.map(toSearchRecord);
const items = buildKnowledgeSearchItems(published, records);
const approvedReview = review => ({ ...review, status: "approved", humanReviewed: true, checkedBy: "fixture independent reviewer" });

test("unified discovery exposes typed public metadata, proven aliases and an actual match reason", () => {
  assert.ok(items.some(item => item.target === "source"));
  assert.ok(items.some(item => item.target === "entity"));
  assert.ok(items.some(item => item.target === "place"));
  assert.ok(items.every(item => !item.sections && !item.evidence && !item.resources));
  const state = { ...defaultUnifiedSearch, q: "Yi Sun-sin", target: "entity" };
  const matches = searchKnowledge(items, searchRecords, state);
  assert.ok(matches.some(item => item.id === "yi-sun-sin"));
  assert.match(matches.find(item => item.id === "yi-sun-sin").why, /확인된 별칭/);
  assert.ok(searchKnowledge(items, searchRecords, { ...defaultUnifiedSearch, q: "Nanjung", target: "source" }).length > 0);
  assert.equal(searchKnowledge(items, searchRecords, { ...defaultUnifiedSearch, q: "unverified nickname 98765" }).length, 0);
});

test("query, classification, filters and page survive URLs; invalid targets reset safely", () => {
  const state = { ...defaultUnifiedSearch, q: "징비록 & 자료", target: "source", label: "사료", saved: true, page: 2 };
  assert.deepEqual(parseUnifiedSearch(new URLSearchParams(serializeUnifiedSearch(state))), state);
  assert.equal(parseUnifiedSearch(new URLSearchParams("target=__proto__")).target, "all");
  const limited = searchKnowledge(items, searchRecords, { ...defaultUnifiedSearch, target: "source", saved: true }, ["nanjung-ilgi"]);
  assert.equal(limited.length, 2);
  assert.ok(limited.every(item => item.recordIds.includes("nanjung-ilgi")));
});

test("zero-result suggestions keep the query and relax one working condition", () => {
  const state = { ...defaultUnifiedSearch, q: "Nanjung", target: "source", region: "검증되지 않은 지역" };
  assert.equal(searchKnowledge(items, searchRecords, state).length, 0);
  const suggestions = relaxedSearchSuggestions(searchRecords, items, state);
  const relaxed = suggestions.find(option => option.label === "지역 조건 해제");
  assert.ok(relaxed?.count > 0);
  assert.equal(relaxed.state.q, state.q);
  assert.equal(relaxed.state.target, "source");
  assert.equal(relaxed.state.region, "");
});

test("withdrawal closes the discovery projection, including institutions and claims", () => {
  const limitedRecords = records.filter(record => record.id === "nanjung-ilgi");
  const limited = buildKnowledgeSearchItems(projectPublicKnowledge(registry, limitedRecords), limitedRecords);
  assert.ok(limited.every(item => item.recordIds.every(id => id === "nanjung-ilgi")));
  assert.deepEqual(buildKnowledgeSearchItems(projectPublicKnowledge(registry, []), []), []);
  const hiddenProvider = structuredClone(registry);
  hiddenProvider.entities.find(item => item.id === "organization-unesco").review.status = "withheld";
  assert.ok(!buildKnowledgeSearchItems(projectPublicKnowledge(hiddenProvider, records), records).some(item => item.id === "unesco-nanjung"));
});

test("reading scope separates institution pages, original links and human approval", () => {
  const availability = published.sources.flatMap(source => sourceAvailability(source.id, published));
  assert.ok(availability.some(item => item.kind === "institution-page"));
  assert.ok(availability.some(item => item.kind === "original-and-translation"));
  assert.ok(availability.every(item => !item.display && !item.download && !item.reuse));
  assert.equal(sourceAvailability("unregistered-source", published)[0].kind, "unregistered");
  for (const record of records) { const trust = recordTrustSummary(record, published); assert.equal(trust.humanReviewed, false); assert.match(trust.disclaimer, /독립 증언/); }
  const missing = readingLens(records, "존재하지 않는 관점");
  assert.deepEqual(missing.records, []);
  assert.match(missing.note, /근거 연결 기록이 없습니다/);
  const source = published.sources[0]; const independence = sourceIndependence(source, published);
  assert.ok(independence.shared.every(item => published.sources.find(candidate => candidate.id === item.id).provenanceGroup === source.provenanceGroup));
});

test("granular review fields cannot inherit a false approval or duplicate a scope", () => {
  const scoped = structuredClone(raw);
  scoped.sources[0].review.scopes = [{ kind: "bibliography", ...scoped.sources[0].review }];
  assert.equal(parseKnowledgeRegistry(scoped).sources[0].review.scopes[0].humanReviewed, false);
  scoped.sources[0].review.scopes[0].status = "approved";
  assert.throws(() => parseKnowledgeRegistry(scoped), /sources/);
  scoped.sources[0].review.scopes[0].status = "source-checked";
  scoped.sources[0].review.scopes.push(structuredClone(scoped.sources[0].review.scopes[0]));
  assert.throws(() => parseKnowledgeRegistry(scoped), /sources/);
});

test("the map requires independently approved location evidence and uses no operating coordinates", () => {
  assert.deepEqual(verifiedCoordinates(published.locations, published.sources), []);
  const location = structuredClone(published.locations[0]);
  location.coordinate = { latitude: 0, longitude: 0, precision: "approximate", sourceId: location.evidence[0].sourceId };
  assert.deepEqual(verifiedCoordinates([location], published.sources), []);
  location.review = approvedReview(location.review);
  assert.equal(verifiedCoordinates([location], published.sources).length, 1, "synthetic coordinates remain a test fixture");
  assert.deepEqual(verifiedCoordinates([{ ...location, evidence: [] }], published.sources), []);
  assert.deepEqual(verifiedCoordinates([location], []), []);
  assert.ok(raw.locations.every(item => item.coordinate === null));
});

function translationFixture() {
  const changed = structuredClone(registry); const record = records[0];
  const locale = changed.localizations.find(entry => entry.recordId === record.id && entry.locale === "en");
  Object.assign(locale, { status: "approved", review: approvedReview(locale.review) });
  locale.full = { scope: "full-record", sourceContentHash: localizationSourceHash(record), sourceParagraphVersions: localizationParagraphVersions(record),
    sections: record.sections.map(section => ({ id: section.id, title: `TEST TRANSLATION ${section.id}`, paragraphs: section.paragraphs.map((_, index) => `TEST TRANSLATION paragraph ${index}`) })),
    chronology: record.chronology.map((_, index) => ({ index, title: `TEST date ${index}`, text: "TEST translation chronology" })), limitations: record.limitations.map(() => "TEST translation qualification"),
    translator: "fixture translator", reviewer: locale.review.checkedBy, approvedAt: "2026-10-07", ui: Object.fromEntries(localizedUiKeys.map(key => [key, `TEST ${key}`])) };
  return { changed, record, locale };
}

test("whole-language routes require approved full text, navigation, help and errors", () => {
  assert.deepEqual(fullLocaleRoutes(published, records), []);
  const { changed, record, locale } = translationFixture();
  assert.ok(isFullRecordLocalization(locale.full));
  parseKnowledgeRegistry(changed, records);
  assert.equal(getFullLocalization(changed, record, "en").locale, "en");
  assert.deepEqual(fullLocaleRoutes(changed, records), [{ recordId: record.id, locale: "en", href: `/read/en/${record.id}/`, sourceVersion: record.updatedAt, scope: "full-record" }]);
  delete locale.full.ui.failed;
  assert.equal(getFullLocalization(changed, record, "en"), null);
  assert.deepEqual(fullLocaleRoutes(changed, records), []);
});

test("same-day body, source, dates and paragraph-version edits withdraw the full translation", () => {
  const { changed, record, locale } = translationFixture();
  for (const transform of [
    value => { value.sections[0].paragraphs[0] += " changed"; },
    value => { value.sources[0].location += " changed"; },
    value => { value.chronology[0].date += " changed"; },
    value => { value.limitations[0] += " changed"; }
  ]) { const updated = structuredClone(record); transform(updated); assert.equal(getFullLocalization(changed, updated, "en"), null); }
  locale.full.sourceParagraphVersions[0].sourceVersion = "2026-10-06";
  assert.equal(getFullLocalization(changed, record, "en"), null);
});

test("invalid approval date, same translator/reviewer and summary-only approval cannot release full routes", () => {
  const { changed, record, locale } = translationFixture();
  locale.full.approvedAt = "2026-02-30"; assert.equal(isFullRecordLocalization(locale.full), false);
  locale.full.approvedAt = "2026-10-07"; locale.full.translator = locale.full.reviewer; assert.equal(isFullRecordLocalization(locale.full), false);
  delete locale.full; assert.equal(getFullLocalization(changed, record, "en"), null); assert.deepEqual(fullLocaleRoutes(changed, records), []);
  assert.deepEqual(fullLocaleRoutes(projectPublicKnowledge(translationFixture().changed, []), []), []);
});

test("a narrower translation or geography hold overrides broad approval without changing the whole record", () => {
  const { changed, record, locale } = translationFixture();
  const translationScope = { kind: "translation", ...locale.review, status: "withheld", humanReviewed: false };
  locale.review.scopes = [translationScope]; assert.equal(getFullLocalization(changed, record, "en"), null);
  const review = approvedReview(registry.locations[0].review); assert.equal(hasApprovedKnowledgeReview(review, "geography"), true);
  review.scopes = [{ kind: "geography", ...review, status: "needs-review", humanReviewed: false }];
  assert.equal(hasApprovedKnowledgeReview(review, "geography"), false); assert.equal(hasApprovedKnowledgeReview(review, "bibliography"), true);
});

const manifestFixture = () => ({ "@context": "http://iiif.io/api/presentation/3/context.json", id: "https://example.org/test-manifest", type: "Manifest", label: { en: ["TEST ONLY"] }, rights: "https://creativecommons.org/licenses/by/4.0/", requiredStatement: { label: { en: ["Attribution"] }, value: { en: ["<b>TEST fixture</b>"] } }, items: [{ id: "https://example.org/test-canvas", type: "Canvas", label: { en: ["TEST sheet"] }, width: 100, height: 200, items: [{ id: "https://example.org/test-page", type: "AnnotationPage", items: [{ id: "https://example.org/test-annotation", type: "Annotation", motivation: "painting", target: "https://example.org/test-canvas", body: { id: "https://example.org/test-image.jpg", type: "Image" } }] }] }] });

test("IIIF presentation requires validated manifest identity plus separate rights and resource approval", () => {
  const changed = structuredClone(registry); const resource = changed.resources[0]; const rights = changed.rights.find(item => item.id === resource.rightsId);
  Object.assign(resource, { kind: "iiif", iiifManifest: manifestFixture().id, iiifManifestJson: manifestFixture(), review: approvedReview(resource.review) });
  assert.equal(approvedIiifResource(resource, changed), false);
  Object.assign(rights, { status: "open-licence", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", permissions: { display: true, download: false, reuse: false }, review: approvedReview(rights.review) });
  assert.equal(approvedIiifResource(resource, changed), true);
  rights.review.scopes = [{ kind: "rights", ...rights.review, status: "withheld", humanReviewed: false }]; assert.equal(approvedIiifResource(resource, changed), false); delete rights.review.scopes;
  assert.equal(validateIiifManifest(resource.iiifManifestJson).attribution, "Attribution: TEST fixture");
  assert.deepEqual(validateIiifManifest(resource.iiifManifestJson).canvases[0].imageLinks, ["https://example.org/test-image.jpg"]);
  resource.iiifManifest = "https://example.org/another-manifest"; assert.equal(approvedIiifResource(resource, changed), false);
  resource.iiifManifest = manifestFixture().id; resource.review.humanReviewed = false; assert.equal(approvedIiifResource(resource, changed), false);
  resource.review.status = "source-checked";
  const projected = projectPublicKnowledge(changed, records).resources.find(item => item.id === resource.id);
  assert.equal(projected.iiifManifest, null); assert.equal(projected.iiifManifestJson, undefined); assert.equal(projected.url, null);
  assert.ok(raw.resources.every(item => item.iiifManifest === null && !item.iiifManifestJson));
});
