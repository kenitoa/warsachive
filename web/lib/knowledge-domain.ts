import type {
  DigitalResource, EvidenceReference, HistoricalDate, IiifPreview, KnowledgeArchiveRecord,
  KnowledgeItem, KnowledgeLocalization, KnowledgeRegistry, KnowledgeRights, KnowledgeSource, RecordKnowledge
} from "./knowledge-types";
import { getFullLocalization, isFullRecordLocalization } from "./knowledge-localization.ts";
import { hasApprovedKnowledgeReview } from "./knowledge-review.ts";

const SLUG = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 8000; }
function nullableText(value: unknown): boolean { return value === null || text(value); }
function id(value: unknown): value is string { return typeof value === "string" && SLUG.test(value); }
function list(value: unknown, predicate: (item: unknown) => boolean): boolean { return Array.isArray(value) && value.length <= 5000 && value.every(predicate); }
function ids(value: unknown): value is string[] { return list(value, id) && new Set(value as string[]).size === (value as string[]).length; }
function one(value: unknown, options: string[]): boolean { return typeof value === "string" && options.includes(value); }
function dateStamp(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function exact(value: Record<string, unknown>, fields: string[]): boolean { return Object.keys(value).every((key) => fields.includes(key)) && fields.every((key) => key in value); }
function exactOptional(value: Record<string, unknown>, required: string[], optional: string[]): boolean { return Object.keys(value).every(key => required.includes(key) || optional.includes(key)) && required.every(key => key in value); }
function fail(path: string): never { throw new Error(`지식 데이터 형식 또는 연결을 확인하세요: ${path}`); }
function requireValue(condition: boolean, path: string): void { if (!condition) fail(path); }

/** Safe external links; this validates links, and never authorizes a server fetch. */
export function safeKnowledgeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")
      || !host.includes(".") || host === "localhost" || /(?:^|\.)(?:local|internal|localhost)$/.test(host)
      || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":") || Array.from(value).some(character => character.charCodeAt(0) <= 32)) return null;
    return url.href;
  } catch { return null; }
}
function evidence(value: unknown): value is EvidenceReference {
  return object(value) && exact(value, ["sourceId", "locator", "note"]) && id(value.sourceId) && text(value.locator) && text(value.note);
}
function review(value: unknown): boolean {
  return object(value) && exactOptional(value, ["status", "checkedAt", "checkedBy", "humanReviewed", "note"], ["scopes"])
    && one(value.status, ["needs-review", "source-checked", "approved", "withheld"])
    && dateStamp(value.checkedAt) && text(value.checkedBy) && typeof value.humanReviewed === "boolean" && text(value.note)
    && (value.status !== "approved" || value.humanReviewed === true)
    && (value.scopes === undefined || Array.isArray(value.scopes) && value.scopes.length <= 6 && new Set(value.scopes.map(scope => object(scope) ? scope.kind : null)).size === value.scopes.length && value.scopes.every(scope => object(scope) && exact(scope, ["kind", "status", "checkedAt", "checkedBy", "humanReviewed", "note"]) && one(scope.kind, ["bibliography", "locator", "interpretation", "rights", "translation", "geography"]) && review(scopeWithoutKind(scope))));
}
function scopeWithoutKind(value: Record<string, unknown>): Record<string, unknown> { const { kind: scopeKind, ...scope } = value; void scopeKind; return scope; }
function item(value: unknown, fields: string[], optional: string[] = []): value is Record<string, unknown> {
  return object(value) && exactOptional(value, ["id", "review", "evidence", ...fields], optional) && id(value.id) && review(value.review)
    && list(value.evidence, evidence) && (value.evidence as unknown[]).length > 0;
}
const NAMES = ["entities", "sources", "materials", "editions", "translations", "resources", "rights", "dates", "claims", "disagreements", "locations", "relations"] as const;
const arrayFields = [...NAMES, "collectionLevels", "recordLinks", "localizations"];
const historicalYear = (value: unknown): boolean => value === null || typeof value === "number" && Number.isInteger(value) && value !== 0 && Math.abs(value) <= 9999;
function historicalDate(value: unknown): boolean {
  if (!item(value, ["purpose", "label", "originalText", "calendar", "precision", "startYear", "endYear", "month", "day", "era", "conversion"])) return false;
  if (!one(value.purpose, ["event", "article", "creation", "publication", "registration"]) || !text(value.label) || !text(value.originalText)
    || !one(value.calendar, ["gregorian", "julian", "lunisolar", "unknown"]) || !one(value.precision, ["day", "year", "range", "approximate", "unknown"])
    || !historicalYear(value.startYear) || !historicalYear(value.endYear) || !nullableText(value.era)) return false;
  if (value.precision === "unknown") { if (value.startYear !== null || value.endYear !== null || value.month !== null || value.day !== null || value.conversion !== null) return false; }
  else {
    if (typeof value.startYear !== "number" || typeof value.endYear !== "number" || value.startYear > value.endYear) return false;
    if (["year", "day"].includes(String(value.precision)) && value.startYear !== value.endYear) return false;
    if (value.precision === "day") {
      if (value.calendar === "unknown" || typeof value.month !== "number" || !Number.isInteger(value.month) || value.month < 1 || value.month > 12
        || typeof value.day !== "number" || !Number.isInteger(value.day) || value.day < 1 || value.day > 31) return false;
      if (value.calendar === "lunisolar" && value.day > 30) return false;
      if (value.calendar === "gregorian" || value.calendar === "julian") {
        const year = value.startYear < 0 ? value.startYear + 1 : value.startYear;
        const leap = year % 4 === 0 && (value.calendar === "julian" || year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (value.day > days[value.month - 1]) return false;
      }
    } else if (value.month !== null || value.day !== null) return false;
  }
  return value.conversion === null || object(value.conversion) && exact(value.conversion, ["calendar", "text", "sourceId"])
    && one(value.conversion.calendar, ["gregorian", "julian"]) && text(value.conversion.text) && id(value.conversion.sourceId);
}
const validators: Record<(typeof NAMES)[number], (value: unknown) => boolean> = {
  entities: value => item(value, ["kind", "name", "aliases", "description", "recordIds", "externalAuthorityUrls"])
    && one(value.kind, ["person", "organization", "place"]) && text(value.name) && list(value.aliases, text) && text(value.description) && ids(value.recordIds) && list(value.externalAuthorityUrls, link => Boolean(safeKnowledgeUrl(link))),
  sources: value => item(value, ["title", "creator", "providerId", "kind", "languageTags", "url", "locator", "publicationDate", "accessedAt", "materialIds", "resourceIds", "rightsIds", "provenanceGroup"])
    && text(value.title) && text(value.creator) && id(value.providerId) && one(value.kind, ["primary", "research", "institutional", "testimony", "media"])
    && list(value.languageTags, tag => typeof tag === "string" && LANGUAGE.test(tag)) && (value.languageTags as string[]).length > 0
    && Boolean(safeKnowledgeUrl(value.url)) && text(value.locator) && (value.publicationDate === null || dateStamp(value.publicationDate)) && dateStamp(value.accessedAt)
    && ids(value.materialIds) && ids(value.resourceIds) && ids(value.rightsIds) && text(value.provenanceGroup),
  materials: value => item(value, ["title", "kind", "creatorIds", "languageTags", "dateIds", "editionIds", "description"])
    && text(value.title) && one(value.kind, ["diary", "retrospective", "annals", "other"]) && ids(value.creatorIds)
    && list(value.languageTags, tag => typeof tag === "string" && LANGUAGE.test(tag)) && ids(value.dateIds) && ids(value.editionIds) && text(value.description),
  editions: value => item(value, ["materialId", "title", "form", "extent", "dateIds", "custodianId", "identifier", "description"])
    && id(value.materialId) && text(value.title) && one(value.form, ["manuscript", "woodblock", "printed", "unknown"]) && nullableText(value.extent)
    && ids(value.dateIds) && (value.custodianId === null || id(value.custodianId)) && nullableText(value.identifier) && text(value.description),
  translations: value => item(value, ["materialId", "editionId", "languageTag", "translatorIds", "providerId", "title", "scope", "status", "resourceIds", "rightsId"])
    && id(value.materialId) && (value.editionId === null || id(value.editionId)) && typeof value.languageTag === "string" && LANGUAGE.test(value.languageTag)
    && ids(value.translatorIds) && id(value.providerId) && text(value.title) && text(value.scope) && one(value.status, ["available-at-provider", "draft", "unknown"]) && ids(value.resourceIds) && id(value.rightsId),
  resources: value => item(value, ["sourceId", "kind", "url", "materialId", "editionId", "translationId", "rightsId", "iiifManifest", "description"], ["iiifManifestJson"])
    && id(value.sourceId) && one(value.kind, ["institution-page", "original-and-translation", "image", "iiif"])
    && (value.url === null || Boolean(safeKnowledgeUrl(value.url))) && ["materialId", "editionId", "translationId"].every(key => value[key] === null || id(value[key]))
    && id(value.rightsId) && (value.iiifManifest === null || Boolean(safeKnowledgeUrl(value.iiifManifest))) && text(value.description)
    && (value.iiifManifestJson === undefined || validatedResourceManifest(value)),
  rights: value => {
    if (!item(value, ["target", "status", "statement", "licenseUrl", "attribution", "holder", "permissions"])) return false;
    if (!one(value.target, ["metadata", "original-text", "translation", "image", "iiif"]) || !one(value.status, ["unknown", "restricted", "open-licence", "permission-documented"])
      || !text(value.statement) || !(value.licenseUrl === null || Boolean(safeKnowledgeUrl(value.licenseUrl))) || !text(value.attribution) || !nullableText(value.holder)
      || !object(value.permissions) || !exact(value.permissions, ["display", "download", "reuse"]) || !Object.values(value.permissions).every(flag => typeof flag === "boolean")) return false;
    if (["unknown", "restricted"].includes(String(value.status)) && Object.values(value.permissions).some(Boolean)) return false;
    return value.status !== "open-licence" || value.licenseUrl !== null;
  },
  dates: historicalDate,
  claims: value => item(value, ["subjectId", "predicate", "text", "recordIds", "qualification"])
    && id(value.subjectId) && one(value.predicate, ["creator", "creation-period", "custodian", "registration", "article-date", "bibliography"]) && text(value.text) && ids(value.recordIds) && text(value.qualification),
  disagreements: value => item(value, ["title", "question", "recordIds", "claimIds", "positions", "status", "resolution"])
    && text(value.title) && text(value.question) && ids(value.recordIds) && ids(value.claimIds)
    && list(value.positions, position => object(position) && exact(position, ["label", "description", "evidence"]) && text(position.label) && text(position.description) && list(position.evidence, evidence) && (position.evidence as unknown[]).length > 0)
    && (value.positions as unknown[]).length >= 2 && one(value.status, ["open", "resolved"])
    && (value.status === "open" ? value.resolution === null : text(value.resolution) && object(value.review) && value.review.status === "approved" && value.review.humanReviewed === true),
  locations: value => item(value, ["entityId", "label", "kind", "coordinate", "boundary", "dateIds", "recordIds", "uncertainty"])
    && id(value.entityId) && text(value.label) && one(value.kind, ["historical-region", "battle-reference", "custodian-location"])
    && (value.coordinate === null || object(value.coordinate) && exact(value.coordinate, ["latitude", "longitude", "precision", "sourceId"])
      && typeof value.coordinate.latitude === "number" && Number.isFinite(value.coordinate.latitude) && Math.abs(value.coordinate.latitude) <= 90
      && typeof value.coordinate.longitude === "number" && Number.isFinite(value.coordinate.longitude) && Math.abs(value.coordinate.longitude) <= 180
      && one(value.coordinate.precision, ["site", "approximate"]) && id(value.coordinate.sourceId))
    && object(value.boundary) && exact(value.boundary, ["status", "note"]) && one(value.boundary.status, ["unknown", "not-applicable"]) && text(value.boundary.note)
    && ids(value.dateIds) && ids(value.recordIds) && text(value.uncertainty),
  relations: value => item(value, ["subjectId", "predicate", "objectId", "note"])
    && id(value.subjectId) && id(value.objectId) && value.subjectId !== value.objectId
    && one(value.predicate, ["authored", "provided-by", "held-by", "edition-of", "translation-of", "represented-by", "mentions", "associated-place"]) && text(value.note)
};

/** A closed, versioned schema with referential checks at the publishing boundary. */
export function parseKnowledgeRegistry(value: unknown, publicRecords?: KnowledgeArchiveRecord[]): KnowledgeRegistry {
  requireValue(object(value) && exact(value, ["version", "updatedAt", "scopeNote", ...arrayFields]), "registry");
  if (!object(value)) fail("registry");
  requireValue(value.version === 1 && dateStamp(value.updatedAt) && text(value.scopeNote), "registry.version/date/scope");
  for (const name of NAMES) requireValue(list(value[name], validators[name]), name);
  requireValue(list(value.collectionLevels, level => object(level) && exact(level, ["id", "label", "description", "requirements", "requiredReview"]) && id(level.id) && text(level.label) && text(level.description) && list(level.requirements, text) && one(level.requiredReview, ["source-checked", "approved"])), "collectionLevels");
  requireValue(list(value.recordLinks, link => object(link) && exact(link, ["recordId", "entityIds", "sourceIds", "materialIds", "dateIds", "claimIds", "locationIds", "collectionLevelId"]) && id(link.recordId) && ["entityIds", "sourceIds", "materialIds", "dateIds", "claimIds", "locationIds"].every(key => ids(link[key])) && id(link.collectionLevelId)), "recordLinks");
  requireValue(list(value.localizations, locale => object(locale) && exactOptional(locale, ["recordId", "locale", "sourceVersion", "sourceIdentity", "status", "title", "summary", "review"], ["full"]) && (locale.full === undefined || isFullRecordLocalization(locale.full)) && id(locale.recordId) && typeof locale.locale === "string" && LANGUAGE.test(locale.locale) && text(locale.sourceVersion) && (dateStamp(locale.sourceVersion) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(locale.sourceVersion) && dateStamp(locale.sourceVersion.slice(0, 10)) && Number.isFinite(new Date(locale.sourceVersion).valueOf())) && object(locale.sourceIdentity) && exact(locale.sourceIdentity, ["title", "summary"]) && text(locale.sourceIdentity.title) && text(locale.sourceIdentity.summary) && one(locale.status, ["source-checked", "draft", "in-review", "approved", "stale"]) && text(locale.title) && text(locale.summary) && review(locale.review)
    && (locale.status !== "approved" || object(locale.review) && locale.review.status === "approved" && locale.review.humanReviewed === true)
    && (locale.status !== "source-checked" || object(locale.review) && one(locale.review.status, ["source-checked", "approved"]))), "localizations");
  // One assertion after all fields and nested values have been checked.
  const registry = value as KnowledgeRegistry;
  const nodes: KnowledgeItem[] = [];
  for (const name of NAMES) nodes.push(...registry[name]);
  const nodeIds = new Set(nodes.map(node => node.id));
  requireValue(nodeIds.size === nodes.length, "duplicate node ID");
  const recordIds = new Set(registry.recordLinks.map(link => link.recordId));
  requireValue(recordIds.size === registry.recordLinks.length, "duplicate record link");
  const localeKeys = registry.localizations.map(locale => `${locale.recordId}:${locale.locale}`);
  requireValue(new Set(localeKeys).size === localeKeys.length, "duplicate locale");
  const has = (name: (typeof NAMES)[number], target: string): boolean => registry[name].some(node => node.id === target);
  const hasEntity = (target: string, kind?: string): boolean => registry.entities.some(entity => entity.id === target && (!kind || entity.kind === kind));
  const checkEvidence = (references: EvidenceReference[], path: string): void => requireValue(references.every(ref => has("sources", ref.sourceId)), path);
  for (const node of nodes) checkEvidence(node.evidence, `${node.id}.evidence`);
  for (const entity of registry.entities) requireValue(entity.recordIds.every(record => recordIds.has(record)), `${entity.id}.records`);
  for (const source of registry.sources) requireValue(hasEntity(source.providerId, "organization") && source.materialIds.every(target => has("materials", target)) && source.resourceIds.every(target => has("resources", target)) && source.rightsIds.every(target => has("rights", target)), `${source.id}.links`);
  for (const material of registry.materials) requireValue(material.creatorIds.every(target => hasEntity(target, "person")) && material.dateIds.every(target => has("dates", target)) && material.editionIds.every(target => has("editions", target)), `${material.id}.links`);
  for (const edition of registry.editions) requireValue(has("materials", edition.materialId) && edition.dateIds.every(target => has("dates", target)) && (edition.custodianId === null || hasEntity(edition.custodianId, "organization")), `${edition.id}.links`);
  for (const translation of registry.translations) requireValue(has("materials", translation.materialId) && (translation.editionId === null || registry.editions.some(edition => edition.id === translation.editionId && edition.materialId === translation.materialId)) && hasEntity(translation.providerId, "organization") && translation.translatorIds.every(target => hasEntity(target, "person")) && has("rights", translation.rightsId) && translation.resourceIds.every(target => has("resources", target)), `${translation.id}.links`);
  for (const resource of registry.resources) requireValue(has("sources", resource.sourceId) && has("rights", resource.rightsId) && (resource.materialId === null || has("materials", resource.materialId)) && (resource.editionId === null || registry.editions.some(edition => edition.id === resource.editionId && edition.materialId === resource.materialId)) && (resource.translationId === null || registry.translations.some(translation => translation.id === resource.translationId && translation.materialId === resource.materialId)), `${resource.id}.links`);
  for (const date of registry.dates) if (date.conversion) requireValue(has("sources", date.conversion.sourceId) && date.evidence.some(ref => ref.sourceId === date.conversion?.sourceId), `${date.id}.conversion evidence`);
  for (const claim of registry.claims) requireValue(nodeIds.has(claim.subjectId) && claim.recordIds.every(record => recordIds.has(record)), `${claim.id}.links`);
  for (const disagreement of registry.disagreements) {
    requireValue(disagreement.recordIds.every(record => recordIds.has(record)) && disagreement.claimIds.every(target => has("claims", target)), `${disagreement.id}.links`);
    for (const position of disagreement.positions) checkEvidence(position.evidence, `${disagreement.id}.positions`);
  }
  for (const location of registry.locations) requireValue(hasEntity(location.entityId, "place") && location.recordIds.every(record => recordIds.has(record)) && location.dateIds.every(target => has("dates", target)) && (location.coordinate === null || has("sources", location.coordinate.sourceId) && location.evidence.some(ref => ref.sourceId === location.coordinate?.sourceId)), `${location.id}.links/coordinate evidence`);
  const relationTypes: Record<string, (subject: string, target: string) => boolean> = {
    authored: (subject, target) => hasEntity(subject, "person") && has("materials", target),
    "provided-by": (subject, target) => (has("sources", subject) || has("translations", subject)) && hasEntity(target, "organization"),
    "held-by": (subject, target) => has("editions", subject) && hasEntity(target, "organization"),
    "edition-of": (subject, target) => has("editions", subject) && has("materials", target),
    "translation-of": (subject, target) => has("translations", subject) && has("materials", target),
    "represented-by": (subject, target) => (has("materials", subject) || has("editions", subject)) && has("resources", target),
    mentions: (subject, target) => (recordIds.has(subject) || has("sources", subject) || has("materials", subject)) && has("entities", target),
    "associated-place": (subject, target) => recordIds.has(subject) && hasEntity(target, "place")
  };
  for (const relation of registry.relations) requireValue(relationTypes[relation.predicate](relation.subjectId, relation.objectId), `${relation.id}.typed relation`);
  const levels = new Set(registry.collectionLevels.map(level => level.id));
  requireValue(levels.size === registry.collectionLevels.length, "duplicate collection level");
  for (const link of registry.recordLinks) requireValue(link.entityIds.every(target => has("entities", target)) && link.sourceIds.every(target => has("sources", target)) && link.materialIds.every(target => has("materials", target)) && link.dateIds.every(target => has("dates", target)) && link.claimIds.every(target => has("claims", target)) && link.locationIds.every(target => has("locations", target)) && levels.has(link.collectionLevelId), `${link.recordId}.knowledge links`);
  for (const locale of registry.localizations) requireValue(recordIds.has(locale.recordId), `${locale.recordId}.locale record`);
  if (publicRecords) {
    const sourceMap = new Map(publicRecords.flatMap(record => record.sources.map(source => [source.id, source] as const)));
    const availableRecords = new Set(publicRecords.map(record => record.id));
    // Registered links may remain after a record is withheld; public projection removes them.
    for (const source of registry.sources) {
      const original = sourceMap.get(source.id);
      if (!original) continue;
      const provider = registry.entities.find(entity => entity.id === source.providerId);
      requireValue(safeKnowledgeUrl(original.url) === safeKnowledgeUrl(source.url) && original.title === source.title && original.creator === source.creator && original.kind === source.kind && original.independenceGroup === source.provenanceGroup && provider?.name === original.institution, `${source.id}.archive source mismatch`);
    }
    for (const link of registry.recordLinks.filter(entry => availableRecords.has(entry.recordId))) {
      const record = publicRecords.find(entry => entry.id === link.recordId);
      requireValue(Boolean(record) && link.sourceIds.every(target => record?.sources.some(source => source.id === target)), `${link.recordId}.archive source links`);
    }
  }
  return registry;
}

export function isKnowledgePublic(item: KnowledgeItem): boolean { return item.review.status === "source-checked" || item.review.status === "approved" && item.review.humanReviewed; }
export function getMediaControls(rights: KnowledgeRights): { display: boolean; download: boolean; reuse: boolean; reason: string } {
  const permitted = ["open-licence", "permission-documented"].includes(rights.status) && hasApprovedKnowledgeReview(rights.review, "rights");
  return { display: permitted && rights.permissions.display, download: permitted && rights.permissions.download, reuse: permitted && rights.permissions.reuse,
    reason: permitted ? rights.statement : "미디어 이용 근거와 사람 검토가 확인될 때까지 기관 페이지 링크만 제공합니다." };
}
export function projectPublicKnowledge(registry: KnowledgeRegistry, publicRecords: KnowledgeArchiveRecord[]): KnowledgeRegistry {
  const records = new Set(publicRecords.map(record => record.id));
  const sources = new Set(publicRecords.flatMap(record => record.sources.map(source => source.id)));
  const eligible = (node: KnowledgeItem): boolean => isKnowledgePublic(node) && node.evidence.every(reference => sources.has(reference.sourceId));
  const projected: KnowledgeRegistry = {
    version: registry.version, updatedAt: registry.updatedAt, scopeNote: registry.scopeNote,
    entities: registry.entities.filter(entity => isKnowledgePublic(entity) && entity.evidence.some(reference => sources.has(reference.sourceId))).map(entity => ({ ...entity, evidence: entity.evidence.filter(reference => sources.has(reference.sourceId)), recordIds: entity.recordIds.filter(record => records.has(record)) })),
    sources: registry.sources.filter(source => sources.has(source.id) && eligible(source)),
    materials: registry.materials.filter(eligible), editions: registry.editions.filter(eligible),
    translations: registry.translations.filter(translation => eligible(translation) && translation.status === "available-at-provider"),
    resources: registry.resources.filter(eligible).map(resource => {
      const rights = registry.rights.find(right => right.id === resource.rightsId);
      const mayDisplay = rights && getMediaControls(rights).display && (resource.kind !== "iiif" || hasApprovedKnowledgeReview(resource.review, "rights") && Boolean(resource.iiifManifestJson));
      if (!mayDisplay && "iiifManifestJson" in resource) { const { iiifManifestJson: privateManifest, ...visible } = resource; void privateManifest; return { ...visible, url: ["image", "iiif"].includes(resource.kind) ? null : resource.url, iiifManifest: null }; }
      return { ...resource, url: ["image", "iiif"].includes(resource.kind) && !mayDisplay ? null : resource.url, iiifManifest: mayDisplay ? resource.iiifManifest : null };
    }),
    rights: registry.rights.filter(eligible), dates: registry.dates.filter(eligible),
    claims: registry.claims.filter(claim => eligible(claim) && claim.recordIds.some(record => records.has(record))).map(claim => ({ ...claim, recordIds: claim.recordIds.filter(record => records.has(record)) })),
    disagreements: registry.disagreements.filter(disagreement => eligible(disagreement) && disagreement.recordIds.some(record => records.has(record))).map(disagreement => ({ ...disagreement, recordIds: disagreement.recordIds.filter(record => records.has(record)) })),
    locations: registry.locations.filter(location => eligible(location) && location.recordIds.some(record => records.has(record))).map(location => ({ ...location, recordIds: location.recordIds.filter(record => records.has(record)) })),
    relations: registry.relations.filter(eligible), collectionLevels: registry.collectionLevels,
    recordLinks: registry.recordLinks.filter(link => records.has(link.recordId)),
    localizations: registry.localizations.filter(locale => records.has(locale.recordId) && publicRecords.some(record => record.id === locale.recordId && getPublishedLocalization(registry, record, locale.locale) !== null))
  };
  // Dependency closure: withholding any dependency also withholds assertions which require it.
  for (let pass = 0; pass <= NAMES.length; pass++) {
    const nodeIds = new Set(NAMES.flatMap(name => projected[name].map(node => node.id)));
    const keep = (targets: string[]) => targets.filter(target => nodeIds.has(target));
    const has = (target: string | null) => target === null || nodeIds.has(target);
    projected.entities = projected.entities.filter(entity => entity.evidence.every(ref => nodeIds.has(ref.sourceId)));
    projected.sources = projected.sources.filter(source => nodeIds.has(source.providerId) && source.evidence.every(ref => nodeIds.has(ref.sourceId))).map(source => ({ ...source, materialIds: keep(source.materialIds), resourceIds: keep(source.resourceIds), rightsIds: keep(source.rightsIds) }));
    projected.materials = projected.materials.filter(material => material.evidence.every(ref => nodeIds.has(ref.sourceId))).map(material => ({ ...material, creatorIds: keep(material.creatorIds), dateIds: keep(material.dateIds), editionIds: keep(material.editionIds) }));
    projected.editions = projected.editions.filter(edition => nodeIds.has(edition.materialId) && has(edition.custodianId) && edition.evidence.every(ref => nodeIds.has(ref.sourceId))).map(edition => ({ ...edition, dateIds: keep(edition.dateIds) }));
    projected.translations = projected.translations.filter(translation => nodeIds.has(translation.materialId) && has(translation.editionId) && nodeIds.has(translation.providerId) && nodeIds.has(translation.rightsId) && translation.evidence.every(ref => nodeIds.has(ref.sourceId))).map(translation => ({ ...translation, translatorIds: keep(translation.translatorIds), resourceIds: keep(translation.resourceIds) }));
    projected.resources = projected.resources.filter(resource => nodeIds.has(resource.sourceId) && nodeIds.has(resource.rightsId) && has(resource.materialId) && has(resource.editionId) && has(resource.translationId) && resource.evidence.every(ref => nodeIds.has(ref.sourceId)));
    projected.rights = projected.rights.filter(rights => rights.evidence.every(ref => nodeIds.has(ref.sourceId)));
    projected.dates = projected.dates.filter(date => date.evidence.every(ref => nodeIds.has(ref.sourceId)) && (!date.conversion || nodeIds.has(date.conversion.sourceId)));
    projected.claims = projected.claims.filter(claim => nodeIds.has(claim.subjectId) && claim.evidence.every(ref => nodeIds.has(ref.sourceId)));
    projected.disagreements = projected.disagreements.filter(disagreement => disagreement.claimIds.every(target => nodeIds.has(target)) && disagreement.evidence.every(ref => nodeIds.has(ref.sourceId)) && disagreement.positions.every(position => position.evidence.every(ref => nodeIds.has(ref.sourceId))));
    projected.locations = projected.locations.filter(location => nodeIds.has(location.entityId) && location.evidence.every(ref => nodeIds.has(ref.sourceId)) && (!location.coordinate || nodeIds.has(location.coordinate.sourceId))).map(location => ({ ...location, dateIds: keep(location.dateIds) }));
    projected.relations = projected.relations.filter(relation => (nodeIds.has(relation.subjectId) || records.has(relation.subjectId)) && nodeIds.has(relation.objectId) && relation.evidence.every(ref => nodeIds.has(ref.sourceId)));
    projected.recordLinks = projected.recordLinks.map(link => ({ ...link, entityIds: keep(link.entityIds), sourceIds: keep(link.sourceIds), materialIds: keep(link.materialIds), dateIds: keep(link.dateIds), claimIds: keep(link.claimIds), locationIds: keep(link.locationIds) }));
  }
  return projected;
}

export function getRecordKnowledge(registry: KnowledgeRegistry, recordId: string): RecordKnowledge {
  const link = registry.recordLinks.find(entry => entry.recordId === recordId);
  const materialIds = link?.materialIds ?? [];
  const sources = registry.sources.filter(source => link?.sourceIds.includes(source.id));
  const sourceIds = sources.map(source => source.id);
  return {
    entities: registry.entities.filter(entity => link?.entityIds.includes(entity.id)), sources,
    materials: registry.materials.filter(material => materialIds.includes(material.id)),
    editions: registry.editions.filter(edition => materialIds.includes(edition.materialId)),
    translations: registry.translations.filter(translation => materialIds.includes(translation.materialId)),
    resources: registry.resources.filter(resource => sourceIds.includes(resource.sourceId)),
    dates: registry.dates.filter(date => link?.dateIds.includes(date.id)),
    claims: registry.claims.filter(claim => link?.claimIds.includes(claim.id)),
    disagreements: registry.disagreements.filter(disagreement => disagreement.recordIds.includes(recordId)),
    locations: registry.locations.filter(location => link?.locationIds.includes(location.id)),
    relations: registry.relations.filter(relation => relation.subjectId === recordId || link?.entityIds.includes(relation.subjectId) || materialIds.includes(relation.subjectId) || sourceIds.includes(relation.subjectId)),
    localizations: registry.localizations.filter(locale => locale.recordId === recordId),
    collectionLevel: registry.collectionLevels.find(level => level.id === link?.collectionLevelId) ?? null
  };
}
export function formatHistoricalDate(date: HistoricalDate): string {
  const calendar = { gregorian: "그레고리력", julian: "율리우스력", lunisolar: "당시 역법·음력", unknown: "역법 미확정" }[date.calendar];
  const year = (value: number): string => value < 0 ? `기원전 ${Math.abs(value)}년` : `${value}년`;
  if (date.precision === "unknown" || date.startYear === null || date.endYear === null) return `${date.originalText} · 시점 미확정`;
  const range = date.startYear === date.endYear ? year(date.startYear) : `${year(date.startYear)}–${year(date.endYear)}`;
  const day = date.precision === "day" ? ` ${date.month}월 ${date.day}일` : "";
  return `${range}${day}${date.precision === "approximate" ? " 무렵" : ""} · ${calendar}${date.era ? ` · ${date.era}` : ""}${date.conversion ? ` / 확인된 환산: ${date.conversion.text}` : ""}`;
}
export function bibliographicJson(source: KnowledgeSource) {
  return { id: source.id, type: "webpage", title: source.title, author: [{ literal: source.creator }], URL: source.url,
    language: source.languageTags.join("; "), accessed: { "date-parts": [source.accessedAt.split("-").map(Number)] },
    ...(source.publicationDate ? { issued: { "date-parts": [source.publicationDate.split("-").map(Number)] } } : {}),
    note: `${source.locator} / 제공 기관 ID: ${source.providerId} / 출처 대조: ${source.review.checkedAt}; 사람 검토: ${source.review.humanReviewed ? "완료" : "대기"}` };
}
export function bibliographicRis(source: KnowledgeSource): string {
  const line = (value: string) => Array.from(value).map(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? " " : character).join("").replace(/ +/g, " ").trim();
  return [`TY  - ELEC`, `ID  - ${line(source.id)}`, `TI  - ${line(source.title)}`, `AU  - ${line(source.creator)}`,
    `UR  - ${line(source.url)}`, `LA  - ${line(source.languageTags.join("; "))}`, ...(source.publicationDate ? [`DA  - ${source.publicationDate.replace(/-/g, "/")}`] : []),
    `Y2  - ${source.accessedAt.replace(/-/g, "/")}`, `N1  - ${line(source.locator)}; 제공 기관 ID: ${line(source.providerId)}; 사람 검토 ${source.review.humanReviewed ? "완료" : "대기"}`, "ER  -", ""].join("\n");
}
export function buildKnowledgeJsonLd(registry: KnowledgeRegistry, baseUrl: string) {
  let base = safeKnowledgeUrl(baseUrl);
  if (!base) {
    try {
      const local = new URL(baseUrl);
      if (["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) && ["http:", "https:"].includes(local.protocol) && !local.username && !local.password && !local.search && !local.hash) base = local.href;
    } catch { /* Report a stable validation error below. */ }
  }
  if (!base) throw new Error("JSON-LD base URL must be public HTTPS or an explicit local preview URL.");
  const root = base.replace(/\/$/, "");
  return { "@context": "https://schema.org", "@graph": [
    ...registry.entities.map(entity => ({ "@id": `${root}/entities/${entity.id}/`, "@type": { person: "Person", organization: "Organization", place: "Place" }[entity.kind], name: entity.name, alternateName: entity.aliases, description: entity.description, sameAs: entity.externalAuthorityUrls })),
    ...registry.sources.map(source => ({ "@id": `${root}/sources/${source.id}/`, "@type": "CreativeWork", name: source.title, url: source.url, inLanguage: source.languageTags, creator: { name: source.creator }, provider: { "@id": `${root}/entities/${source.providerId}/` }, citation: source.locator })),
    ...registry.materials.map(material => ({ "@id": `${root}/materials/${material.id}`, "@type": "CreativeWork", name: material.title, inLanguage: material.languageTags, description: material.description, author: material.creatorIds.map(target => ({ "@id": `${root}/entities/${target}/` })) }))
  ] };
}
export function knowledgeSearchProjection(registry: KnowledgeRegistry) {
  return registry.entities.map(entity => ({ id: entity.id, kind: entity.kind, name: entity.name, aliases: entity.aliases, recordIds: entity.recordIds, description: entity.description }));
}

/** Locale identity is separate from an institution source's language. */
export function getPublishedLocalization(registry: KnowledgeRegistry, record: KnowledgeArchiveRecord, locale: string): KnowledgeLocalization | null {
  const translation = registry.localizations.find(entry => entry.recordId === record.id && entry.locale === locale);
  if (!translation || translation.sourceVersion !== record.updatedAt || translation.sourceIdentity.title !== record.title || translation.sourceIdentity.summary !== record.summary) return null;
  if (translation.full) return getFullLocalization(registry, record, locale);
  if (locale === "ko" && translation.status === "source-checked" && ["source-checked", "approved"].includes(translation.review.status)) return translation;
  return translation.status === "approved" && translation.review.status === "approved" && translation.review.humanReviewed ? translation : null;
}
export function getPublicLocaleRoutes(registry: KnowledgeRegistry, records: KnowledgeArchiveRecord[]) {
  return registry.localizations.flatMap(entry => {
    const record = records.find(record => record.id === entry.recordId);
    const published = record && getPublishedLocalization(registry, record, entry.locale);
    return published ? [{ recordId: record.id, locale: published.locale, sourceVersion: published.sourceVersion,
      scope: published.full ? "full-record" as const : "title-and-summary" as const, canonicalRecordId: record.id }] : [];
  });
}

/** Only projected public data enters artifacts; original media is never part of bibliography. */
export function buildKnowledgePublicArtifacts(registry: KnowledgeRegistry, publicRecords: KnowledgeArchiveRecord[], baseUrl: string) {
  const projected = parseKnowledgeRegistry(projectPublicKnowledge(registry, publicRecords), publicRecords);
  return {
    registry: projected, jsonLd: buildKnowledgeJsonLd(projected, baseUrl), entities: knowledgeSearchProjection(projected),
    bibliography: projected.sources.map(source => ({ id: source.id, json: bibliographicJson(source), ris: bibliographicRis(source) })),
    localeRoutes: getPublicLocaleRoutes(projected, publicRecords),
    media: projected.resources.filter(resource => ["image", "iiif"].includes(resource.kind)).flatMap(resource => {
      const rights = projected.rights.find(right => right.id === resource.rightsId);
      const link = publicResourceLink(resource, projected);
      return rights && link ? [{ id: resource.id, sourceId: resource.sourceId, url: link, iiifManifest: resource.iiifManifest,
        attribution: rights.attribution, controls: getMediaControls(rights) }] : [];
    })
  };
}

/** Supports a bounded Presentation 3 manifest metadata preview, without fetching its resources. */
export function validateIiifManifest(value: unknown): IiifPreview {
  if (!object(value) || value.type !== "Manifest" || !(value["@context"] === "http://iiif.io/api/presentation/3/context.json" || value["@context"] === "https://iiif.io/api/presentation/3/context.json" || Array.isArray(value["@context"]) && value["@context"].some(entry => entry === "http://iiif.io/api/presentation/3/context.json" || entry === "https://iiif.io/api/presentation/3/context.json")) || !safeKnowledgeUrl(value.id)) fail("IIIF Manifest/version/id");
  const plain = (value: string) => Array.from(value.replace(/<[^>]*>/g, "")).map(character => character.charCodeAt(0) < 32 ? " " : character).join("").slice(0, 2000);
  const languageMap = (value: unknown, optional = false): string => {
    if (value === undefined && optional) return "";
    if (!object(value) || !Object.keys(value).length || !Object.entries(value).every(([language, entries]) => (language === "none" || LANGUAGE.test(language)) && list(entries, text) && (entries as unknown[]).length > 0)) fail("IIIF language map");
    const labels = value.ko ?? value.en ?? value.none ?? Object.values(value)[0];
    return (labels as string[]).map(plain).join(" / ");
  };
  if (value.rights !== undefined && !safeKnowledgeUrl(value.rights)) fail("IIIF rights URI");
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > 500) fail("IIIF Canvas items (1–500)");
  const imageLinks: string[] = [];
  const canvases = value.items.map((canvas: unknown) => {
    if (!object(canvas) || canvas.type !== "Canvas" || !safeKnowledgeUrl(canvas.id) || typeof canvas.width !== "number" || !Number.isInteger(canvas.width) || canvas.width < 1 || canvas.width > 100000 || typeof canvas.height !== "number" || !Number.isInteger(canvas.height) || canvas.height < 1 || canvas.height > 100000) fail("IIIF Canvas dimensions/id");
    if (canvas.items !== undefined) {
      if (!Array.isArray(canvas.items) || canvas.items.length > 100) fail("IIIF AnnotationPage items");
      for (const page of canvas.items) {
        if (!object(page) || page.type !== "AnnotationPage" || !safeKnowledgeUrl(page.id) || !Array.isArray(page.items) || page.items.length > 1000) fail("IIIF AnnotationPage");
        for (const annotation of page.items) {
          if (!object(annotation) || annotation.type !== "Annotation" || !safeKnowledgeUrl(annotation.id) || annotation.motivation !== "painting" || !object(annotation.body) || annotation.body.type !== "Image" || !safeKnowledgeUrl(annotation.body.id) || annotation.target !== canvas.id) fail("IIIF painting Image annotation");
          imageLinks.push(String(annotation.body.id));
        }
      }
    }
    const images = imageLinks.filter(link => (canvas.items as unknown[] | undefined)?.some(page => object(page) && Array.isArray(page.items) && page.items.some(annotation => object(annotation) && object(annotation.body) && annotation.body.id === link)));
    return { id: String(canvas.id), label: languageMap(canvas.label), width: canvas.width, height: canvas.height, imageLinks: images };
  });
  const provider: string[] = [];
  if (value.provider !== undefined) {
    if (!Array.isArray(value.provider) || value.provider.length > 20) fail("IIIF provider");
    for (const agent of value.provider) {
      if (!object(agent) || agent.type !== "Agent" || !safeKnowledgeUrl(agent.id)) fail("IIIF provider Agent");
      provider.push(languageMap(agent.label));
    }
  }
  let attribution = "";
  if (value.requiredStatement !== undefined) {
    if (!object(value.requiredStatement)) fail("IIIF requiredStatement");
    attribution = `${languageMap(value.requiredStatement.label)}: ${languageMap(value.requiredStatement.value)}`;
  }
  return { id: String(value.id), title: languageMap(value.label), summary: languageMap(value.summary, true), rights: value.rights ? String(value.rights) : null,
    attribution, provider, canvases, imageLinks, warning: "구조 확인은 권리 허가·기관 인증·내용 검수를 뜻하지 않습니다. 입력 미리보기에서는 외부 이미지 요청과 게시를 하지 않습니다." };
}
function validatedResourceManifest(value: Record<string, unknown>): boolean {
  if (value.kind !== "iiif" || !value.iiifManifest || !object(value.iiifManifestJson)) return false;
  try { if (JSON.stringify(value.iiifManifestJson).length > 1_000_000) return false; return validateIiifManifest(value.iiifManifestJson).id === value.iiifManifest; }
  catch { return false; }
}
export function publicResourceLink(resource: DigitalResource, registry: KnowledgeRegistry): string | null {
  if (["image", "iiif"].includes(resource.kind)) {
    const rights = registry.rights.find(right => right.id === resource.rightsId);
    if (!rights || !getMediaControls(rights).display) return null;
    if (resource.kind === "iiif" && (!hasApprovedKnowledgeReview(resource.review, "rights") || !resource.iiifManifestJson)) return null;
  }
  return safeKnowledgeUrl(resource.url);
}
