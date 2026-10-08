export type ReviewStatus = "needs-review" | "source-checked" | "approved" | "withheld";
export type SourceKind = "primary" | "research" | "institutional" | "testimony" | "media";
export type ArchiveSource = {
  id: string; title: string; creator: string; institution: string; url: string;
  kind: SourceKind; language: string; created?: string; location: string;
  rights: string; checkedAt: string; independenceGroup: string;
};
export type ArchiveDate = {
  startYear: number | null; endYear: number | null;
  precision: "day" | "year" | "range" | "approximate" | "unknown";
};
export type ArchiveEntity = { id: string; name: string; aliases: string[] };
export type ArchiveSection = { id: string; title: string; paragraphs: string[]; sourceIds: string[]; interpretation?: boolean };
export type ArchiveMoment = { date: string; year: number | null; title: string; text: string; sourceIds: string[] };
export type ArchiveRecord = {
  id: string; title: string; period: string; region: string; summary: string;
  kind: "event" | "source"; language: string; labels: string[]; aliases: string[];
  date: ArchiveDate; people: ArchiveEntity[]; places: ArchiveEntity[];
  review: { status: ReviewStatus; reviewer: string; reviewedAt: string; note: string; humanReviewed: boolean };
  sources: ArchiveSource[]; sections: ArchiveSection[]; chronology: ArchiveMoment[];
  limitations: string[]; relatedIds: string[]; collectionIds: string[];
  publishedAt: string; updatedAt: string; readingMinutes: number;
  featuredReason?: string; sensitivity?: string;
  corrections: { date: string; reason: string }[];
  sourceCount: number;
};
export type SearchRecord = Pick<ArchiveRecord, "id" | "title" | "period" | "region" | "summary" | "kind" | "language" | "labels" | "aliases" | "date" | "people" | "places" | "updatedAt" | "readingMinutes"> & {
  sourceCount: number; institutions: string[]; reviewStatus: ReviewStatus; hasOriginal: boolean;
};
export type EditorialTheme = { id: string; title: string; question: string; description: string; labels: string[]; recordIds: string[]; learningQuestions: string[] };
export type EditorialCollection = { id: string; title: string; region: string; period: string; description: string; criteria: string; limitations: string; recordIds: string[]; steps: { title: string; description: string; recordIds: string[] }[] };
export type EditorialStory = { id: string; title: string; deck: string; introduction: string; sections: ArchiveSection[]; recordIds: string[]; sourceIds: string[]; updatedAt: string; readingMinutes: number; author: string; reviewNote: string; learningQuestions: string[] };
