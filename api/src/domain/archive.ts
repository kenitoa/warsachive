import type { ArchiveRecord } from "../../../web/lib/archive-types.ts";
import { isArchiveRecord, isPublicRecord } from "../../../web/lib/archive-domain.ts";
import { check } from "./errors.ts";
import { isSafeJson } from "./validation.ts";
/** Explicit public projection. Unknown keys and private workflow fields never cross this boundary. */
export function publicRecord(value: unknown): ArchiveRecord {
  check(isSafeJson(value) && isArchiveRecord(value), 400, "INVALID_RECORD", "기록 계약을 확인해 주세요.");
  const record: ArchiveRecord = {
    id: value.id, title: value.title, period: value.period, region: value.region, summary: value.summary,
    kind: value.kind, language: value.language, labels: [...value.labels], aliases: [...value.aliases],
    date: { startYear: value.date.startYear, endYear: value.date.endYear, precision: value.date.precision },
    people: value.people.map(({ id, name, aliases }) => ({ id, name, aliases: [...aliases] })), places: value.places.map(({ id, name, aliases }) => ({ id, name, aliases: [...aliases] })),
    review: { status: value.review.status, reviewer: value.review.reviewer, reviewedAt: value.review.reviewedAt, note: value.review.note, humanReviewed: value.review.humanReviewed },
    sources: value.sources.map((source) => ({ id: source.id, title: source.title, creator: source.creator, institution: source.institution, url: source.url, kind: source.kind, language: source.language, location: source.location, rights: source.rights, checkedAt: source.checkedAt, independenceGroup: source.independenceGroup, ...(source.created === undefined ? {} : { created: source.created }) })),
    sections: value.sections.map((section) => ({ id: section.id, title: section.title, paragraphs: [...section.paragraphs], sourceIds: [...section.sourceIds], ...(section.interpretation === undefined ? {} : { interpretation: section.interpretation }) })),
    chronology: value.chronology.map(({ date, year, title, text, sourceIds }) => ({ date, year, title, text, sourceIds: [...sourceIds] })),
    limitations: [...value.limitations], relatedIds: [...value.relatedIds], collectionIds: [...value.collectionIds], publishedAt: value.publishedAt, updatedAt: value.updatedAt, readingMinutes: value.readingMinutes, corrections: value.corrections.map(({ date, reason }) => ({ date, reason })), sourceCount: value.sourceCount,
    ...(value.featuredReason === undefined ? {} : { featuredReason: value.featuredReason }), ...(value.sensitivity === undefined ? {} : { sensitivity: value.sensitivity })
  };
  return record;
}
export function checkedPublicRecord(value: unknown): ArchiveRecord { const record = publicRecord(value); check(isPublicRecord(record), 400, "NOT_PUBLIC", "공개 조건을 충족하지 않는 기록입니다."); return record; }
