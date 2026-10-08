import type { ArchiveRecord, ReviewStatus, SourceKind } from "./archive-types";

export type ReviewScope = { kind: "bibliography" | "locator" | "interpretation" | "rights" | "translation" | "geography"; status: ReviewStatus; checkedAt: string; checkedBy: string; humanReviewed: boolean; note: string };
export type KnowledgeReview = { status: ReviewStatus; checkedAt: string; checkedBy: string; humanReviewed: boolean; note: string; scopes?: ReviewScope[] };
export type EvidenceReference = { sourceId: string; locator: string; note: string };
export type KnowledgeItem = { id: string; review: KnowledgeReview; evidence: EvidenceReference[] };
export type KnowledgeEntity = KnowledgeItem & {
  kind: "person" | "organization" | "place"; name: string; aliases: string[];
  description: string; recordIds: string[]; externalAuthorityUrls: string[];
};
export type HistoricalDate = KnowledgeItem & {
  purpose: "event" | "article" | "creation" | "publication" | "registration";
  label: string; originalText: string; calendar: "gregorian" | "julian" | "lunisolar" | "unknown";
  precision: "day" | "year" | "range" | "approximate" | "unknown";
  startYear: number | null; endYear: number | null; month: number | null; day: number | null;
  era: string | null; conversion: { calendar: "gregorian" | "julian"; text: string; sourceId: string } | null;
};
export type KnowledgeMaterial = KnowledgeItem & {
  title: string; kind: "diary" | "retrospective" | "annals" | "other"; creatorIds: string[];
  languageTags: string[]; dateIds: string[]; editionIds: string[]; description: string;
};
export type KnowledgeEdition = KnowledgeItem & {
  materialId: string; title: string; form: "manuscript" | "woodblock" | "printed" | "unknown";
  extent: string | null; dateIds: string[]; custodianId: string | null; identifier: string | null;
  description: string;
};
export type KnowledgeTranslation = KnowledgeItem & {
  materialId: string; editionId: string | null; languageTag: string; translatorIds: string[];
  providerId: string; title: string; scope: string;
  status: "available-at-provider" | "draft" | "unknown";
  resourceIds: string[]; rightsId: string;
};
export type KnowledgeRights = KnowledgeItem & {
  target: "metadata" | "original-text" | "translation" | "image" | "iiif";
  status: "unknown" | "restricted" | "open-licence" | "permission-documented";
  statement: string; licenseUrl: string | null; attribution: string; holder: string | null;
  permissions: { display: boolean; download: boolean; reuse: boolean };
};
export type DigitalResource = KnowledgeItem & {
  sourceId: string; kind: "institution-page" | "original-and-translation" | "image" | "iiif";
  url: string | null; materialId: string | null; editionId: string | null; translationId: string | null;
  rightsId: string; iiifManifest: string | null; description: string;
  iiifManifestJson?: unknown;
};
export type KnowledgeSource = KnowledgeItem & {
  title: string; creator: string; providerId: string; kind: SourceKind; languageTags: string[];
  url: string; locator: string; publicationDate: string | null; accessedAt: string;
  materialIds: string[]; resourceIds: string[]; rightsIds: string[]; provenanceGroup: string;
};
export type KnowledgeClaim = KnowledgeItem & {
  subjectId: string; predicate: "creator" | "creation-period" | "custodian" | "registration" | "article-date" | "bibliography";
  text: string; recordIds: string[]; qualification: string;
};
export type KnowledgeDisagreement = KnowledgeItem & {
  title: string; question: string; recordIds: string[]; claimIds: string[];
  positions: { label: string; description: string; evidence: EvidenceReference[] }[];
  status: "open" | "resolved"; resolution: string | null;
};
export type KnowledgeLocation = KnowledgeItem & {
  entityId: string; label: string; kind: "historical-region" | "battle-reference" | "custodian-location";
  coordinate: { latitude: number; longitude: number; precision: "site" | "approximate"; sourceId: string } | null;
  boundary: { status: "unknown" | "not-applicable"; note: string };
  dateIds: string[]; recordIds: string[]; uncertainty: string;
};
export type KnowledgeRelation = KnowledgeItem & {
  subjectId: string; predicate: "authored" | "provided-by" | "held-by" | "edition-of" | "translation-of" | "represented-by" | "mentions" | "associated-place";
  objectId: string; note: string;
};
export type CollectionLevel = { id: string; label: string; description: string; requirements: string[]; requiredReview: "source-checked" | "approved" };
export type RecordKnowledgeLink = {
  recordId: string; entityIds: string[]; sourceIds: string[]; materialIds: string[];
  dateIds: string[]; claimIds: string[]; locationIds: string[]; collectionLevelId: string;
};
export type KnowledgeLocalization = {
  recordId: string; locale: string; sourceVersion: string; status: "source-checked" | "draft" | "in-review" | "approved" | "stale";
  sourceIdentity: { title: string; summary: string }; title: string; summary: string; review: KnowledgeReview;
  full?: FullRecordLocalization;
};
export const localizedUiKeys = ["home", "archive", "explore", "timeline", "collections", "stories", "back", "review", "evidence", "limitations", "sources", "loading", "failed", "retry", "scopeHelp", "rightsHelp", "translator", "reviewer"] as const;
export type FullRecordLocalization = {
  scope: "full-record"; sourceContentHash: string;
  sourceParagraphVersions: { sectionId: string; paragraphIndex: number; sourceHash: string; sourceVersion: string }[];
  sections: { id: string; title: string; paragraphs: string[] }[];
  chronology: { index: number; title: string; text: string }[];
  limitations: string[]; translator: string; reviewer: string; approvedAt: string;
  ui: Record<(typeof localizedUiKeys)[number], string>;
};
export type KnowledgeRegistry = {
  version: 1; updatedAt: string; scopeNote: string;
  entities: KnowledgeEntity[]; sources: KnowledgeSource[]; materials: KnowledgeMaterial[];
  editions: KnowledgeEdition[]; translations: KnowledgeTranslation[]; resources: DigitalResource[];
  rights: KnowledgeRights[]; dates: HistoricalDate[]; claims: KnowledgeClaim[];
  disagreements: KnowledgeDisagreement[]; locations: KnowledgeLocation[]; relations: KnowledgeRelation[];
  collectionLevels: CollectionLevel[]; recordLinks: RecordKnowledgeLink[]; localizations: KnowledgeLocalization[];
};
export type RecordKnowledge = {
  entities: KnowledgeEntity[]; sources: KnowledgeSource[]; materials: KnowledgeMaterial[];
  editions: KnowledgeEdition[]; translations: KnowledgeTranslation[]; resources: DigitalResource[];
  dates: HistoricalDate[]; claims: KnowledgeClaim[]; disagreements: KnowledgeDisagreement[];
  locations: KnowledgeLocation[]; relations: KnowledgeRelation[]; localizations: KnowledgeLocalization[];
  collectionLevel: CollectionLevel | null;
};
export type KnowledgeArchiveRecord = Pick<ArchiveRecord, "id" | "title" | "summary" | "updatedAt" | "sources"> & Partial<Pick<ArchiveRecord, "sections" | "chronology" | "limitations">>;
export type IiifPreview = {
  id: string; title: string; summary: string; rights: string | null; attribution: string;
  provider: string[]; canvases: { id: string; label: string; width: number; height: number; imageLinks?: string[] }[];
  imageLinks: string[]; warning: string;
};
