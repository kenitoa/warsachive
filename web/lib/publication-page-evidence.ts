import { createHash } from "node:crypto";
import { publicRecord } from "../../api/src/domain/archive.ts";
import { isPublicRecord } from "./archive-domain.ts";
import type { ArchiveRecord } from "./archive-types.ts";
import type { Publication } from "./publication-import.mjs";

export type PublicationPageEvidence = { recordId: string; revision: number; contentHash: string };
/** Called only after the signed publication has been verified by the server loader. */
export function approvedPageEvidence(record: ArchiveRecord, publication: Pick<Publication, "approvals" | "withheldIds">): PublicationPageEvidence | null {
  if (!isPublicRecord(record) || record.review.status !== "approved" || record.review.humanReviewed !== true || publication.withheldIds.includes(record.id)) return null;
  const approval = publication.approvals.find(item => item.recordId === record.id);
  if (!approval) return null;
  const contentHash = createHash("sha256").update(JSON.stringify(publicRecord(record))).digest("hex");
  if (!Number.isSafeInteger(approval.revision) || approval.revision < 1 || approval.contentHash !== contentHash) throw new Error("The approved page does not match its signed public record revision.");
  return { recordId: record.id, revision: approval.revision, contentHash };
}
