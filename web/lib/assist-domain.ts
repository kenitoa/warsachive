import { apiItems, apiObject, apiString, decodeAiResponse, type AiResponse } from "./api-client.ts";
export type AiCitationDetail = { recordId: string; sectionId: string; recordVersion: string; contentHash: string; excerpt: string; sourceIds: string[] };
export type DetailedAiResponse = AiResponse & { model: string; evaluationId: string; answerId: string; citationDetails: AiCitationDetail[] };
export function decodeDetailedAiResponse(value: unknown): DetailedAiResponse {
  const item = apiObject(value); const answer = decodeAiResponse(value);
  const details = apiItems(item.citationDetails ?? []).map(value => { const detail = apiObject(value); const contentHash = apiString(detail.contentHash, 64); if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("답변의 자료 버전을 확인할 수 없습니다."); return { recordId: apiString(detail.recordId, 100), sectionId: apiString(detail.sectionId, 100), recordVersion: apiString(detail.recordVersion, 100), contentHash, excerpt: apiString(detail.excerpt, 100000), sourceIds: apiItems(detail.sourceIds).map(value => apiString(value, 100)) }; });
  if (details.length !== answer.citations.length || answer.citations.some(citation => !details.some(detail => detail.recordId === citation.recordId && detail.sectionId === citation.sectionId)) || new Set(details.map(detail => `${detail.recordId}:${detail.sectionId}`)).size !== details.length) throw new Error("답변에 연결된 원문 문단과 버전을 확인할 수 없습니다.");
  return { ...answer, model: typeof item.model === "string" ? apiString(item.model, 200) : "", evaluationId: typeof item.evaluationId === "string" ? apiString(item.evaluationId, 100) : "", answerId: typeof item.answerId === "string" ? apiString(item.answerId, 100) : "", citationDetails: details };
}
