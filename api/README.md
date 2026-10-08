# Archive API

Node 22.22.3의 HTTP·SQLite·crypto를 사용하는 운영 API입니다. 기존 정적 웹·수집 원본은 보존하며 DB에 seed·기본 계정을 만들지 않습니다. Domain/Application/Infrastructure/HTTP를 분리합니다.

## 실행과 설정

루트 npm workspace에서 start/worker/lint/typecheck/test/build를 `--workspace @war-archive/api`로 실행합니다. workspace 실행 명령은 루트의 .env.api를 선택적으로 읽습니다. 실제 환경 파일은 커밋하지 않습니다. 기본 API는 http://127.0.0.1:4200입니다. 운영에서는 TLS reverse proxy와 같은 사이트의 웹/API 도메인을 구성해야 합니다. 세션은 HttpOnly·SameSite=Strict이며 운영에서 Secure를 요구합니다. 별도 worker를 실행할 때 ARCHIVE_API_INLINE_WORKER=false를 설정합니다.

로컬 시작기가 API·worker를 직접 Node 자식으로 열고 IPC 채널을 연결하면 `archive-local-shutdown` 메시지와 부모 채널 disconnect로 정상 종료를 요청할 수 있습니다. HTTP에는 이 종료 동작을 제공하지 않습니다. API는 진행 요청/작업을 정리한 뒤 SQLite를 닫고 worker는 진행 작업을 마친 뒤 닫습니다. IPC가 없는 컨테이너·CLI 실행은 SIGINT/SIGTERM을 사용합니다.

설정은 ARCHIVE_API_HOST/PORT/DB_PATH/ALLOWED_ORIGINS/SESSION_SECRET/SECURE_COOKIES/PUBLIC_URL/EXPORT_DIR/INLINE_WORKER, ARCHIVE_PUBLICATION_SECRET, ARCHIVE_PASSWORD_RESET_ENABLED, ARCHIVE_PRODUCTS_JSON, ARCHIVE_AI_DAILY_REQUEST_LIMIT입니다. DB·export의 기본값 및 명시적 상대 경로는 실행 cwd와 관계없이 저장소 루트를 기준으로 계산합니다. CLI 파일 인수는 절대 경로를 권합니다. 운영 origin은 HTTPS이며 세션·발행 비밀값은 각각 32자 이상으로 분리합니다.

ARCHIVE_API_PRIVATE_STORAGE_DIR은 비공개 검수 파일 저장소이며 기본 api/data/private입니다. 공개 web/public·web/out·발행 export 디렉터리와 분리합니다. CMS attachments는 직원만 업로드·조회할 수 있고 실제 기록/출처 관계를 확인합니다. raw PNG/JPEG/PDF 5MiB 제한, MIME/형식 확인, 랜덤 불변 파일명·sha256 무결성·강제 attachment 다운로드를 적용합니다. SVG/HTML/알 수 없는 파일은 거절하며 공개 export에 파일을 넣지 않습니다. 형식 검사는 악성 파일 검사를 대신하지 않습니다. 운영 악성 파일 검사와 권리 승인이 확보되기 전 공개 재사용 경로는 제공하지 않습니다. DB 백업과 별도로 이 디렉터리도 비공개 백업·보관해야 합니다.

최초 관리자 CLI admin에는 이메일과 표시 이름을 인수로, 비밀번호를 stdin 또는 일시적 ARCHIVE_BOOTSTRAP_PASSWORD 환경값으로 전달합니다. 비밀번호 인수와 기본 관리자 계정은 제공하지 않습니다. 최초 관리자 존재 시 bootstrap을 거절합니다. 이후 역할은 인증된 관리자 API로 관리합니다. import FILE은 공개 mobile-index.json의 version:1/records 계약을 관리자 권한으로 수입하며 source-checked·humanReviewed=false만 허용합니다.

ARCHIVE_API_STATIC_IMPORT_FILE을 명시하면 시작 시 해당 로컬 version:1/records snapshot을 동일한 공개 계약으로 수입합니다. 기본값은 미설정이며 원격 URL을 요청하지 않습니다. source-checked·humanReviewed=false 자료만 허용하고 계정이나 승인 이력을 만들지 않습니다. CMS 발행 기록과 보류 tombstone은 변경하지 않습니다. 승인된 CMS 자료가 포함된 혼합 feed는 이 초기 수입 용도로 사용할 수 없으며, 기존 출처 확인 자료만 포함한 파일을 운영자가 지정해야 합니다. 파일 오류는 HTTP 서버를 열기 전에 실패합니다.

## 요청 계약

GET /api/v1/auth/session을 먼저 호출해 csrfToken을 받습니다. 모든 변경 요청에는 허용 Origin, X-CSRF-Token과 쿠키가 필요합니다. register/login/logout/password change는 세션과 확인값을 회전합니다. Stripe 서명 webhook만 CSRF 예외입니다. 응답은 `{data,error,meta:{requestId}}`입니다. 내부 스택·공급자 비밀값을 응답이나 로그에 넣지 않습니다.

계정 내보내기는 본인의 서가·연구 프로젝트·제보·제출·주문·환불 요청·공동 공간 소속·소유 공간·검수 파일 메타데이터를 포함하며 비밀번호·세션·reset 토큰·공급자 결제 식별값·감사 원문·파일 저장 경로는 제외합니다. 파일 원문은 직원 권한이 유지될 때 개별 attachment API로 받습니다. 탈퇴는 개인 서가·프로젝트·본인 제출을 삭제하고 제보 연락처를 익명화합니다. 공동 소유권 이전을 먼저 요구하며 주문·편집·근거 파일·감사 기록은 정책에 따라 보존합니다. 보존 기간 확정은 운영 출시 조건입니다.

완료된 알림과 만료·최종 실패한 재설정 안내는 recipient/resetUrl을 폐기합니다. 토큰 교체·사용·비밀번호 변경·계정 탈퇴도 큐에 남은 안내를 폐기하며 수동 retry는 거절합니다. 새 안내를 요청해야 합니다. 이미 공급자에 전달 중인 메일을 취소할 수는 없지만 해당 토큰은 폐기되어 인증에 사용할 수 없습니다.

| 영역 | 경로 |
| --- | --- |
| 계정 | auth/session, register, login, logout, password/change, password/reset/request·complete, export, account |
| 관리자 | GET admin/users, PUT admin/users/:id/role |
| 개인 공간 | GET/PUT shelf, GET/POST workspaces, GET/PUT/DELETE workspaces/:id |
| 공동 공간 | spaces, :id/members, :id/invitations, join, :id/transfer, :id/tasks, :id/tasks/:taskId/submissions, :id/submissions/:submissionId/feedback |
| 정정 | corrections 실제 접수, :receiptId 공개 상태, 본인/직원 목록, :id/status 검수 |
| CMS | cms/drafts, :id/submit·source-check·approve·reject·withhold·publish·revisions·restore; cms/dashboard·import·export |
| 기관 | organizations·rights·contracts 목록/생성/현재 version을 통한 수정 |
| 작업 | GET jobs, POST jobs/:id/retry |
| 공개 | public/records SQL 페이지 목록과 :recordId 상세, capabilities |
| 결제 | payments/products·orders·orders/:id·orders/:id/refund-requests·orders/:id/refunds; 직원 refund-requests 목록/:id/reject; webhook/stripe |
| AI | ai/answer, mode=answer 또는 assist(직원) |
| 운영 | /health/live·ready, /health/metrics(관리자) |

표의 API 경로는 /api/v1/ 기준입니다. 개인/공동 저장은 현재 version을 검사하고 충돌 시 409 VERSION_CONFLICT를 반환합니다. 공동 owner/editor/viewer와 CMS 직원 역할은 별개입니다. 학습자는 본인 제출만 읽고 수정합니다. 교사 피드백은 해당 제출 version을 요구하며 재제출은 이전 피드백을 초기화합니다.

외부 결제·AI·알림은 실제 공급자 설정이 없으면 비활성입니다. 실제 이메일 전달을 수행하는 알림 수신 시스템을 검증한 뒤 비밀번호 재설정을 활성화해야 합니다. 단순 webhook 연결은 이메일 전달 검증을 대신하지 않습니다. 공개 AI는 별도 평가 gate를 요구합니다.

AI는 사용자당 10회/시간 및 서비스 전체 일일 요청 예산을 검사합니다. ARCHIVE_AI_DAILY_REQUEST_LIMIT은 기본 100이며 1~1,000,000 정수만 허용합니다. UTC 날짜별 SQLite 트랜잭션으로 외부 호출 전에 예약하고 실패·결과 불명도 예산을 소비합니다. 프로세스 재시작과 동시 호출로 예산을 우회할 수 없습니다. 질문 원문을 저장하지 않고 공급자가 반환한 토큰 사용량만 합산해 관리자 metrics에서 확인합니다. 이는 요청 수 상한이며 실제 요금의 고정 금액 보장은 아닙니다. 모델 단가와 출력 토큰 한도를 운영자가 검증해야 합니다.

## 승인과 공개 발행

다른 실제 검수자 계정이 현재 hash/version을 승인해야 합니다. 수정·이전 버전 복구는 승인을 무효화하고 revision payload를 보존합니다. publish는 멱등 작업을 생성하며 worker가 승인 hash를 다시 확인합니다. privateNotes·제보 연락처·개인 자료·임의 추가 필드는 공개 projection에서 제외합니다.

approved.json body는 version/generatedAt/contentHash/items/approvals/withheldIds입니다. items에는 실제 승인 후 발행한 CMS 기록만 포함합니다. payloadHash는 body JSON의 SHA256이며 publication.signature는 별도 발행 비밀값으로 payloadHash를 HMAC-SHA256 처리합니다. publication에 algorithm/payloadHash/signature를 기록합니다. 발행 당시 reviewerId·revision·hash·시각을 불변 evidence로 보존합니다. 보류 tombstone은 정적 재수입으로 다시 공개하지 않습니다.

파일 생성은 공개 배포 완료와 다릅니다. 운영자는 서명 파일을 검증한 전달 경로로 웹 빌드 환경에 전달하고 실제 배포 SHA·핵심 URL을 확인해야 합니다.

## 백업과 복구

CLI backup NEW_FILE은 온라인 SQLite backup API와 quick_check를 사용하며 기존 대상 파일을 덮어쓰지 않습니다. restore BACKUP NEW_DATABASE는 새 경로에만 복구·마이그레이션·무결성 검사를 실행하고 원본 운영 DB를 보존합니다. 서비스 중지 후 검증한 새 DB를 ARCHIVE_API_DB_PATH로 지정하고 재시작·readiness·실제 데이터를 확인합니다. check는 현재 DB 무결성을 검사합니다. 마이그레이션은 순서/checksum으로 기록하며 적용 파일 변경을 거절합니다.

근거 파일이 있으면 DB 단독 백업을 전체 복구본으로 사용하지 않습니다. `node --experimental-strip-types api/src/cli.ts backup-bundle NEW_DIRECTORY`는 온라인 DB snapshot에 실제 존재한 attachment 목록만 비공개 파일과 함께 복사·SHA256 확인하고 마지막에 manifest.json을 씁니다. `restore-bundle BUNDLE_DIRECTORY NEW_DIRECTORY`는 snapshot·manifest·각 파일 hash와 inode/실제 경로를 대조해 새 DB와 새 private 디렉터리로 복구합니다. 원본 및 기존 대상은 덮어쓰지 않습니다. 반환된 두 경로로 DB_PATH와 PRIVATE_STORAGE_DIR을 함께 변경하고 서비스 재시작 후 readiness·파일 다운로드를 확인합니다. 단일 bundle은 검수 파일 10,000개까지이며 실패한 불완전 폴더는 manifest가 없거나 무결성 검사로 거절됩니다. manifest hash는 손상 검사용이며 인증 서명이 아니므로 bundle 자체를 비공개 경로·암호화 백업과 검증된 운송 경로로 보호합니다.

SQLite는 단일 쓰기 서비스와 영속 volume에서 운영합니다. 개인정보·제보·계약·감사·결제 기록의 보관 기간은 운영자가 정해야 합니다. 로컬 HTTP/SQLite/복구 및 테스트 공급자 응답 검사는 실제 공급자 sandbox·OpenAI 평가·메일 전달·Linux volume/TLS·운영 장애 복구 완료를 증명하지 않습니다.

## 운영 고도화 계약

추가 마이그레이션 007–010은 기존 001–006을 변경하지 않습니다. 기존 계정의 역할은 기본 업무 범위로 유지되며, 명시적인 scopes를 저장하면 그 목록으로 대체합니다. `content:read/write/review/publish`, `finance:read/manage`, `operations:manage`, `security:manage`, `rights:manage`, `analytics:read`를 서버가 검사합니다. 권한 변경·퇴직 처리 시 세션을 폐기하고 감사·복구 원장을 남깁니다. 역할을 변경하면 기존 명시 범위는 새 역할 기본 범위와의 교집합으로 줄여 권한이 남지 않게 합니다. 새 사용자 설정·실제 운영 계정의 역할 변경은 자동 수행하지 않습니다.

`GET/PUT /admin/users/:id/scopes`, `POST /admin/users/:id/offboard`는 보안 관리 범위가 필요합니다. 마지막 관리자와 소유권 이전 전 공동 공간은 보호합니다. `GET /operations/assignees`는 운영 담당자 이름·ID·범위만 반환하며 이메일을 포함하지 않습니다. `GET /operations/workboard`는 허용된 초안·정정·작업·권리·주문·환불·기관 문의를 반환합니다. `PUT /operations/workboard/:kind/:id`는 `{version,assigneeId,priority,dueAt,nextAction}`을 받고 버전 충돌을 거절합니다. 담당자에게 해당 업무의 권한이 있어야 합니다.

MFA는 RFC 6238/4226의 HMAC-SHA1·30초·6자리 TOTP이며 코드 재사용을 거절합니다. `ARCHIVE_SECURITY_ENCRYPTION_KEY`는 별도 32바이트 hex 키이고 등록 키는 사용자 ID와 결속한 AES-256-GCM으로 암호화합니다. 암호화 키의 별도 안전 백업·접근 제한·교체 절차가 필요하며 이 키가 없거나 변경되면 기존 등록을 사용할 수 없습니다. `GET /auth/mfa`, `POST /auth/mfa/enroll {password}`, `POST /auth/mfa/confirm {code}`, `POST /auth/mfa/challenge {code}`, `POST /auth/reauth {password,totp?}`를 제공합니다. 등록 확인 후 같은 시간 구간의 코드를 재사용할 수 없습니다. `ARCHIVE_STAFF_MFA_REQUIRED`, `ARCHIVE_RECENT_REAUTH_REQUIRED`를 개발에서 선택할 수 있고 production은 두 검사를 강제합니다. 직원 비공개 업무에는 MFA, 승인·보류·발행·금융·권한 등 민감 변경에는 10분 이내 재인증이 필요합니다. 실제 직원의 인증 앱 등록·복구 훈련은 운영 인수 조건입니다.

교사가 만든 과제의 `teacherNotes`와 `answerKey`는 각각 10,000자이고 학생 응답에서 키 자체를 제거합니다. 과제는 `version/createdAt/updatedAt/readingMetadata`를 반환하며 `PUT /spaces/:id/tasks/:taskId`는 현재 version으로만 수정합니다. 학생에게 반환하는 study payload에서도 알려진 교사용 키를 재귀적으로 제거합니다. 제출은 `taskVersion/submissionVersion/createdAt/updatedAt`, 피드백은 `feedbackVersion/feedbackSubmissionVersion/feedbackAt`으로 결속합니다. 재제출 시 현재 피드백은 비우고 불변 제출·피드백 이력은 `GET /spaces/:id/submissions/:id/history`에서 담당 교사와 해당 학생만 조회합니다. 마이그레이션 이전에 저장하지 않은 과거 버전은 만들어내지 않습니다.

`ARCHIVE_KNOWLEDGE_FILE`은 검수할 지식 레지스트리의 읽기 전용 경로이며 production에서 필수입니다. `GET /cms/drafts/:id/preflight`는 자료 버전·내용 해시·registryHash·출처 서지/제공자/종류/독립성 및 언어판 원본의 변화·영향 목록을 검사합니다. 설정되어 있으면 출처 대조/승인/발행과 worker에서 이를 강제하고 승인 뒤 registryHash 변화도 재검수를 요구합니다. 미설정 개발 환경은 `ready:false`로 검증 미완료를 표시합니다.

`GET /cms/drafts/:id/publication`은 export/build/deploy/feed 증거를 분리합니다. export는 실제 서명 파일 생성 후에만 기록합니다. 외부 증거는 `node --experimental-strip-types api/src/cli.ts deployment-evidence SIGNED_JSON`으로 수입합니다. 파일은 `{version:1,observedAt,entries:[{recordId,revision,contentHash,stage,commitSha,artifactHash,url}],signature}`이고 signature는 마지막 signature 필드 전 body JSON의 HMAC-SHA256입니다. `ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET`을 별도로 설정합니다. 최근 30분 실측, 40/64자리 SHA, HTTPS 허용 origin, 현재 공개 자료 해시, 이전 export→build→deploy→feed 단계를 대조합니다. 서명 권한이 있는 관측 도구가 실제 URL·release·산출물을 검증해야 하며 입력만으로 외부 배포가 실행되지 않습니다. 정정의 accepted는 완료가 아닙니다. resolved에는 실제 현재 공개 revision의 deploy/feed publicationId와 closureEvidence가 필요합니다.

권리는 `permissions`(display/download/teaching/commercial/translation/adaptation), `territory`, `startsAt/expiresAt`, `attribution`, 같은 기록·출처의 `documentId`를 받습니다. 상세 허가를 granted로 등록하려면 실제 clean 검사 문서와 지역·출처 표기가 필요합니다. 계약은 `requiredRightsIds/requiredPermissions/territory`를 지정해 모든 대상의 허가·기간·지역·문서 상태를 대조합니다. 권리 철회·기간 만료·검사 차단은 계약의 operationallyReady/scopeVerified를 즉시 무효화합니다. 기존 범위 미기재 계약은 legacy-unspecified로 표시하고 신규 기관 서비스의 계약 단계에는 사용할 수 없습니다.

비공개 파일은 기본 `scanStatus:unknown`입니다. 실제 검사 결과만 `POST /operations/file-scan-receipts`의 `{version:1,attachmentId,sha256,status:'clean'|'rejected',scanner,observedAt}`와 `X-Archive-Signature`로 받으며 `ARCHIVE_FILE_SCAN_SECRET`으로 body JSON의 HMAC을 검증합니다. 최근 5분·원본 해시·상태 순서를 검사하고 rejected 파일 다운로드를 차단합니다. 검사기 설치·해당 검사기의 실제 결과 전달은 별도 운영 조건이며 검수 파일을 공개 미디어로 자동 노출하지 않습니다.

알림 작업 completed는 발송 작업 처리 완료를 뜻합니다. 공급자가 요청을 접수하면 deliveryStatus는 accepted이고 payload는 providerAccepted만 남깁니다. 실제 delivered/failed는 `POST /notifications/receipts {version:1,eventId,jobId,status,observedAt}`와 `ARCHIVE_NOTIFICATION_RECEIPT_SECRET`의 body HMAC 서명 헤더로 확인합니다. 공급자 접수 전 수신 콜백은 재시도해야 합니다. 실제 수신 증거가 없으면 일반 알림 24시간/비밀번호 안내 토큰 기한에 expired로 바뀝니다. 세션·발행·MFA·배포·알림·파일 검사 비밀값을 재사용하지 않습니다.

상품은 optional serviceDefinition `{description,audience,deliverables,rightsStatement,deliveryDays,supportPolicy}`를 제공합니다. `ARCHIVE_PAYMENT_LIVE_ENABLED=true`이면 모든 상품에 이행 정의가 있어야 합니다. 실제 가격·상품·기관 계약은 운영자가 등록해야 합니다. `GET/PUT /payments/orders/:id/fulfillment`, `POST /.../fulfillment/confirm {version}`은 실제 결제 확인 뒤 planned→in-progress→delivered→고객 confirmed를 처리하며 결제 상태 자체를 변경하지 않습니다. 고객 본인만 확인할 수 있습니다.

`POST /service-requests {title,audience,deliverables,rights,deadline?}`는 실제 문의를 접수합니다. GET 목록/상세는 고객 본인 또는 finance:read만 보고, PUT는 finance:manage와 현재 version으로 qualified→quoted→contracted→fulfilling→delivered→closed를 진행합니다. 실제 견적 내용, 범위 검증된 활성 계약, 해당 고객 주문, 결제 확인, 납품 및 고객 확인을 각 단계에서 요구합니다. 문의·견적·계약 상태를 결제 성공으로 대신하지 않습니다.

`GET /operations/metrics`와 `/health/metrics`는 analytics:read에 24시간 요청/5xx율·persisted 5분 histogram·p50/p95/p99를 제공합니다. quantile은 버킷 상한 근사치이고 최상위 버킷은 null/overflowCount로 표시합니다. 기본 비교 대상은 가용성 99.5%, p95 1초이며 요청 100개 미만이면 meetsObservedTarget은 null입니다. 지표에는 productionEvidence:false를 명시합니다. 운영 정책의 SLO 합의와 실제 부하/장애 관측은 별도 검증입니다. 사용자 질문·원문과 비밀값은 지표에 저장하지 않습니다.

복구 CLI는 원본의 최신 신뢰 DB가 존재해야 시작합니다. 백업 이력이 최신 recovery_events 원장의 prefix인지 확인하고 이후 보류·계정 삭제·퇴직·역할/범위 취소를 재적용합니다. 모든 복구 세션·재설정 링크를 폐기하고 대기 발행 작업을 차단하며 과거 artifacts를 지워 정적 재생성을 요구합니다. 원본 DB 또는 최신 인증 원장을 잃었을 때 과거 백업만으로 최신 철회 사실을 증명할 수 없으므로 자동 승인하지 않습니다. 보류 담당자가 백업에 없는 등 재적용 불가능한 경우 더 최근의 신뢰 백업이 필요합니다. 기존 파일·원본 DB는 덮어쓰지 않습니다.
