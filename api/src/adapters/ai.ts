import type { AdapterEnvironment, AiAdapter } from "./contracts.ts";
import { disabledAdapters } from "./contracts.ts";
import { isArchiveRecord, isPublicRecord } from "../../../web/lib/archive-domain.ts";
import { boundedInteger, object, required, providerRequest, ProviderError } from "./provider-http.ts";
import { archiveAiInstructions, archiveAiPromptHash, loadAiEvaluation } from "./ai-evaluation.ts";

export function createAiAdapter(env: AdapterEnvironment, fetcher: typeof fetch = fetch, evaluationRun = false): AiAdapter {
  if (env.ARCHIVE_AI_ENABLED !== "true") return disabledAdapters().ai;
  const secret = required(env.OPENAI_API_KEY, "OPENAI_API_KEY"); const model = required(env.ARCHIVE_AI_MODEL, "ARCHIVE_AI_MODEL");
  const maxTokens = boundedInteger(env.ARCHIVE_AI_MAX_OUTPUT_TOKENS, 1200, 128, 4096);
  const evaluation = evaluationRun ? null : loadAiEvaluation(env, model);
  const evaluated = evaluationRun || Boolean(evaluation);
  return { enabled: true, get publicEnabled() { return evaluated && (!evaluation || Date.parse(evaluation.expiresAt) > Date.now()); }, ...(evaluation ? { evaluationContentHash: evaluation.contentHash, evaluationId: evaluation.id } : {}), promptHash: archiveAiPromptHash, async answer(input) {
    if (input.mode === "answer" && (!evaluated || (evaluation && Date.parse(evaluation.expiresAt) <= Date.now()))) throw new ProviderError("CONFIGURATION", "Public AI evaluation has not been approved or has expired.");
    if (!input.question.trim() || input.question.length > 2000 || input.records.length > 8 || !input.records.every(record => isArchiveRecord(record) && isPublicRecord(record))) throw new ProviderError("CONFIGURATION", "AI input exceeds the public evidence boundary.");
    const passages = input.records.flatMap(record => record.sections.map(section => ({ recordId: record.id, sectionId: section.id, title: record.title, interpretation: Boolean(section.interpretation), text: section.paragraphs.join("\n"), sourceIds: section.sourceIds, limitations: record.limitations })));
    if (!passages.length) return { text: "확인된 공개 자료에서 답변 근거를 찾지 못했습니다.", citations: [] };
    if (JSON.stringify(passages).length > 32_000) throw new ProviderError("CONFIGURATION", "Evidence exceeds the request budget.");
    const schema = { type: "object", properties: { abstained: { type: "boolean" }, text: { type: "string" }, citations: { type: "array", items: { type: "object", properties: { recordId: { type: "string" }, sectionId: { type: "string" } }, required: ["recordId", "sectionId"], additionalProperties: false } } }, required: ["abstained", "text", "citations"], additionalProperties: false };
    const instructions = archiveAiInstructions;
    const response = await providerRequest("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, store: false, max_output_tokens: maxTokens, instructions, input: JSON.stringify({ mode: input.mode, question: input.question, evidence: passages }), text: { format: { type: "json_schema", name: "archive_evidence_answer", strict: true, schema } } }) }, fetcher);
    if (!object(response) || response.status !== "completed" || !Array.isArray(response.output)) throw new ProviderError("INVALID_RESPONSE", "AI did not complete a usable answer.");
    const texts: string[] = [];
    for (const output of response.output) if (object(output) && output.type === "message" && Array.isArray(output.content)) for (const content of output.content) {
      if (object(content) && content.type === "refusal") throw new ProviderError("UNAVAILABLE", "AI could not answer this request.");
      if (object(content) && content.type === "output_text" && typeof content.text === "string") texts.push(content.text);
    }
    let result: unknown; try { result = JSON.parse(texts.join("")); } catch { throw new ProviderError("INVALID_RESPONSE", "AI response format is invalid."); }
    if (!object(result) || typeof result.abstained !== "boolean" || typeof result.text !== "string" || !result.text.trim() || result.text.length > 12_000 || !Array.isArray(result.citations) || result.citations.length > 32) throw new ProviderError("INVALID_RESPONSE", "AI answer is invalid.");
    const citations: { recordId: string; sectionId: string }[] = [];
    for (const citation of result.citations) {
      if (!object(citation) || typeof citation.recordId !== "string" || typeof citation.sectionId !== "string" || !passages.some(passage => passage.recordId === citation.recordId && passage.sectionId === citation.sectionId)) throw new ProviderError("INVALID_RESPONSE", "AI cited evidence outside the supplied scope.");
      if (!citations.some(item => item.recordId === citation.recordId && item.sectionId === citation.sectionId)) citations.push({ recordId: citation.recordId, sectionId: citation.sectionId });
    }
    if (!result.abstained && !citations.length) throw new ProviderError("INVALID_RESPONSE", "An answer without evidence cannot be published.");
    const usage = object(response.usage) && Number.isSafeInteger(response.usage.input_tokens) && Number.isSafeInteger(response.usage.output_tokens) ? { inputTokens: Number(response.usage.input_tokens), outputTokens: Number(response.usage.output_tokens) } : undefined;
    if (result.abstained) return { text: "확인된 공개 자료로는 질문에 답할 근거가 부족합니다. 아카이브 검색과 원문 확인으로 추가 자료를 찾아보세요.", citations: [], model, usage };
    return { text: input.mode === "assist" ? `검수 전 편집 보조\n${result.text}` : result.text, citations, model, usage };
  } };
}
