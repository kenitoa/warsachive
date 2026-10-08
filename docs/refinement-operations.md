# 고도화 API 운영 인수

기존 API/SQLite/worker/서명 정적 발행을 유지하고 운영 상태와 증거를 추가했다. 로컬 테스트 공급자·서명 fixture 결과를 실제 기관 계약, 역사 전문가 검수, 직원 MFA 등록, 실결제, 알림 도달 또는 외부 배포 증거로 사용하지 않는다. 운영 데이터를 만들거나 기존 28개 원본 자료를 변경하지 않았다.

## 적용 순서와 복구

1. 현재 영속 DB와 비공개 근거 파일을 새 경로의 online bundle로 백업한다. 세션·MFA·발행·관측 키는 별도 비공개 백업과 접근 정책으로 관리한다.
2. 새로운 환경 설정을 검증하고 API와 worker를 같은 버전으로 배포한다. 서버 시작 시 007–011을 추가 적용한다. 이미 적용된 001–010의 내용과 체크섬은 변경하지 않는다.
3. 실제 담당자의 역할 및 명시적인 업무 범위를 운영자가 설정한다. production은 직원 MFA와 민감 작업의 10분 이내 재인증을 강제하므로 인증 앱 등록·로그인 복귀·소유권 이전·퇴직 절차를 확인한다.
4. CMS 지식 레지스트리, 별도 서명 export, 실제 CI build와 공개 URL 관측 도구를 연결한다. 외부 설정이 없는 기능은 출시 완료로 표시하지 않는다.
5. API health, 사용자·운영 페이지, 기존 자료와 파일, 발행 해시 및 공개 피드, 문의/주문 소유권을 확인한 뒤 인수한다.

스키마를 삭제하는 down migration은 제공하지 않는다. 이전 UI로 돌아갈 수 있지만 새 서버의 권한·배포 증거 규칙을 이전 서버로 되돌려 우회하지 않는다. 데이터 복구는 새 DB/새 private 디렉터리로만 한다.

```powershell
npm.cmd run db:backup-bundle --workspace api -- NEW_BUNDLE_DIRECTORY
npm.cmd run db:restore-bundle --workspace api -- TRUSTED_BUNDLE_DIRECTORY NEW_RESTORE_DIRECTORY
```

복구 명령의 `ARCHIVE_API_DB_PATH`는 최신 신뢰 원본 DB를 가리켜야 한다. 없는 DB를 자동 생성해 복구 원장으로 사용하지 않는다. 백업의 recovery_events가 현재 원장의 prefix인지 대조한 뒤 이후 보류·사용자 삭제·퇴직·역할/범위 취소를 재적용한다. 모든 복구 세션과 재설정 토큰을 폐기하고 대기 발행을 차단하며 과거 artifacts를 삭제한다. 정적 사이트·모바일 피드·캐시를 새 산출물로 다시 검증해야 한다. 최신 원장을 잃거나 백업에 보류 담당자가 없어 재적용할 수 없으면 더 최근의 신뢰 백업/원장 확보가 필요하고 자동 승인하지 않는다. 원본 DB와 파일은 보존한다.

## 환경 변수

실제 값은 저장소에 작성하지 않는다. 환경 변수의 상대 파일 경로는 저장소 루트 기준이며 운영에서는 절대 경로를 권장한다. CLI의 입력/출력 인수는 실행 디렉터리를 기준으로 해석한다. `npm --workspace` 명령은 `api/`에서 실행되므로 백업·복구·증거 파일 인수에는 절대 경로를 사용한다. Windows 기본 시작기는 별도 지정이 없으면 프로젝트의 `web/content/knowledge.json`을 읽기 전용 사전 검사 레지스트리로 연결한다.

| 키 | 계약 |
| --- | --- |
| `ARCHIVE_SECURITY_ENCRYPTION_KEY` | 별도 64자리 소문자 hex. 사용자별 TOTP 키를 AES-256-GCM으로 암호화한다. 안전 백업과 교체 계획이 필요하다. |
| `ARCHIVE_STAFF_MFA_REQUIRED` | 개발에서 선택. production은 항상 직원 MFA를 요구한다. |
| `ARCHIVE_RECENT_REAUTH_REQUIRED` | 개발에서 선택. production은 민감 변경에 10분 이내 재인증을 요구한다. |
| `ARCHIVE_KNOWLEDGE_FILE` | production 필수. 읽기 전용 지식 registry JSON 파일. 출처/언어판의 승인 결속을 검사한다. |
| `ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET` | 별도 32자 이상. 실제 관측한 CI/배포/피드 증거 HMAC을 검증한다. |
| `ARCHIVE_NOTIFICATION_RECEIPT_SECRET` | 별도 32자 이상. 실제 알림 수신 공급자 콜백의 HMAC을 검증한다. |
| `ARCHIVE_FILE_SCAN_SECRET` | 별도 32자 이상. 실제 보안 검사 결과 HMAC을 검증한다. |
| `ARCHIVE_PRODUCTS_JSON` | 기존 서버 가격 계약 유지. optional serviceDefinition과 실결제 시 필수 이행 조건을 추가한다. |
| `ARCHIVE_PAYMENT_LIVE_ENABLED` | true면 모든 상품의 설명·대상·납품·권리·납기·지원 정책을 요구한다. 기존 실제 Stripe 운영 gate도 그대로 적용한다. |

세션·발행·MFA·배포·알림·파일 검사 비밀값은 모두 서로 달라야 한다. AI 공급자의 모델/평가 artifact 설정은 별도 AI 운영 문서를 따른다. 비밀값은 공개 Next 환경 변수나 URL·로그에 넣지 않는다.

## 새 경로와 변경 계약

모든 일반 JSON 응답은 `{data,error,meta}` envelope를 유지한다. 모든 브라우저 변경 요청은 cookie/CSRF/허용 origin을 검증한다. 공급자 수신 두 경로만 별도 HMAC 서명으로 검증하며 unsigned 요청은 거절한다. 관리자 UI의 숨김 여부와 관계없이 서버가 권한을 검사한다.

| 경로 | 목적·입력 |
| --- | --- |
| GET `/auth/mfa` | enabled/enrollmentAvailable/required/recentAuthenticated/mfaVerified 상태 |
| POST `/auth/mfa/enroll` | `{password}` → `{secret,uri}`. 실제 등록 요청. 이미 확인한 키를 자동 교체하지 않는다. |
| POST `/auth/mfa/confirm`, `/auth/mfa/challenge` | `{code}`. 6자리·30초, 전후 한 구간 허용, 사용자 전체 코드 재사용 방지 |
| POST `/auth/reauth` | `{password,totp?}`. MFA 등록자는 현재 TOTP도 요구한다. |
| GET/PUT `/admin/users/:id/scopes` | security:manage, PUT `{scopes}`. 명시 범위로 대체하고 대상 세션 폐기 |
| POST `/admin/users/:id/offboard` | security:manage, 소유권/마지막 관리자 보호 후 접근 폐기·감사 |
| GET `/operations/assignees` | operations:manage. 활성 직원 ID/name/role/scopes만 제공 |
| GET `/operations/workboard` | 본인의 범위에 해당하는 draft/correction/job/rights/order/refund/service-request |
| PUT `/operations/workboard/:kind/:id` | `{version,assigneeId,priority,dueAt,nextAction}`. 해당 업무 범위가 있는 실제 직원에게만 배정 |
| GET `/operations/metrics` | analytics:read. 기존 `/health/metrics`와 동일 지표 |
| GET `/cms/drafts/:id/preflight` | content:read. revision/contentHash/registryHash/ready/issues/impact |
| GET `/cms/drafts/:id/publication` | content:read. export/build/deploy/feed 단계의 불변 증거 |
| PUT `/spaces/:id/tasks/:taskId` | 소유자/교사 `{version,...기존 과제 필드,...교사 비공개 필드}` |
| GET `/spaces/:id/submissions/:id/history` | 담당 교사와 해당 학생만 immutable 제출/피드백 버전 조회 |
| GET/PUT `/payments/orders/:id/fulfillment` | 고객/finance:read 조회, finance:manage 변경 `{version,status,deliveryNote,deliveryUrl?}` |
| POST `/payments/orders/:id/fulfillment/confirm` | 고객 본인 `{version}`. 실제 delivered 이후만 확인 |
| GET/POST `/service-requests`, GET/PUT `/service-requests/:id` | 본인 문의 조회/접수, finance 범위의 견적·계약·이행 처리 |
| POST `/notifications/receipts` | 서명된 실제 delivered/failed 공급자 수신 증거 |
| POST `/operations/file-scan-receipts` | 서명된 실제 clean/rejected 검사 증거 |

표의 API prefix는 `/api/v1`이다. 각 범위는 content:read/write/review/publish, finance:read/manage, operations:manage, security:manage, rights:manage, analytics:read 중 하나이다. 기존 역할은 기존 업무 범위를 유지하지만 명시적인 scopes가 있으면 목록으로 대체한다. finance 권한만 있는 직원은 편집/파일/내부 AI를 이용할 수 없다. 역할 변경은 기존 명시 범위를 새 역할 범위와 교집합으로 줄인다. 내부 AI는 content:write 또는 content:review와 직원 MFA가 필요하다.

직원의 전체 기관 문의 조회(finance:read), 전체 정정 제안·연락처 조회(content:read), 정정 검토 상태 변경도 직원 MFA 경계를 통과해야 한다. 일반 회원의 본인 문의·제안 목록과 익명의 접수 상태 확인에는 직원 인증 조건을 적용하지 않는다.

## 교육 자료와 정정

과제 POST/PUT에는 `teacherNotes/answerKey`(각 10,000자), `readingMetadata`(최대 100개 `{recordId,minutes:1..1440,sourceKind,limitations}`)를 추가했다. 학생 응답에는 교사용 필드 자체가 없고 알려진 교사용 키는 study payload에서도 재귀적으로 제외한다. 과제의 version/createdAt/updatedAt, 제출의 taskVersion/submissionVersion/createdAt/updatedAt, 피드백의 feedbackVersion/feedbackSubmissionVersion/feedbackAt을 반환한다. 재제출하면 현재 피드백은 비우고 이전 버전 기록을 보존한다. 이전 마이그레이션 전에 저장하지 않은 버전은 복원했다고 표시하지 않는다.

정정 accepted는 검토 수락이다. resolved 변경에는 `{status:'resolved',note,revision,publicationId,closureEvidence}`가 필요하며 현재 공개 자료 해시와 실제 deploy/feed 증거가 일치해야 한다. 보류·다른 버전·존재하지 않는 publicationId는 거절한다. 익명 접수 조회에는 개인정보/내부 운영 메모를 제공하지 않는다.

## 발행·배포 증거

지식 preflight는 `registry.sources`의 ID/title/url/creator/kind/provenanceGroup을 실제 기록 출처와 대조하고 언어판의 sourceIdentity 제목/요약을 검사한다. 연관 항목과 삭제될 출처 연결을 영향 목록으로 보여 준다. production의 registry 미설정은 시작 오류다. 설정된 개발과 production에서는 출처 대조·승인·발행·worker에 검사를 적용한다. 승인 이후 registryHash가 바뀌면 발행을 막는다.

export 증거는 서명된 실제 파일이 원자적으로 생성된 뒤 기록한다. 다음 명령은 별도 관측 도구가 만든 증거만 수입한다.

011은 기존 `publication_stages`와 `correction_closures` 행을 변경하거나 삭제하지 않고 릴리스별 증거/정정 종결 테이블과 통합 조회 view를 추가한다. 같은 승인 버전과 산출물을 다른 커밋 SHA로 재배포해도 각 릴리스의 build/deploy/feed를 별도로 보존한다. 수입 중 이전 단계는 해당 SHA와 산출물 해시로 선택하므로 여러 릴리스의 관측이 섞여 도착해도 서로의 단계를 대신하지 않는다. 기존 export 및 007 형식 배포 증거·정정 외래 키는 그대로 호환된다. API/worker를 함께 업데이트하며 011 이후의 증거를 읽지 못하는 이전 서버로 직접 되돌리지 않는다.

기록 상세 HTML에는 서명 검증을 통과한 실제 승인 정보가 있을 때만 `data-archive-publication="approved"`, 기록 ID, public projection의 SHA256, 승인 revision을 article 속성으로 렌더한다. 기기 빌드 번호나 수정 시각을 승인 revision으로 추측하지 않는다. 출처 대조 상태의 4개 기록과 보류 안내에는 이 표식이 없다. build/deploy 관측은 catalog/shard뿐 아니라 실제 HTML article의 ID·hash·revision도 대조하므로 최신 feed와 구형 상세 페이지가 섞인 배포, 빈 페이지, 보류 안내를 현재 승인 배포로 기록하지 않는다. script/RSC 문자열·HTML 주석에 있는 표식은 인정하지 않는다.

`npm run test:withdrawal`은 임시 파일에만 사람이 승인한 것처럼 구성한 명시적 테스트 fixture 1개(revision 7·테스트 SHA·`.example.invalid` HTTPS 주소)를 넣어 실제 Next 빌드와 build 관측 CLI의 긍정 경로를 확인한다. 서명 결과와 실제 article 표식, 나머지 사람 검수 전 기록의 표식 부재를 검사한 다음 기존 전체 보류 회귀를 실행한다. 성공/실패와 관계없이 finally에서 정상 preview 4173 산출물을 재빌드한다. production 설정과 `GITHUB_ACTIONS=true`는 자식 프로세스의 CI 형식 fixture를 위한 것이며 실제 CI 실행·사람 승인·공개 배포·외부 공급자 검증을 뜻하지 않는다.

```powershell
node --experimental-strip-types api/src/cli.ts deployment-evidence SIGNED_OBSERVATION_JSON
```

파일 body는 `{version:1,observedAt,entries:[{recordId,revision,contentHash,stage,commitSha,artifactHash,url}]}`이고 마지막 `signature`는 위 body JSON의 HMAC-SHA256이다. export→build→deploy→feed 순서, 현재 승인된 공개 자료와 해시·revision, 최근 30분 실측, HTTPS 허용 origin, SHA40/64를 대조한다. build/deploy/feed는 같은 커밋 SHA와 공개 채널 artifactHash가 일치해야 한다. export 파일 해시는 별도 형식이므로 build의 채널 해시와 같은 것으로 취급하지 않는다. 같은 증거 재수입은 중복 행을 만들지 않는다. 이 명령은 사이트를 배포하지 않는다.

## 권리와 비공개 파일

권리 `permissions`는 display/download/teaching/commercial/translation/adaptation, `territory`, `startsAt/expiresAt`, `attribution`, 같은 record/source의 `documentId`를 받는다. 상세 허가 granted에는 검사된 실제 문서와 지역·표기가 필요하다. 계약의 requiredRightsIds/requiredPermissions/territory를 모두 지정하면 각 대상 허가·기간·지역·문서 clean 상태를 확인한다. 철회/만료/검사 차단은 계약 준비 상태를 무효화한다. 기존 미지정 계약은 legacy-unspecified이며 새 실제 기관 서비스 계약으로 사용하지 않는다.

첨부 metadata는 `scanStatus:'unknown'|'clean'|'rejected'`, `scanner:string|null`, `scannedAt:string|null`, 동일 의미의 `scanObservedAt:string|null`을 반환한다. 신규 업로드는 unknown/null이며 검사 완료를 발명하지 않는다. 실제 검사기 연동은 다음 body와 `X-Archive-Signature`의 HMAC으로 전달한다.

```json
{"version":1,"attachmentId":"실제-ID","sha256":"실제-64자리-hash","status":"clean","scanner":"실제-검사기","observedAt":"실제-UTC-시각"}
```

본문 형식을 설명하는 예시이며 운영 증거가 아니다. 최근 5분·파일 hash·상태 순서를 검증한다. rejected는 다운로드 차단하며 clean이어도 공개 media로 자동 발행하지 않는다. 실제 검사기, 격리 및 운영 대응 설정은 별도 인수 조건이다.

## 상품·기관 문의·알림

상품 optional `serviceDefinition={description,audience,deliverables,rightsStatement,deliveryDays,supportPolicy}`와 실제 서버 가격을 사용한다. 문의 POST는 `{title,audience,deliverables,rights,deadline?}`이고 초기 상태는 received이다. PUT는 `{version,status,assignedTo?,dueAt?,quoteNote?,contractId?,orderId?,evidence?}`다. qualified→quoted는 실제 견적 설명, contracted는 범위 검증된 활성 계약과 문의 고객 주문, fulfilling은 서버 결제 확인이 필요하다. delivered는 주문의 납품, closed는 고객 확인과 이행 근거를 요구한다. 고객과 직원 목록을 서버에서 분리하며 타인의 문의 ID 조회를 거절한다. 문의 담당자는 현재 활성 상태이며 finance:manage 범위가 있는 직원만 선택할 수 있다. 담당자의 범위가 취소되면 새 담당자를 지정하거나 배정을 해제해야 다음 단계를 처리할 수 있다.

주문 fulfillment는 paymentStatus와 독립적이다. 고객이 보낸 결제 완료를 신뢰하지 않고 verified provider 상태 이후에 이행한다. 환불/부분 환불의 기존 서버 잔액·예약·멱등성 규칙은 유지한다. 실제 가격·외부 결제·기관 계약·납품 내용은 임의로 만들지 않았다.

알림은 supplier ACK 후 accepted이며 job completed는 발송 작업 처리 종료다. payload에는 providerAccepted만 남긴다. 실제 delivered/failed 콜백 body는 `{version:1,eventId,jobId,status,observedAt}`와 별도 HMAC 헤더다. 완료 이후 역순 상태를 거절하고 동일 eventId의 반복 결과를 검증한다. 접수 전 콜백은 공급자가 재시도해야 한다. 일반 알림은 24시간, 재설정 안내는 토큰 기한에 수신 증거가 없으면 expired가 된다. 비밀번호 안내 주소·연락처는 완료/폐기 시 저장하지 않는다.

## 지표·검증·미검증 경계

API 지표는 UTC 5분 버킷을 SQLite에 7일 보관하고 24시간의 requests/serverErrors/errorRate/latencyMs를 반환한다. p50/p95/p99는 histogram upper bound 근사이며 최대 버킷 overflow는 null과 overflowCount로 표시한다. 기본 비교 목표는 가용성 99.5%, p95 1초이고 100요청 미만은 SLO 충족 여부 null이다. productionEvidence:false로 실제 운영 부하를 증명하지 않음을 명시한다. 질문 원문·결제 카드·토큰·연락처는 지표에 저장하지 않는다.

`api/tests/refinement.test.ts`는 실제 HTTP와 SQLite에서 MFA/CSRF/범위 폐기/교사용 자료 제외/불변 피드백/지식 변경/배포 순서/정정 종결/수신·검사 서명/서비스 이행/철회 후 bundle 복구를 검증한다. 기존 계정·원본 자료·SQL 영속성·외부 어댑터 fixture 회귀도 유지한다. 실제 전문 검수, 직원 기기 등록과 분실 복구 훈련, 악성 파일 검사기 운영, Stripe sandbox/live, AI 실제 평가, 알림 공급자 실제 전달, Linux Docker/TLS/volume 및 외부 CI 배포는 별도 증거가 필요하다.
