import type { ArchiveRecord } from "./archive-types";
export type PublicationApproval = { recordId: string; revision: number; contentHash: string; reviewerId: string; approvedAt: string };
export type Publication = { items: ArchiveRecord[]; approvals: PublicationApproval[]; withheldIds: string[]; generatedAt: string };
export function validatePublication(value: unknown, secret: string | undefined): Publication;
export function readSignedPublication(path: string | undefined, secret: string | undefined): Publication;
export function applyPublication(records: ArchiveRecord[], publication: Publication): ArchiveRecord[];
