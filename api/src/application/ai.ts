import type { Adapters, AiAnswer } from "../adapters/contracts.ts";
import { randomUUID } from 'node:crypto';
import type { ApiConfig } from "../config.ts";
import { check } from "../domain/errors.ts";
import { object, text, ids } from "../domain/validation.ts";
import { Store,hash } from "../infrastructure/database.ts";
import { requireUser,type User } from "./auth.ts";
import { permissions } from '../domain/permissions.ts';
import { EditorialService } from "./editorial.ts";

export class AiService {
  readonly store: Store; readonly adapters: Adapters; readonly config: ApiConfig; readonly editorial: EditorialService;
  constructor(store: Store, adapters: Adapters, config: ApiConfig, editorial: EditorialService) { this.store = store; this.adapters = adapters; this.config = config; this.editorial = editorial; }
  async answer(user: User | null, value: unknown, requestId: string): Promise<AiAnswer> {
    const account = requireUser(user); const input = object(value);
    check(input.mode === "answer" || input.mode === "assist", 400, "INVALID_INPUT", "AI 작업 유형을 확인해 주세요.");
    check(this.adapters.ai.enabled && (input.mode === "assist" || this.adapters.ai.publicEnabled !== false), 503, "AI_DISABLED", "AI 작업의 출시 조건이 아직 충족되지 않았습니다.");
    if(input.mode==='answer'&&this.adapters.ai.evaluationContentHash) check(hash(JSON.stringify(this.editorial.publicRecords()))===this.adapters.ai.evaluationContentHash,503,'AI_EVALUATION_STALE','공개 기록이 변경되어 AI 출시 평가를 다시 확인해야 합니다.');
    if(input.mode==='assist')check(permissions(account).some(scope=>['content:write','content:review'].includes(scope)),403,'FORBIDDEN','편집·검수 범위의 권한이 필요합니다.');
    const recordIds = ids(input.recordIds); check(recordIds.length > 0 && recordIds.length <= 8, 400, "INVALID_INPUT", "1~8개 공개 기록을 선택해 주세요.");
    const records = this.editorial.publicRecordsByIds(recordIds); check(records.length === recordIds.length, 404, "RESOURCE_NOT_FOUND", "선택한 공개 기록을 찾을 수 없습니다.");
    const question = text(input.question, "질문", 2000); const date = new Date().toISOString().slice(0, 10);
    // Reserve before awaiting a supplier. Failed/unknown outcomes retain the reservation.
    this.store.transaction(() => {
      this.store.run("INSERT OR IGNORE INTO ai_daily_usage VALUES (?,0,0,0)", date);
      check(this.store.run("UPDATE ai_daily_usage SET reserved_calls=reserved_calls+1 WHERE date=? AND reserved_calls<?", date, this.config.aiDailyRequestLimit) === 1, 429, "AI_DAILY_LIMIT", "오늘의 서비스 AI 요청 한도에 도달했습니다. UTC 기준 다음 날 다시 이용해 주세요.");
    });
    try {
      const answer = await this.adapters.ai.answer({ question, records, mode: input.mode });
      if (answer.usage) {
        const { inputTokens, outputTokens } = answer.usage;
        check(Number.isSafeInteger(inputTokens) && inputTokens >= 0 && Number.isSafeInteger(outputTokens) && outputTokens >= 0 && inputTokens <= 1000000 && outputTokens <= 1000000, 502, "AI_USAGE_INVALID", "AI 사용량을 확인하지 못했습니다.");
        this.store.run("UPDATE ai_daily_usage SET input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE date=?", inputTokens, outputTokens, date);
      }
      check(answer.citations.every((citation) => records.some((record) => record.id === citation.recordId && record.sections.some((section) => section.id === citation.sectionId))), 502, "AI_CITATION_INVALID", "답변 근거를 확인하지 못했습니다.");
      const citationDetails=answer.citations.map(citation=>{const record=records.find(record=>record.id===citation.recordId)!;const section=record.sections.find(section=>section.id===citation.sectionId)!;return {recordId:record.id,sectionId:section.id,recordVersion:record.updatedAt,contentHash:hash(JSON.stringify(record)),excerpt:section.paragraphs.join('\n'),sourceIds:[...section.sourceIds]};});
      const answerId=randomUUID();this.store.audit(account.id, "ai.answer", answerId, requestId); return {...answer,answerId,citationDetails,...this.adapters.ai.evaluationId?{evaluationId:this.adapters.ai.evaluationId}:{}};
    } catch (error) { this.store.audit(account.id, "ai.answer", null, requestId, "failed"); throw error; }
  }
}
