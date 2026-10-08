import "server-only";
import knowledgePayload from "../content/knowledge.json";
import { archiveEvents } from "./archive-data";
import { getRecordKnowledge, parseKnowledgeRegistry, projectPublicKnowledge } from "./knowledge-domain";
import { verifiedCoordinates } from "./knowledge-reading";

/** The raw registry includes translation drafts and must stay on the server. */
export const knowledgeRegistry = parseKnowledgeRegistry(knowledgePayload);
export const publicKnowledge = parseKnowledgeRegistry(projectPublicKnowledge(knowledgeRegistry, archiveEvents), archiveEvents);
export function getKnowledgeForRecord(recordId: string) { return getRecordKnowledge(publicKnowledge, recordId); }
export function knowledgeSummary() {
  return { records: publicKnowledge.recordLinks.length, entities: publicKnowledge.entities.length,
    sources: publicKnowledge.sources.length, materials: publicKnowledge.materials.length,
    editions: publicKnowledge.editions.length, claims: publicKnowledge.claims.length,
    humanApprovedItems: publicKnowledge.claims.filter(claim => claim.review.status === "approved" && claim.review.humanReviewed).length,
    verifiedCoordinates: verifiedCoordinates(publicKnowledge.locations, publicKnowledge.sources).length,
    publishedLocales: [...new Set(publicKnowledge.localizations.map(locale => locale.locale))] };
}
