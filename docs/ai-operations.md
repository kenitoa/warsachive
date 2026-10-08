# AI 공개 답변 평가와 활성화

내부 편집 보조는 실제 `content:write` 또는 `content:review` 업무 범위가 있는 직원과 필요한 추가 인증에만 제공한다. 공개 답변은 단순 `ARCHIVE_AI_EVALUATION_APPROVED=true`로 활성화되지 않는다. API 키·활성 설정·모델과 별도로 현재 공개 자료/프롬프트/모델을 검수한 서명 평가 파일이 필요하다.

## 실제 평가 절차

`.env.api`에 공급자 설정을 넣되 커밋하거나 공개 브라우저 변수에 넣지 않는다. 모델명은 운영자가 실제 사용 가능한 모델로 설정한다. 비용이 발생하는 다음 명령은 수동으로만 실행한다. CI와 HTTP 요청 경로는 평가 모드를 켜지 않는다.

```bash
npm run ai:evaluate -- web/content/ai-evaluation.json <new-private-report.json>
npm run ai:approve -- <private-report.json> <private-human-review.json> <new-signed-evaluation.json>
```

평가 데이터는 사실 질문·대답을 보류해야 하는 질문·프롬프트 주입 총 9개 사례와 실제 자료 ID/문단을 포함한다. CLI는 모든 사례를 요청 전에 검증하고, 실제 공급자 응답·사용 토큰·지연을 기록한다. 자동 검사는 인용/기권 형식만 확인한다. 사실 정확성·해석·한계는 사람이 모든 사례를 읽고 승인해야 한다. 자동 합격을 사람 승인으로 전환하지 않는다.

사람 검토 파일은 `{version:1,reviewerId,humanReviewed:true,reportHash,maxInputTokens,maxOutputTokens,decisions:[{id,approved:true,reason}]}` 형식이다. `reportHash`는 보고서 JSON 원문을 읽어 JSON.stringify한 값의 SHA256이다. 각 사례에 구체적 사유가 필요하고 실패 사례/예산 초과/사용량 미확인/오래된 보고서는 거절한다. 파일에 개인정보·자격증명이나 개인 질문을 넣지 않는다.

`ARCHIVE_AI_EVALUATION_FILE`은 서버의 비공개 평가 파일 절대 경로, `ARCHIVE_AI_EVALUATION_SECRET`은 다른 목적과 분리된 32자 이상 키다. 파일은 일반 파일이어야 하며 심볼릭 링크·추가 필드·변조·모델/프롬프트 불일치·만료를 거절한다. 승인은 최대 30일이며 재시작 후 새 파일을 읽는다. 실행 중에도 만료 후 공개 요청을 거절한다. 공개 기록의 본문/버전이 바뀌면 현재 자료 해시 불일치로 재평가를 요구한다.

## 인용과 운영

서버는 선택된 공개 기록에서만 근거 문단·자료 버전·해시·출처 ID를 생성한다. 공급자의 임의 문단 텍스트를 인용 증거로 신뢰하지 않는다. 답변 ID를 감사에 기록하고 질문 원문·개인 메모·비공개 초안을 로그에 보관하지 않는다. 사용자별 한도와 SQLite에 저장한 일일 예약 예산을 적용하며 기권에도 실제 토큰을 집계한다. 사용자가 직접 동의해 답변 문제를 정정 제안으로 보낼 수 있다.

검증은 [OpenAI 평가 지침](https://developers.openai.com/api/docs/guides/evaluation-best-practices)의 변경 시 재평가 원칙을 적용했다. 이번 작업은 실제 유료 공급자 요청이나 사람 평가 승인을 수행하지 않았다. 실제 평가·토큰 비용·정확성 결과가 확인되기 전에는 공개 답변이 비활성 상태다.
