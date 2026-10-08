import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  bibliographicJson, bibliographicRis, buildKnowledgeJsonLd, buildKnowledgePublicArtifacts, formatHistoricalDate,
  getMediaControls, getPublishedLocalization, getPublicLocaleRoutes, getRecordKnowledge, parseKnowledgeRegistry, projectPublicKnowledge,
  publicResourceLink, safeKnowledgeUrl, validateIiifManifest
} from "../lib/knowledge-domain.ts";

const raw = JSON.parse(await readFile(new URL("../content/knowledge.json", import.meta.url), "utf8"));
const records = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8")).records;
const clone = value => structuredClone(value);
const registry = parseKnowledgeRegistry(raw, records);

test("real registry retains four IDs, eight official sources and honest review/coordinate state", () => {
  assert.deepEqual(registry.recordLinks.map(link => link.recordId), ["imjin-war", "jeongyu-war", "nanjung-ilgi", "jingbirok"]);
  assert.equal(registry.sources.length, 8);
  assert.ok(registry.sources.every(source => source.review.status === "source-checked" && source.review.humanReviewed === false));
  assert.ok(registry.locations.every(location => location.coordinate === null));
  assert.ok(registry.resources.every(resource => resource.iiifManifest === null));
  assert.equal(registry.editions.find(edition => edition.id === "edition-jingbirok-woodblock").custodianId, null);
});
test("schema rejects added private fields and broken evidence references", () => {
  const hidden = clone(raw); hidden.entities[0].privateMemo = "must never reach a public artifact";
  assert.throws(() => parseKnowledgeRegistry(hidden), /entities/);
  const broken = clone(raw); broken.claims[0].evidence[0].sourceId = "missing-source";
  assert.throws(() => parseKnowledgeRegistry(broken), /evidence/);
});
test("archive source identity, provider and provenance cannot silently drift", () => {
  for (const field of ["url", "creator", "provenanceGroup"]) {
    const changed = clone(raw); changed.sources[0][field] = field === "url" ? "https://example.org/other" : "incorrect";
    assert.throws(() => parseKnowledgeRegistry(changed, records), /archive source mismatch/);
  }
});
test("person/organization/work relation types reject semantic misuse", () => {
  const changed = clone(raw); changed.relations[0].objectId = "organization-nikh";
  assert.throws(() => parseKnowledgeRegistry(changed), /typed relation/);
  const mismatched = clone(raw); mismatched.translations[0].editionId = "edition-jingbirok-woodblock";
  assert.throws(() => parseKnowledgeRegistry(mismatched), /links/);
});
test("year zero, impossible lunar date and unsupported calendar conversion fail", () => {
  const zero = clone(raw); zero.dates[0].startYear = 0;
  assert.throws(() => parseKnowledgeRegistry(zero), /dates/);
  const lunar = clone(raw); lunar.dates.find(date => date.calendar === "lunisolar").day = 31;
  assert.throws(() => parseKnowledgeRegistry(lunar), /dates/);
  const conversion = clone(raw); conversion.dates[2].conversion = { calendar: "gregorian", text: "1593-02-11", sourceId: "unesco-nanjung" };
  assert.throws(() => parseKnowledgeRegistry(conversion), /conversion evidence/);
  const gregorian = clone(raw); Object.assign(gregorian.dates[2], { calendar: "gregorian", startYear: 1900, endYear: 1900, month: 2, day: 29 });
  assert.throws(() => parseKnowledgeRegistry(gregorian), /dates/);
});
test("date display preserves BCE and unknown precision, without guessing conversion", () => {
  const bce = { ...registry.dates[0], startYear: -500, endYear: -480 };
  assert.match(formatHistoricalDate(bce), /기원전 500년–기원전 480년/);
  assert.match(formatHistoricalDate(registry.dates.find(date => date.id === "date-jingbirok-creation")), /시점 미확정/);
  assert.match(formatHistoricalDate(registry.dates[2]), /당시 역법·음력/);
  assert.doesNotMatch(formatHistoricalDate(registry.dates[2]), /환산/);
});
test("public projection excludes English drafts, withheld record links and stale translations", () => {
  const publicRegistry = projectPublicKnowledge(registry, records);
  parseKnowledgeRegistry(publicRegistry, records);
  assert.ok(publicRegistry.localizations.every(locale => locale.locale === "ko"));
  assert.equal(publicRegistry.localizations.length, 4);
  assert.doesNotMatch(JSON.stringify(publicRegistry), /English editorial translation is awaiting/);
  const updated = records.map(record => record.id === "imjin-war" ? { ...record, updatedAt: "2026-10-08" } : record);
  assert.ok(!projectPublicKnowledge(registry, updated).localizations.some(locale => locale.recordId === "imjin-war"));
  const subset = records.filter(record => record.id === "nanjung-ilgi");
  const limited = projectPublicKnowledge(registry, subset);
  parseKnowledgeRegistry(limited, subset);
  assert.equal(limited.sources.length, 2);
  assert.deepEqual(limited.recordLinks.map(link => link.recordId), ["nanjung-ilgi"]);
  assert.ok(limited.claims.every(claim => claim.recordIds.every(id => id === "nanjung-ilgi")));
});
test("withholding a provider closes the public graph and strips dependent source assertions", () => {
  const changed = clone(registry); changed.entities.find(entity => entity.id === "organization-unesco").review.status = "withheld";
  const projected = projectPublicKnowledge(changed, records);
  parseKnowledgeRegistry(projected, records);
  assert.ok(!projected.sources.some(source => source.id === "unesco-nanjung"));
  assert.ok(!projected.claims.some(claim => claim.id === "claim-nanjung-creator"));
  assert.ok(!projected.resources.some(resource => resource.sourceId === "unesco-nanjung"));
});
test("signed publication withdrawal can remove one or all four records without exposing orphan knowledge", () => {
  const rawValidated = parseKnowledgeRegistry(raw);
  const oneWithheld = records.filter(record => record.id !== "imjin-war");
  const partial = buildKnowledgePublicArtifacts(rawValidated, oneWithheld, "http://localhost:3000");
  assert.equal(partial.registry.sources.length, 5, "unrelated live sources retain their common institution provider");
  assert.ok(!partial.registry.recordLinks.some(link => link.recordId === "imjin-war"));
  assert.ok(!partial.registry.sources.some(source => source.id === "sillok-pyeongyang"));
  assert.ok(!partial.registry.relations.some(relation => relation.subjectId === "imjin-war"));
  assert.equal(partial.media.length, 0);
  const allWithheld = buildKnowledgePublicArtifacts(rawValidated, [], "http://localhost:3000");
  for (const key of ["entities", "sources", "materials", "editions", "translations", "resources", "rights", "dates", "claims", "disagreements", "locations", "relations", "recordLinks", "localizations"]) assert.equal(allWithheld.registry[key].length, 0, key);
  assert.equal(allWithheld.jsonLd["@graph"].length, 0);
  assert.equal(allWithheld.media.length, 0);
  assert.equal(allWithheld.bibliography.length, 0);
  assert.equal(allWithheld.localeRoutes.length, 0);
});
test("foreign locale routing requires a human approved translation of the current record version", () => {
  const record = records[0];
  assert.equal(getPublishedLocalization(registry, record, "en"), null);
  assert.deepEqual(getPublicLocaleRoutes(registry, records).map(route => route.locale), ["ko", "ko", "ko", "ko"]);
  const approved = clone(registry);
  const locale = approved.localizations.find(entry => entry.recordId === record.id && entry.locale === "en");
  Object.assign(locale, { status: "approved", review: { ...locale.review, status: "approved", humanReviewed: true, checkedBy: "test human" } });
  assert.equal(getPublishedLocalization(approved, record, "en").locale, "en");
  assert.equal(getPublicLocaleRoutes(approved, records).find(route => route.locale === "en").scope, "title-and-summary");
  assert.equal(getPublishedLocalization(approved, { ...record, updatedAt: "2026-10-08" }, "en"), null);
  assert.equal(getPublishedLocalization(approved, { ...record, summary: "changed on the same day" }, "en"), null);
  assert.equal(getPublishedLocalization(approved, { ...record, title: "corrected title" }, "en"), null);
  assert.equal(getPublishedLocalization(approved, record, "fr"), null);
});
test("media needs both documented rights and human approval; source navigation remains separate", () => {
  const rights = clone(registry.rights[0]);
  assert.equal(getMediaControls(rights).display, false);
  Object.assign(rights, { status: "open-licence", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", permissions: { display: true, download: true, reuse: true } });
  assert.equal(getMediaControls(rights).display, false);
  rights.review = { ...rights.review, status: "approved", humanReviewed: true, checkedBy: "test reviewer" };
  assert.equal(getMediaControls(rights).display, true);
  const resource = { ...registry.resources[0], kind: "image" };
  assert.equal(publicResourceLink(resource, registry), null);
  assert.ok(publicResourceLink(registry.resources[0], registry));
});
test("approved flag requires human approval and unknown rights cannot carry permissions", () => {
  const fakeApproval = clone(raw); fakeApproval.claims[0].review.status = "approved";
  assert.throws(() => parseKnowledgeRegistry(fakeApproval), /claims/);
  const fakeRights = clone(raw); fakeRights.rights[0].permissions.display = true;
  assert.throws(() => parseKnowledgeRegistry(fakeRights), /rights/);
  const fakeLocale = clone(raw); Object.assign(fakeLocale.localizations[1], { status: "approved" });
  assert.throws(() => parseKnowledgeRegistry(fakeLocale), /localizations/);
});
test("unresolved bibliography is displayed as evidence-backed positions, without fabricated resolution", () => {
  const knowledge = getRecordKnowledge(projectPublicKnowledge(registry, records), "jingbirok");
  assert.equal(knowledge.disagreements[0].status, "open");
  assert.equal(knowledge.disagreements[0].resolution, null);
  assert.equal(new Set(knowledge.disagreements[0].positions.flatMap(position => position.evidence.map(reference => reference.sourceId))).size, 1);
  const changed = clone(raw); changed.disagreements[0].status = "resolved"; changed.disagreements[0].resolution = "not reviewed";
  assert.throws(() => parseKnowledgeRegistry(changed), /disagreements/);
});
test("bibliographic exports preserve access date/locator and prevent RIS line injection", () => {
  const source = registry.sources[0];
  const citation = bibliographicJson(source);
  assert.deepEqual(citation.accessed["date-parts"], [[2026, 10, 7]]);
  assert.ok(!("issued" in citation));
  assert.match(citation.note, /사람 검토: 대기/);
  const ris = bibliographicRis({ ...source, title: "title\nUR  - https://evil.example/test" });
  assert.equal(ris.split("\n").filter(line => line.startsWith("UR  - ")).length, 1);
  assert.ok(ris.endsWith("ER  -\n"));
});
test("JSON-LD uses stable public URLs without asserting dates, coordinates or licences", () => {
  const graph = buildKnowledgeJsonLd(projectPublicKnowledge(registry, records), "https://example.org/archive-project");
  assert.ok(graph["@graph"].some(node => node["@id"] === "https://example.org/archive-project/entities/yi-sun-sin/"));
  assert.doesNotMatch(JSON.stringify(graph), /geo|license|dateCreated|birthDate/);
  assert.ok(buildKnowledgeJsonLd(registry, "http://localhost:3000")["@graph"].some(node => node["@id"].startsWith("http://localhost:3000/entities/")));
  assert.throws(() => buildKnowledgeJsonLd(registry, "http://unsafe.example"), /public HTTPS/);
});
const manifest = () => ({ "@context": "http://iiif.io/api/presentation/3/context.json", id: "https://example.org/manifest", type: "Manifest", label: { ko: ["확인용 자료"] }, rights: "https://creativecommons.org/licenses/by/4.0/", requiredStatement: { label: { ko: ["출처"] }, value: { ko: ["<b>기관 표기</b>"] } }, provider: [{ id: "https://example.org/provider", type: "Agent", label: { ko: ["검증 fixture 기관"] } }], items: [{ id: "https://example.org/canvas/1", type: "Canvas", label: { ko: ["첫 장"] }, width: 1000, height: 1500, items: [{ id: "https://example.org/page/1", type: "AnnotationPage", items: [{ id: "https://example.org/annotation/1", type: "Annotation", motivation: "painting", body: { id: "https://example.org/image.jpg", type: "Image" }, target: "https://example.org/canvas/1" }] }] }] });
test("IIIF metadata validates structure and plain attribution without rendering untrusted HTML", () => {
  const preview = validateIiifManifest(manifest());
  assert.equal(preview.attribution, "출처: 기관 표기");
  assert.equal(preview.canvases.length, 1);
  assert.equal(preview.imageLinks.length, 1);
  assert.match(preview.warning, /권리 허가/);
});
test("IIIF rejects unsafe links, incorrect targets, malformed language maps and oversized inputs", () => {
  const unsafe = manifest(); unsafe.items[0].items[0].items[0].body.id = "http://127.0.0.1/private";
  assert.throws(() => validateIiifManifest(unsafe), /Image annotation/);
  const wrong = manifest(); wrong.items[0].items[0].items[0].target = "https://example.org/canvas/2";
  assert.throws(() => validateIiifManifest(wrong), /Image annotation/);
  const label = manifest(); label.label = { en: "unstructured string" };
  assert.throws(() => validateIiifManifest(label), /language map/);
  const many = manifest(); many.items = Array.from({ length: 501 }, () => many.items[0]);
  assert.throws(() => validateIiifManifest(many), /Canvas items/);
});
test("external links exclude credentials, IP literals and special-use hosts", () => {
  for (const value of ["https://127.0.0.1", "https://2130706433", "https://[::1]/", "https://user:secret@example.org/", "https://test.internal/", "https://foo.local/", "javascript:alert(1)"]) assert.equal(safeKnowledgeUrl(value), null);
  assert.equal(safeKnowledgeUrl("https://www.unesco.org/en/memory-world/"), "https://www.unesco.org/en/memory-world/");
});
